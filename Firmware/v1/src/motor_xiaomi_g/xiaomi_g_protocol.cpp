#include "xiaomi_g_protocol.h"

uint8_t xgChecksum(const uint8_t* frame, size_t len) {
  if (len < 2) {
    return 0;
  }
  uint8_t sum = 0;
  for (size_t i = 1; i < len - 1; ++i) {
    sum = static_cast<uint8_t>(sum + frame[i]);
  }
  return sum;
}

uint8_t xgModeByte(XgEscMode mode) {
  switch (mode) {
    case kXgEscModeMedium:
      return 0x02;
    case kXgEscModeHigh:
      return 0x03;
    case kXgEscModeEco:
    default:
      return 0x01;
  }
}

uint16_t xgSpeedForMode(XgEscMode mode) {
  switch (mode) {
    case kXgEscModeMedium:
      return XG_SPEED_MEDIUM;
    case kXgEscModeHigh:
      return XG_SPEED_HIGH;
    case kXgEscModeEco:
    default:
      return XG_SPEED_ECO;
  }
}

void xgBuildCtrl(uint8_t out[12], XgEscMode mode, bool enable) {
  out[0] = XG_FRAME_START;
  out[1] = 0x03;
  out[2] = 0x07;
  out[3] = xgModeByte(mode);
  out[4] = 0x55;
  out[5] = enable ? 0x02 : 0x00;
  out[6] = 0x00;
  out[7] = 0x02;
  out[8] = 0x00;
  out[9] = 0x00;
  out[10] = 0x00;
  out[11] = xgChecksum(out, XG_CTRL_LEN);
}

void xgBuildSetpRun(uint8_t out[8], XgEscMode mode) {
  const uint16_t speed = xgSpeedForMode(mode);
  out[0] = XG_FRAME_START;
  out[1] = 0x01;
  out[2] = 0x03;
  out[3] = xgModeByte(mode);
  out[4] = static_cast<uint8_t>((speed >> 8) & 0xFF);
  out[5] = static_cast<uint8_t>(speed & 0xFF);
  out[6] = 0x00;
  out[7] = xgChecksum(out, XG_SETP_LEN);
}

void xgBuildSetpStop(uint8_t out[8]) {
  out[0] = XG_FRAME_START;
  out[1] = 0x01;
  out[2] = 0x03;
  out[3] = 0x00;
  out[4] = 0x00;
  out[5] = 0x00;
  out[6] = 0x00;
  out[7] = xgChecksum(out, XG_SETP_LEN);
}

XgEscMode xgPercentToMode(uint8_t percent) {
  if (percent <= 33) {
    return kXgEscModeEco;
  }
  if (percent <= 67) {
    return kXgEscModeMedium;
  }
  return kXgEscModeHigh;
}
