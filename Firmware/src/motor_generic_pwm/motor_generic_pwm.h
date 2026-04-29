#ifndef MOTOR_GENERIC_PWM_H
#define MOTOR_GENERIC_PWM_H

#include "../motor/motor_driver.h"

#ifdef __cplusplus
extern "C" {
#endif

extern const MotorDriver kGenericPwmDriver;

/** Raw PWM duty 0–255 (legacy WebSocket / internal). */
void motorGenericPwmSetDuty(int duty);
void motorGenericPwmStart();
void motorGenericPwmStop();
int motorGenericPwmGetDuty();
bool motorGenericPwmIsRunning();

#ifdef __cplusplus
}
#endif

#endif  // MOTOR_GENERIC_PWM_H
