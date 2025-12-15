#ifndef BUTTON_H
#define BUTTON_H

// Button pins
#define TRIGGER_PIN 42
#define UP_PIN 41
#define DOWN_PIN 40
#define MOSFET_PIN 7

// Initialize button module
void initButtons();

// Update button states (call this in loop())
void updateButtons();

// Get current speed setting (0-100%)
uint8_t getSpeed();

// Set speed setting (0-100%, in 20% steps)
void setSpeed(uint8_t speed);

// Check if trigger is currently pressed
bool isTriggerPressed();

// Motor state management (unified for physical and web control)
bool isMotorActive();
void setMotorState(bool active); // true = motor_start, false = motor_stop

#endif // BUTTON_H

