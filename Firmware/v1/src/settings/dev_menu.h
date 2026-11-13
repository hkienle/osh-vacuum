#ifndef DEV_MENU_H
#define DEV_MENU_H

#include <stddef.h>
#include <stdint.h>

enum class DevSettingId : uint8_t {
  AutoOff = 0,
  TempLimit,
  SpeedStep,
  MinDuty,
  MaxDuty,
  BatteryCells,
  SleepTimer,
  TriggerMode,
  MotorDisplayMode,
  LedIdle,
  LedDisplay,
  LedDim,
  LedTheme,
  MotorType,
  GlobalCount,
};

struct DevSettingDescriptor {
  bool isGlobal;
  DevSettingId globalId;
  const char* driverKey;

  const char* title;
  void (*formatValue)(char* out, size_t n);
  const char* subline;
  void (*formatSubline)(char* out, size_t n);
  void (*cycleAndSave)();
};

const DevSettingDescriptor* devSettingByGlobalId(DevSettingId id);

/** Max visible settings (global + driver-specific). */
constexpr size_t kDevMenuMaxVisibleSettings = 28;

void devMenuRebuildVisible();
size_t devMenuVisibleCount();
const DevSettingDescriptor* devMenuVisibleAt(size_t idx);

/** Info pages 0..5 (Maximum Stats, Battery, WiFi, BLE, Sensor, System). */
constexpr uint8_t kDevMenuInfoPageCount = 6;

uint8_t devMenuTotalPageCount();

#endif  // DEV_MENU_H
