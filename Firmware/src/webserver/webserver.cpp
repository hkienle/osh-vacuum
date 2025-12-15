#include <Arduino.h>
#include "webserver.h"
#include <WebServer.h>

// Define HTTP constants if not already defined (must be before ESPAsyncWebServer.h)
#ifndef HTTP_ANY
#define HTTP_ANY     0
#define HTTP_GET     1
#define HTTP_POST    2
#define HTTP_PUT     3
#define HTTP_PATCH   4
#define HTTP_DELETE  5
#define HTTP_OPTIONS 6
#endif

#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <LittleFS.h>

#define HTTP_PORT 80

// HTTP server instance
AsyncWebServer httpServer(HTTP_PORT);

// State
static bool httpServerRunning = false;

// Check if WiFi is ready (connected or in AP mode)
static bool isWiFiReady() {
  bool connected = (WiFi.status() == WL_CONNECTED);
  bool apMode = (WiFi.getMode() == WIFI_AP || WiFi.getMode() == WIFI_AP_STA);
  return connected || apMode;
}

void initWebServer() {
  // Initialize LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("[WebServer] LittleFS mount failed!");
    return;
  }
  Serial.println("[WebServer] LittleFS mounted successfully");
  
  // Check if index.html exists
  if (LittleFS.exists("/index.html")) {
    Serial.println("[WebServer] /index.html found in filesystem");
  } else {
    Serial.println("[WebServer] WARNING: /index.html not found!");
    Serial.println("[WebServer] Make sure you ran: pio run --target uploadfs");
  }
  
  httpServerRunning = false;
}

void updateWebServer() {
  // Check if WiFi is ready and server is not running
  if (!httpServerRunning && isWiFiReady()) {
    Serial.println("[WebServer] WiFi is ready, starting server...");
    // Serve index.html for root path - register with HTTP_GET explicitly
    httpServer.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
      Serial.printf("[WebServer] Request: %s from %s\n", request->url().c_str(), request->host().c_str());
      if (LittleFS.exists("/index.html")) {
        AsyncWebServerResponse *response = request->beginResponse(LittleFS, "/index.html", "text/html");
        response->addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        response->addHeader("Pragma", "no-cache");
        response->addHeader("Expires", "0");
        response->addHeader("Connection", "close");
        request->send(response);
        Serial.println("[WebServer] Served /index.html");
      } else {
        Serial.println("[WebServer] /index.html not found!");
        request->send(404, "text/plain", "File not found. Please upload filesystem with: pio run --target uploadfs");
      }
    });
    
    // Serve other static files (CSS, JS, images, etc.) from LittleFS
    // We'll handle these manually as needed, or add specific handlers
    // For now, we'll use a catch-all that serves files if they exist
    httpServer.onNotFound([](AsyncWebServerRequest *request) {
      String path = request->url();
      Serial.printf("[WebServer] Request for: %s\n", path.c_str());
      
      // If it's not root, try to serve as a static file
      if (path != "/" && path.length() > 0) {
        if (LittleFS.exists(path)) {
          // Determine content type based on extension
          String contentType = "text/plain";
          if (path.endsWith(".html")) contentType = "text/html";
          else if (path.endsWith(".css")) contentType = "text/css";
          else if (path.endsWith(".js")) contentType = "application/javascript";
          else if (path.endsWith(".png")) contentType = "image/png";
          else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) contentType = "image/jpeg";
          else if (path.endsWith(".gif")) contentType = "image/gif";
          else if (path.endsWith(".svg")) contentType = "image/svg+xml";
          
          AsyncWebServerResponse *response = request->beginResponse(LittleFS, path, contentType);
          // Add cache control for static assets (but allow caching for images/CSS/JS)
          if (path.endsWith(".html")) {
            response->addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            response->addHeader("Pragma", "no-cache");
            response->addHeader("Expires", "0");
          } else {
            response->addHeader("Cache-Control", "public, max-age=3600");
          }
          request->send(response);
          Serial.printf("[WebServer] Served static file: %s\n", path.c_str());
          return;
        }
      }
      
      // Not found
      Serial.printf("[WebServer] 404 - Not found: %s\n", path.c_str());
      request->send(404, "text/plain", "Not found");
    });
    
    
    httpServer.begin();
    httpServerRunning = true;
    
    IPAddress ip;
    if (WiFi.status() == WL_CONNECTED) {
      ip = WiFi.localIP();
    } else {
      ip = WiFi.softAPIP();
    }
    
    Serial.printf("[WebServer] Server started on http://%d.%d.%d.%d:%d\n", 
                  ip[0], ip[1], ip[2], ip[3], HTTP_PORT);
    Serial.println("[WebServer] You can also try: http://osh-vac.local");
  } else if (!httpServerRunning) {
    // Debug: print why server isn't starting
    static unsigned long lastDebugTime = 0;
    if (millis() - lastDebugTime > 5000) { // Print every 5 seconds
      Serial.print("[WebServer] Waiting for WiFi... Status: ");
      Serial.print(WiFi.status());
      Serial.print(", Mode: ");
      Serial.println(WiFi.getMode());
      lastDebugTime = millis();
    }
  }
  
  // AsyncWebServer handles requests automatically
}

bool isWebServerRunning() {
  return httpServerRunning;
}

