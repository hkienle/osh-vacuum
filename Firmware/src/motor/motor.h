#ifndef MOTOR_H
#define MOTOR_H

#include <stdint.h>

#include "../settings/dev_menu.h"
#include "../settings/settings.h"
#include "motor_driver.h"

void initMotor(MotorType type);
void updateMotor();

void setMotorSpeedPercent(uint8_t percent);
void setMotorDuty(int duty);
void startMotor();
void stopMotor();
int getMotorDuty();
bool isMotorRunning();
void handleMotorCommand(const char* key, int value);
void handleMotorHeartbeat();

bool motorHasRpm();
float motorGetRpm();
bool motorIsRpmReady();
MotorSpeedLevels motorGetSpeedLevels();
uint8_t motorNextSpeedPercent(uint8_t current);
uint8_t motorPrevSpeedPercent(uint8_t current);
const char* motorActiveDriverName();

bool motorDriverSupportsGlobalSetting(DevSettingId id);
MotorDriverSettings motorActiveDriverSettings();

#endif  // MOTOR_H
