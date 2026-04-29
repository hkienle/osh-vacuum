# Motor drivers (modular backend)

## What this is

Motor control is split into **small modules** (`motor_<name>/`) behind a single API in [`motor/motor.h`](motor.h). Firmware code never includes a specific driver; it calls `initMotor()`, `setMotorSpeedPercent()`, `motorGetRpm()`, etc. The active driver is selected by `RuntimeSettings::motorType` (NVS key `mtr_type`).

```text
main / button / power / websocket / display
              │
              ▼
        motor/motor.cpp   ← dispatcher
              │
    ┌─────────┴─────────┐
    ▼                   ▼
motor_generic_pwm/   motor_xiaomi_g/  …
```

## Module layout

| Location | Role |
|----------|------|
| [`motor/motor.h`](motor.h), [`motor.cpp`](motor.cpp) | Public API, active driver pointer, `motorNextSpeedPercent` / `motorPrevSpeedPercent`, NVS-driven menu visibility |
| [`motor/motor_driver.h`](motor_driver.h) | `MotorDriver` vtable, `MotorCapabilities`, `MotorSpeedLevels`, `supportsGlobalSetting`, `driverSettings` |
| [`motor_generic_pwm/`](../motor_generic_pwm/) | LEDC PWM on GPIO 5; RPM from tachometer |
| [`motor_xiaomi_g/`](../motor_xiaomi_g/) | ESC UART on TX 17 / RX 18 (`Serial2`, 9600 8E1); see below |
| [`settings/dev_menu.h`](../settings/dev_menu.h) | `DevSettingId`, `DevSettingDescriptor` (dev-menu pages are table-driven) |

Add a new driver: create `src/motor_foo/motor_foo.{h,cpp}`, export `extern const MotorDriver kFooDriver;`, register it in `motorDriverForType()` in [`motor.cpp`](motor.cpp), and extend `MotorType` + NVS clamp in [`settings.h`](../settings/settings.h) / [`settings.cpp`](../settings/settings.cpp).

## `MotorDriver` vtable (contract)

| Field | When called | Purpose |
|-------|-------------|---------|
| `name` / `nvsValue` | — | UI label; `nvsValue` should match `motorTypeToString()` for that type |
| `init` / `deinit` | `initMotor()` / driver swap | Hardware setup / teardown |
| `update` | Every `loop` → `updateMotor()` | Heartbeats, UART RX, timeouts |
| `onPowerOn` / `onPowerOff` | First `startMotor` / `stopMotor` while motor type is non-PWM* | Avoid per-loop spam; see dispatcher |
| `setSpeedPercent` | Main loop when motor active | Map UI 0–100 % to hardware |
| `isRunning` | Optional | Running state (generic PWM uses internal LEDC state) |
| `getRpm` / `isRpmReady` | Telemetry if `caps.hasRpm` | PWM delegates to `tachometer/` |
| `getSpeedLevels` | UP/DOWN speed steps | Discrete or synthesized level list |
| `handleWebSocketCommand` / `handleHeartbeat` | WebSocket | Legacy/raw commands |
| `supportsGlobalSetting` | Dev-menu rebuild | `false` → hide that global NVS setting page |
| `driverSettings` | Dev-menu rebuild | Extra `DevSettingDescriptor` rows (NVS in driver TU) |

\*Non-PWM drivers: `startMotor()` / `stopMotor()` only latch `onPowerOn` / `onPowerOff` once per run/stop (see [`motor.cpp`](motor.cpp)).

## Capabilities

| Flag | Effect |
|------|--------|
| `hasRpm` | If `false`, `motorGetRpm()` / `motorIsRpmReady()` are gated off; UI should show `--` |
| `isDiscreteSpeed` | Hints that labels may be non-linear (e.g. Eco / Mid / Boost) |
| `overridesSpeedStep` | Speed list comes only from `getSpeedLevels`, not from `speedStepPercent` |

## Speed levels

