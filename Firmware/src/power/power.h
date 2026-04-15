#ifndef POWER_H
#define POWER_H

#include <stdint.h>

void initPowerManagement();
bool updatePowerManagement(bool buttonActivity, bool motorActive, bool otaActive);

#endif  // POWER_H
