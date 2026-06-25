#ifndef MOTOR_XIAOMI_G_H
#define MOTOR_XIAOMI_G_H

#include "../motor/motor_driver.h"

#ifdef __cplusplus
extern "C" {
#endif

/** UART ESC: ESP32 TX=17 / RX=18 (`Serial2`, 9600 8E1). See MOTOR_DRIVERS.md */
constexpr uint8_t XIAOMI_UART_TX_PIN = 17;
constexpr uint8_t XIAOMI_UART_RX_PIN = 18;
constexpr int XIAOMI_UART_NUM = 2;

extern const MotorDriver kXiaomiGDriver;

#ifdef __cplusplus
}
#endif

#endif  // MOTOR_XIAOMI_G_H
