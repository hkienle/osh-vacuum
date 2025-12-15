#ifndef MOTOR_PWM_H
#define MOTOR_PWM_H

// Initialize motor PWM
void initMotorPWM();

// Set PWM duty cycle (0-255)
void setMotorDuty(int duty);

// Start motor (applies current duty cycle)
void startMotor();

// Stop motor (sets duty to 0)
void stopMotor();

// Get current duty cycle setting
int getMotorDuty();

// Check if motor is running
bool isMotorRunning();

// Handle WebSocket command (for speed control)
void handleMotorCommand(const char* key, int value);

// Handle heartbeat command (resets timeout)
void handleMotorHeartbeat();

// Update motor (check heartbeat timeout, call this in loop())
void updateMotor();

#endif // MOTOR_PWM_H

