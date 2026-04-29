#include "xiaomi_g_uart.h"

#include <Arduino.h>
#include <HardwareSerial.h>

#include "motor_xiaomi_g.h"

void xgUartBegin(void) {
  Serial2.setTxBufferSize(64);
  Serial2.begin(9600, SERIAL_8E1, XIAOMI_UART_RX_PIN, XIAOMI_UART_TX_PIN);
}

void xgUartEnd(void) {
  Serial2.end();
}

void xgUartSendFrame(const uint8_t* f, size_t len) {
  Serial2.write(f, len);
  Serial2.flush();
}

void xgUartSendWake(void) {
  Serial2.write(static_cast<uint8_t>(0xFE));
  Serial2.flush();
}