- **Generic PWM:** `getSpeedLevels()` builds `0, step, 2·step, …, 100` from `speedStepPercent` (same stepping as before).
- **Discrete (e.g. Xiaomi):** Return constant table `{ Off, Eco, Mid, Boost }`; percent bands map to ESC MM: Eco / Medium / High (see `xiaomi_g_protocol.cpp`).
- **Buttons:** `motorNextSpeedPercent` / `motorPrevSpeedPercent` walk that list.

## Hiding global dev-menu settings

Implement `supportsGlobalSetting(DevSettingId id)`:

- Return `false` for settings that do not apply (e.g. Xiaomi `false` for `SpeedStep`, `MinDuty`, `MaxDuty`).
- No changes needed in `button.cpp` or display code besides the dispatcher.

## Xiaomi G ESC UART (implemented)

Hardware: **TX GPIO 17**, **RX GPIO 18**, **9600 8E1**, `HardwareSerial` **Serial2** (see [`motor_xiaomi_g.h`](../motor_xiaomi_g/motor_xiaomi_g.h)).

| File | Role |
|------|------|
| [`xiaomi_g_protocol.h`](../motor_xiaomi_g/xiaomi_g_protocol.h), [`xiaomi_g_protocol.cpp`](../motor_xiaomi_g/xiaomi_g_protocol.cpp) | Checksum, `CTRL` / `SETP` frame builders, stable speeds (150 / 300 / 550), percent→MM |
| [`xiaomi_g_uart.h`](../motor_xiaomi_g/xiaomi_g_uart.h), [`xiaomi_g_uart.cpp`](../motor_xiaomi_g/xiaomi_g_uart.cpp) | `Serial2` begin/end, raw frame TX, optional `0xFE` wake byte |
| [`motor_xiaomi_g.cpp`](../motor_xiaomi_g/motor_xiaomi_g.cpp) | `MotorDriver` hooks: non-blocking ~50 ms / 25 ms CTRL+SETP loop while running; blocking wake (first start) and multi-repeat stop (`CTRL_OFF` + `SETP_STOP`) |

Behavior summary:

- While **motor on**: every cycle sends **CTRL_ON** for current MM, then after **25 ms** **SETP_RUN** with the documented speed for that mode.
- **First start** after init: **0xFE** wake, **25 ms**, then cyclic frames.
- **Stop**: **CTRL_OFF** for current mode, **25 ms**, **SETP_STOP**, repeated **3×** with ~**75 ms** between repeats; driver deinit also sends a single **SETP_STOP**.
- **RX** status frames (`AC 02 …`) are not parsed yet.

## Adding a driver-specific dev-menu row

1. In the driver `.cpp`, add `static uint8_t s_mySetting;` (+ NVS load/save with a **short** key, e.g. `xf_hb_ms`).
2. Define `formatValue`, `formatSubline` (optional), `cycleAndSave`.
3. Build a `DevSettingDescriptor`:

   ```cpp
   { false, DevSettingId::AutoOff /* ignored */, "my_key", "Title",
     fmt, "Static sub", fmtSub, cycle }
   ```

   Use `isGlobal == false`, set `driverKey`, ignore `globalId` for storage naming.

4. Return `MotorDriverSettings{ N, items }` from `driverSettings()`.

Rebuild menu after changing motor type: `devMenuRebuildVisible()` (already called when cycling **Motor Type**).

## Wiring checklist (new motor type)

1. `enum class MotorType` + `clampMotorType` + NVS in [`settings.cpp`](../settings/settings.cpp).
2. `parseMotorType` / `motorTypeToString` / `motorTypeDisplayName`.
3. `motorDriverForType()` in [`motor.cpp`](motor.cpp).
4. Optional: `SettingsConfig::DEFAULT_MOTOR_TYPE`.

## What not to do

- Do not `#include "../motor_foo/motor_foo.h"` outside that folder; use [`motor/motor.h`](motor.h) only.
- Do not call `ledc*` or UART directly from `main` for motor control; keep it in the driver.
