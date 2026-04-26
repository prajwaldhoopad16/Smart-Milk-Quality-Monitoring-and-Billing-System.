/* =========================================================
   ESP32 : MILK QUALITY MONITOR – FINAL STABLE VERSION
   ---------------------------------------------------------
   Features:
   ✔ Fast & Non-blocking
   ✔ DS18B20 Temperature
   ✔ pH Sensor
   ✔ Fat Detection (LDR)
   ✔ LCD Live Display
   ✔ /quality API with CORS
   ✔ Auto POST to Flask Server
   ✔ Milk Sample Classification (Water Adulteration)
   ========================================================= */

#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>

// ================= WIFI =================
const char* WIFI_SSID = "Mizz";
const char* WIFI_PASS = "Mizz8147";

// ================= FLASK SERVER =================
#define SERVER_IP   "192.168.1.50"   // CHANGE IF NEEDED
#define SERVER_PORT 5000

// ================= PINS =================
#define ONE_WIRE_PIN 4
#define PH_PIN       34
#define LDR_PIN      35
#define LED_PIN      25

#define LCD_ADDR     0x27

// ================= OBJECTS =================
OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature dallas(&oneWire);
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);
WebServer server(80);

// ================= TIMING =================
unsigned long lastReadTime = 0;
unsigned long lastPostTime = 0;

#define SENSOR_INTERVAL 1000     // 1 sec
#define POST_INTERVAL   5000     // 5 sec

// ================= GLOBAL VALUES =================
float temperatureC = 0;
float phValue = 0;
float fatPercent = 0;
String milkQuality = "----";

// =================================================
//                 SENSOR FUNCTIONS
// =================================================
int readADC(int pin, int samples = 6) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  return sum / samples;
}

float analogToPH(int raw) {
  float voltage = (raw / 4095.0) * 3.3;
  return voltage * (14.0 / 3.3);   // Basic calibration
}

float analogToFat(int raw) {
  float norm = (float)raw / 4095.0;
  return (1.0 - norm) * 10.0;      // 0–10 fat index
}

// =================================================
//            MILK QUALITY CLASSIFICATION
// =================================================
String evaluateQuality(float temp, float ph, float fat) {

  if (ph >= 6.6 && fat >= 6.5)
    return "Pure Milk";

  if (ph >= 6.4 && fat >= 5.0)
    return "10% Water";

  if (ph >= 6.1 && fat >= 3.5)
    return "30% Water";

  return "Adultered";
}

// =================================================
//            READ ALL SENSORS (FAST)
// =================================================
void readSensors() {
  dallas.requestTemperatures();
  temperatureC = dallas.getTempCByIndex(0);

  phValue = analogToPH(readADC(PH_PIN));
  fatPercent = analogToFat(readADC(LDR_PIN));

  milkQuality = evaluateQuality(temperatureC, phValue, fatPercent);
}

// =================================================
//                 LCD DISPLAY
// =================================================
void updateLCD() {
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(temperatureC, 1);
  lcd.print((char)223); lcd.print("C ");

  lcd.print("pH:");
  lcd.print(phValue, 2);
  lcd.print(" ");

  lcd.setCursor(0, 1);
  lcd.print("Fat:");
  lcd.print(fatPercent, 1);
  lcd.print(" ");

  lcd.print(milkQuality.substring(0, 4));
  lcd.print("   ");
}

// =================================================
//         SEND DATA TO FLASK SERVER
// =================================================
void sendToFlask() {

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/update";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"temperature\":" + String(temperatureC, 2) + ",";
  json += "\"ph\":" + String(phValue, 2) + ",";
  json += "\"fat\":" + String(fatPercent, 2) + ",";
  json += "\"quality\":\"" + milkQuality + "\"";
  json += "}";

  http.POST(json);
  http.end();
}

// =================================================
//              CORS HEADERS
// =================================================
void sendCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// =================================================
//              /quality ENDPOINT
// =================================================
void handleQuality() {
  sendCORS();

  digitalWrite(LED_PIN, HIGH);

  String json = "{";
  json += "\"temperature\":" + String(temperatureC, 2) + ",";
  json += "\"ph\":" + String(phValue, 2) + ",";
  json += "\"fat\":" + String(fatPercent, 2) + ",";
  json += "\"quality\":\"" + milkQuality + "\"";
  json += "}";

  server.send(200, "application/json", json);

  digitalWrite(LED_PIN, LOW);
}

void handleOptions() {
  sendCORS();
  server.send(204);
}

// =================================================
//                    SETUP
// =================================================
void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  dallas.begin();
  Wire.begin();
  lcd.init();
  lcd.backlight();

  lcd.clear();
  lcd.print("Connecting WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    lcd.print(".");
  }

  lcd.clear();
  lcd.print("IP:");
  lcd.print(WiFi.localIP());

  server.on("/quality", HTTP_GET, handleQuality);
  server.on("/quality", HTTP_OPTIONS, handleOptions);
  server.begin();

  delay(1500);
}

// =================================================
//                     LOOP
// =================================================
void loop() {
  server.handleClient();

  unsigned long currentMillis = millis();

  // Sensor Read
  if (currentMillis - lastReadTime >= SENSOR_INTERVAL) {
    lastReadTime = currentMillis;
    readSensors();
    updateLCD();
  }

  // Send to Flask
  if (currentMillis - lastPostTime >= POST_INTERVAL) {
    lastPostTime = currentMillis;
    sendToFlask();
  }
}