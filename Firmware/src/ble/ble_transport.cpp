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
constexpr size_t kMaxChunkPayload = 480;

NimBLEServer* bleServer = nullptr;
NimBLECharacteristic* txCharacteristic = nullptr;
bool bleInitialized = false;
bool clientConnected = false;

char rxBuffer[kRxBufferSize];
size_t rxLength = 0;

class BleServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* /*server*/, NimBLEConnInfo& /*connInfo*/) override {
    clientConnected = true;
    Serial.println("[BLE] Client connected");
  }

  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& /*connInfo*/, int /*reason*/) override {
    clientConnected = false;
    rxLength = 0;
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
        }
        rxLength = 0;
      }
    }
  }
};

BleServerCallbacks bleServerCallbacks;
BleRxCallbacks bleRxCallbacks;

void sendChunkedJson(const char* json) {
  if (!txCharacteristic || !clientConnected || json == nullptr) {
    return;
  }

  const size_t totalLen = strlen(json);
  if (totalLen == 0) {
    return;
  }

  if (totalLen <= kMaxChunkPayload) {
    txCharacteristic->setValue(reinterpret_cast<const uint8_t*>(json), totalLen);
    txCharacteristic->notify();
    return;
  }

  const uint8_t totalFrags = static_cast<uint8_t>((totalLen + kMaxChunkPayload - 1) / kMaxChunkPayload);
  if (totalFrags == 0) {
    return;
  }

  uint8_t packet[kMaxChunkPayload + 4];
  for (uint8_t frag = 0; frag < totalFrags; ++frag) {
    const size_t offset = static_cast<size_t>(frag) * kMaxChunkPayload;
    const size_t partLen = (offset + kMaxChunkPayload > totalLen) ? (totalLen - offset) : kMaxChunkPayload;
    packet[0] = 'O';
    packet[1] = 'V';
    packet[2] = frag;
    packet[3] = totalFrags;
    memcpy(packet + 4, json + offset, partLen);
    txCharacteristic->setValue(packet, partLen + 4);
    txCharacteristic->notify();
    delay(2);
  }
}
}  // namespace

void initBleTransport() {
  if (bleInitialized) {
    return;
  }

  NimBLEDevice::init(kDeviceName);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

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

void updateBleTransport() {}

void bleTransportSendJson(const char* json) {
  sendChunkedJson(json);
}

bool bleTransportHasClient() {
  return clientConnected;
}
