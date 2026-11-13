#ifndef MCU_TEMP_H
#define MCU_TEMP_H

void initMcuTemperature();
/** Sample internal die temperature (~every 500 ms). Call from loop(). */
void updateMcuTemperature();
/** Last read °C, or NAN before first successful read. */
float getMcuTemperatureC();

#endif
