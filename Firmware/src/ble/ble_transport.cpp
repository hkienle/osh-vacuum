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
constexpr uint16_t kPreferredMtu = 247;
// ATT payload = negotiated MTU - 3 bytes (opcode + handle).
constexpr size_t kMaxAttPayload = kPreferredMtu - 3;
// Fragmented packets prepend a 4-byte "OV<idx><total>" header.
constexpr size_t kMaxChunkPayload = kMaxAttPayload - 4;
constexpr unsigned long kFragIntervalMs = 40;
constexpr uint8_t kMaxNotifyAttempts = 8;

NimBLEServer* bleServer = nullptr;
NimBLECharacteristic* txCharacteristic = nullptr;
bool bleInitialized = false;
bool clientConnected = false;

char rxBuffer[kRxBufferSize];
size_t rxLength = 0;

String activeTxJson;
String queuedTxJson;
bool txInProgress = false;
uint8_t txFragIndex = 0;
uint8_t txTotalFrags = 0;
unsigned long txLastFragMs = 0;

bool notifyPacket(const uint8_t* data, size_t len) {
  if (!txCharacteristic || !clientConnected || len == 0) {
    return false;
  }
  for (uint8_t attempt = 0; attempt < kMaxNotifyAttempts; ++attempt) {
    txCharacteristic->setValue(data, len);
    if (txCharacteristic->notify()) {
      return true;
    }
    delay(5);
  }
  return false;
}

void finishTx() {
  txInProgress = false;
  activeTxJson = "";
  txFragIndex = 0;
  txTotalFrags = 0;
  txLastFragMs = 0;

  if (queuedTxJson.length() > 0) {
    String next = queuedTxJson;
    queuedTxJson = "";
    activeTxJson = next;
    const size_t totalLen = activeTxJson.length();
    txTotalFrags =
        (totalLen <= kMaxChunkPayload) ? 1 : static_cast<uint8_t>((totalLen + kMaxChunkPayload - 1) / kMaxChunkPayload);
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
  txTotalFrags =
      (totalLen <= kMaxChunkPayload) ? 1 : static_cast<uint8_t>((totalLen + kMaxChunkPayload - 1) / kMaxChunkPayload);
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
      Serial.println("[BLE] WARN: single-packet notify failed");
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

  const size_t offset = static_cast<size_t>(txFragIndex) * kMaxChunkPayload;
  const size_t partLen =
      (offset + kMaxChunkPayload > totalLen) ? (totalLen - offset) : kMaxChunkPayload;

  uint8_t packet[kMaxChunkPayload + 4];
  packet[0] = 'O';
  packet[1] = 'V';
  packet[2] = txFragIndex;
  packet[3] = txTotalFrags;
  memcpy(packet + 4, json + offset, partLen);

  if (!notifyPacket(packet, partLen + 4)) {
    Serial.printf("[BLE] WARN: fragment %u/%u notify failed\n", txFragIndex + 1, txTotalFrags);
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
  void onConnect(NimBLEServer* /*server*/, NimBLEConnInfo& /*connInfo*/) override {
    clientConnected = true;
    Serial.println("[BLE] Client connected");
    // Settings are requested by the WebUI after notifications are enabled.
  }

  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& /*connInfo*/, int /*reason*/) override {
    clientConnected = false;
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
