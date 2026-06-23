#include "ble_transport.h"

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <string.h>

#include "../device_protocol/device_protocol.h"

namespace {
// Nordic UART Service (NUS) — widely supported by Web Bluetooth clients.
constexpr char kServiceUuid[] = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char kRxUuid[] = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char kTxUuid[] = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char kDeviceName[] = "osh-vac";

constexpr size_t kRxBufferSize = 1024;
constexpr uint16_t kPreferredMtu = 517;
constexpr size_t kMinAttPayload = 20;
constexpr size_t kMinChunkPayload = 16;
constexpr size_t kMaxPacketBuf = 520;
constexpr unsigned long kFragIntervalMs = 45;
constexpr uint8_t kMaxNotifyAttempts = 10;

NimBLEServer* bleServer = nullptr;
NimBLECharacteristic* txCharacteristic = nullptr;
bool bleInitialized = false;
bool clientConnected = false;
uint16_t peerMtu = 23;

char rxBuffer[kRxBufferSize];
size_t rxLength = 0;

String activeTxJson;
String queuedTxJson;
bool txInProgress = false;
uint8_t txFragIndex = 0;
uint8_t txTotalFrags = 0;
size_t txChunkPayload = kMinChunkPayload;
unsigned long txLastFragMs = 0;

size_t attPayloadMax() {
  const size_t mtu = peerMtu > 3 ? static_cast<size_t>(peerMtu - 3) : kMinAttPayload;
  return mtu < kMinAttPayload ? kMinAttPayload : mtu;
}

size_t chunkPayloadMax() {
  const size_t payload = attPayloadMax();
  return payload > 4 ? payload - 4 : kMinChunkPayload;
}

size_t chunkPayloadForLength(size_t totalLen) {
  const size_t maxChunk = chunkPayloadMax();
  if (totalLen <= maxChunk) {
    return totalLen;
  }
  return maxChunk;
}

uint8_t totalFragmentsFor(size_t totalLen, size_t chunkPayload) {
  if (totalLen == 0) {
    return 0;
  }
  if (totalLen <= chunkPayload) {
    return 1;
  }
  return static_cast<uint8_t>((totalLen + chunkPayload - 1) / chunkPayload);
}

void pushSettingsPayload() {
  String payload;
  deviceProtocolBuildSettingsPayload(payload);
  if (payload.length() > 0) {
    bleTransportSendJson(payload.c_str());
  }
}

bool notifyPacket(const uint8_t* data, size_t len) {
  if (!txCharacteristic || !clientConnected || len == 0 || len > attPayloadMax()) {
    return false;
  }
  for (uint8_t attempt = 0; attempt < kMaxNotifyAttempts; ++attempt) {
    txCharacteristic->setValue(data, len);
    if (txCharacteristic->notify()) {
      return true;
    }
    delay(8);
  }
  return false;
}

void finishTx() {
  txInProgress = false;
  activeTxJson = "";
  txFragIndex = 0;
  txTotalFrags = 0;
  txChunkPayload = kMinChunkPayload;
  txLastFragMs = 0;

  if (queuedTxJson.length() > 0) {
    String next = queuedTxJson;
    queuedTxJson = "";
    activeTxJson = next;
    const size_t totalLen = activeTxJson.length();
    txChunkPayload = chunkPayloadForLength(totalLen);
    txTotalFrags = totalFragmentsFor(totalLen, txChunkPayload);
    txInProgress = true;
    txFragIndex = 0;
    txLastFragMs = 0;
  }
}

void beginTx(const char* json) {
  activeTxJson = json;
  const size_t totalLen = activeTxJson.length();
  if (totalLen == 0) {
    return;
  }
  txChunkPayload = chunkPayloadForLength(totalLen);
  txTotalFrags = totalFragmentsFor(totalLen, txChunkPayload);
  txFragIndex = 0;
  txLastFragMs = 0;
  txInProgress = true;
}

bool sendCurrentTxFragment() {
  if (!txInProgress || activeTxJson.length() == 0) {
    return false;
  }

  const size_t totalLen = activeTxJson.length();
  const char* json = activeTxJson.c_str();

  if (txTotalFrags == 1) {
    if (!notifyPacket(reinterpret_cast<const uint8_t*>(json), totalLen)) {
      Serial.printf("[BLE] WARN: single notify failed (len=%u mtu=%u)\n", static_cast<unsigned>(totalLen),
                    peerMtu);
      finishTx();
      return false;
    }
    finishTx();
    return true;
  }

  if (txFragIndex >= txTotalFrags) {
    finishTx();
    return true;
  }

  const size_t offset = static_cast<size_t>(txFragIndex) * txChunkPayload;
  const size_t partLen =
      (offset + txChunkPayload > totalLen) ? (totalLen - offset) : txChunkPayload;

  uint8_t packet[kMaxPacketBuf];
  if (partLen + 4 > kMaxPacketBuf) {
    Serial.println("[BLE] WARN: fragment exceeds TX buffer");
    finishTx();
    return false;
  }

  packet[0] = 'O';
  packet[1] = 'V';
  packet[2] = txFragIndex;
  packet[3] = txTotalFrags;
  memcpy(packet + 4, json + offset, partLen);

  if (!notifyPacket(packet, partLen + 4)) {
    Serial.printf("[BLE] WARN: fragment %u/%u failed (mtu=%u chunk=%u)\n", txFragIndex + 1, txTotalFrags, peerMtu,
                  static_cast<unsigned>(txChunkPayload));
    finishTx();
    return false;
  }

  txFragIndex++;
  txLastFragMs = millis();
  if (txFragIndex >= txTotalFrags) {
    finishTx();
  }
  return true;
}

class BleServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* /*server*/, NimBLEConnInfo& connInfo) override {
    clientConnected = true;
    peerMtu = connInfo.getMTU();
    Serial.printf("[BLE] Client connected (mtu=%u)\n", peerMtu);
  }

  void onMTUChange(uint16_t mtu, NimBLEConnInfo& /*connInfo*/) override {
    peerMtu = mtu;
    Serial.printf("[BLE] MTU negotiated: %u (att payload=%u, chunk=%u)\n", mtu,
                  static_cast<unsigned>(attPayloadMax()), static_cast<unsigned>(chunkPayloadMax()));
    pushSettingsPayload();
  }

  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& /*connInfo*/, int /*reason*/) override {
    clientConnected = false;
    peerMtu = 23;
    rxLength = 0;
    txInProgress = false;
    activeTxJson = "";
    queuedTxJson = "";
    txFragIndex = 0;
    txTotalFrags = 0;
    Serial.println("[BLE] Client disconnected");
    server->startAdvertising();
  }
};

class BleRxCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& /*connInfo*/) override {
    const std::string& value = characteristic->getValue();
    if (value.empty()) {
      return;
    }

    for (char ch : value) {
      if (rxLength >= kRxBufferSize - 1) {
        rxLength = 0;
        Serial.println("[BLE] RX buffer overflow, discarding");
        break;
      }
      rxBuffer[rxLength++] = ch;
      if (ch == '\n') {
        rxBuffer[rxLength - 1] = '\0';
        if (rxLength > 1) {
          Serial.printf("[BLE] Received: %s\n", rxBuffer);
          DeviceCommandResult result = deviceProtocolHandleJson(rxBuffer, rxLength - 1);
          if (result.hasUnicast) {
            bleTransportSendJson(result.unicastJson.c_str());
          }
          deviceProtocolAfterCommand(result);
        }
        rxLength = 0;
      }
    }
  }
};

BleServerCallbacks bleServerCallbacks;
BleRxCallbacks bleRxCallbacks;
}  // namespace

void initBleTransport() {
  if (bleInitialized) {
    return;
  }

  NimBLEDevice::init(kDeviceName);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  NimBLEDevice::setMTU(kPreferredMtu);

  bleServer = NimBLEDevice::createServer();
  bleServer->setCallbacks(&bleServerCallbacks);

  NimBLEService* service = bleServer->createService(kServiceUuid);
  NimBLECharacteristic* rxCharacteristic =
      service->createCharacteristic(kRxUuid, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  rxCharacteristic->setCallbacks(&bleRxCallbacks);
  txCharacteristic = service->createCharacteristic(kTxUuid, NIMBLE_PROPERTY::NOTIFY);

  service->start();

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(kServiceUuid);
  advertising->setName(kDeviceName);
  advertising->start();

  bleInitialized = true;
  Serial.println("[BLE] Nordic UART service started (osh-vac)");
}

void updateBleTransport() {
  if (!txInProgress || !clientConnected) {
    return;
  }
  if (txLastFragMs != 0 && (millis() - txLastFragMs) < kFragIntervalMs) {
    return;
  }
  sendCurrentTxFragment();
}

void bleTransportSendJson(const char* json) {
  if (!clientConnected || json == nullptr || json[0] == '\0') {
    return;
  }

  if (txInProgress) {
    queuedTxJson = json;
    return;
  }

  beginTx(json);
  sendCurrentTxFragment();
}

bool bleTransportHasClient() {
  return clientConnected;
}

bool bleTransportIsTxBusy() {
  return txInProgress || queuedTxJson.length() > 0;
}
