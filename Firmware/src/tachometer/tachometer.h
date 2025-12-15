#ifndef TACHOMETER_H
#define TACHOMETER_H

// Initialize tachometer
void initTachometer();

// Update RPM reading (call this in loop())
void updateTachometer();

// Get last read RPM
float getRPM();

// Check if RPM is ready (has been read at least once)
bool isRPMReady();

#endif // TACHOMETER_H

