#ifndef WEBSERVER_H
#define WEBSERVER_H

#include <WiFi.h>

// Initialize WebServer
void initWebServer();

// Update WebServer (call this in loop())
void updateWebServer();

// Check if WebServer is running
bool isWebServerRunning();

#endif // WEBSERVER_H

