#ifndef BUTTON_H
#define BUTTON_H

// Button pins
#define TRIGGER_PIN 42
#define UP_PIN 41
#define DOWN_PIN 40
#define MOSFET_PIN 7

/** Trigger long-press to start motor (ms). “Hold.*” on display uses thirds of this. */
constexpr unsigned long TRIGGER_START_HOLD_MS = 1250;
/** UP+DOWN together to open info pages (ms). */
constexpr unsigned long INFO_MODE_HOLD_MS = 1500;

// Initialize button module
void initButtons();

// Update button states (call this in loop())
void updateButtons();
// True if any button edge was seen since last clear.
bool hadButtonActivityAndClear();

// Get current speed setting (0-100%)
uint8_t getSpeed();

// Set speed setting (0-100%, in 20% steps)
void setSpeed(uint8_t speed);

// Check if trigger is currently pressed
bool isTriggerPressed();

// Motor state management (unified for physical and web control)
bool isMotorActive();
void setMotorState(bool active); // true = motor_start, false = motor_stop

// Display info mode: UP+DOWN long-press toggles menu on/off. UP/DOWN cycle pages (0–5 info, 6–18 settings).
// TRIGGER on settings pages cycles value and saves NVS; on info pages TRIGGER does nothing.
bool isDisplayInfoMode();
uint8_t getDisplayInfoPage();  // 0–5 info pages, 6+ settings (see devMenuTotalPageCount)
// Reset runtime button/motor mode state while keeping the saved speed setting.
void resetButtonRuntimeStateKeepSpeed();

#endif // BUTTON_H

