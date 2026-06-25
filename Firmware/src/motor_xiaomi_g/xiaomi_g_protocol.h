#ifndef XIAOMI_G_PROTOCOL_H
#define XIAOMI_G_PROTOCOL_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Esc MM profiles only (Eco / Medium / High). Byte on wire is +1. */
typedef enum {
  kXgEscModeEco = 0,
  kXgEscModeMedium,
  kXgEscModeHigh,
} XgEscMode;

#define XG_FRAME_START 0xACu
#define XG_CTRL_LEN 12u
#define XG_SETP_LEN 8u

#define XG_SPEED_ECO 150u
#define XG_SPEED_MEDIUM 300u
#define XG_SPEED_HIGH 550u

uint8_t xgChecksum(const uint8_t* frame, size_t len);

uint8_t xgModeByte(XgEscMode mode);

uint16_t xgSpeedForMode(XgEscMode mode);

void xgBuildCtrl(uint8_t out[12], XgEscMode mode, bool enable);

void xgBuildSetpRun(uint8_t out[8], XgEscMode mode);

void xgBuildSetpStop(uint8_t out[8]);

/** Map UI percent to MM (discrete levels: <=33 Eco, <=67 Medium, else High). */
XgEscMode xgPercentToMode(uint8_t percent);

#ifdef __cplusplus
}
#endif

#endif  // XIAOMI_G_PROTOCOL_H
