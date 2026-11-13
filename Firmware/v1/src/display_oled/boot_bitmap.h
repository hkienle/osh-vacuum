#pragma once

#include <Arduino.h>

namespace boot_bitmap {

constexpr uint16_t kBootBitmapWidth = 128;
constexpr uint16_t kBootBitmapHeight = 32;

// Row-major (1 byte = 8 horizontal pixels, MSB on the left), matching the
// converter output. Set to true when 0-bits represent drawn/lit pixels
// (matches the example output where background is 0xff and content is 0x00).
constexpr bool kBootBitmapZeroIsLit = true;

extern const uint8_t kBootBitmap[] PROGMEM;

}  // namespace boot_bitmap
