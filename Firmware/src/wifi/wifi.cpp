#include <Arduino.h>
#include "wifi.h"
#include "led/led.h"
#include <ESPmDNS.h>

const char* wifi_ssid = "TheLab IoT";
const char* wifi_password = "freche-offizier-wallung-gogol";

const char* ap_ssid = "OSH_VAC";
const char* ap_password = "testbench";

void setupWiFi() {
  // Set LED to pulse white at half brightness during WiFi setup
  setLEDColor(128, 128, 128); // White at half brightness
  setLEDPattern(LED_PULSE);
  setLEDSpeed(2000); // 2 second pulse cycle for smooth animation
  
  Serial.println("Attempting to connect to WiFi...");
  Serial.print("SSID: ");
  Serial.println(wifi_ssid);
  
  // Try to connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifi_ssid, wifi_password);
  
  // Wait for connection for up to 10 seconds (non-blocking)
  unsigned long startTime = millis();
  unsigned long lastDotTime = 0;
  bool connected = false;
  
  while (millis() - startTime < 10000) { // 10 second timeout
    updateLED(); // Update LED continuously for smooth pulse
    
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      break;
    }
    
    // Print dot every 500ms
    if (millis() - lastDotTime >= 500) {
      Serial.print(".");
      lastDotTime = millis();
    }
    
    // No delay needed - updateLED() handles timing, and WiFi.status() is non-blocking
  }
  Serial.println();
  
  if (connected || WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // Set hostname and start mDNS
    WiFi.setHostname("osh-vac");
    if (MDNS.begin("osh-vac")) {
      Serial.println("mDNS started: osh-vac.local");
    } else {
      Serial.println("Error starting mDNS");
    }
    
    // Set LED to solid blue when connected to WiFi
    setLEDColor(0, 0, 255); // Blue
    setLEDPattern(LED_STATIC);
  } else {
    Serial.println("WiFi connection failed. Starting Access Point...");
    
    // Create WiFi access point
    WiFi.mode(WIFI_AP);
    bool result = WiFi.softAP(ap_ssid, ap_password);
    
    if (result) {
      Serial.println("WiFi AP started successfully!");
      Serial.print("SSID: ");
      Serial.println(ap_ssid);
      Serial.print("IP address: ");
      Serial.println(WiFi.softAPIP());
      
      // Set LED to solid orange when in AP mode
      setLEDColor(255, 140, 0); // Orange
      setLEDPattern(LED_STATIC);
    } else {
      Serial.println("Failed to start WiFi AP!");
      // Keep LED as is if AP failed
    }
  }
}

