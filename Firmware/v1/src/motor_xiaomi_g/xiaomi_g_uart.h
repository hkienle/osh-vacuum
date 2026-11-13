#ifndef XIAOMI_G_UART_H
#define XIAOMI_G_UART_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void xgUartBegin(void);

void xgUartEnd(void);

void xgUartSendFrame(const uint8_t* f, size_t len);

/** Single wake byte; caller waits ~25 ms before starting CTRL/SETP loop. */
void xgUartSendWake(void);

#ifdef __cplusplus
}
#endif

#endif  // XIAOMI_G_UART_H
