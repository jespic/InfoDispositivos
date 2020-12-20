/*
  AWS Iot Core
  
  This example needs https://github.com/esp8266/arduino-esp8266fs-plugin

  It connects to AWS IoT server then:
  - subscribes to the topic "inTopic", and perfprm the action according to the data recieved from the AS
*/

#include "FS.h"
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>

// Update these with values suitable for your network.

const char* ssid = "XXXXXXXXX";
const char* password = "********";

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org");
const char* AWS_endpoint = "XXXXXXXXXX.iot.eu-west-1.amazonaws.com"; //MQTT broker ip
const char MQTT_SUB_TOPIC[] = "XXXXXXXXXXXXX";
const char MQTT_PUB_TOPIC[] = "XXXXXXXXXXXXX";
char updated = 'N'; // N => NO, Y => YES
char lastState = 'F'; // F => OFF, N => ON
char newState = 'F'; // F => OFF, N => ON
char lastColor = 'R'; // R => RED, G => GREEN
char newColor = 'R'; // R => RED, G => GREEN
int readStateRed = 0; //0 => pin D5 LOW, 1 => pin D5 HIGH
int readStateGreen = 0; //0 => pin D6 LOW, 1 => pin D6 HIGH

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]); // Print payload content
  }
  char powerState1 = (char)payload[35]; // Extracting the controlling command Power from the Payload to Control LED from AWS
  char powerState2 = (char)payload[36];
  char hue = (char)payload[36]; // Extracting the controlling command Color from the Payload to Control LED color

  Serial.print("hue command=");
  Serial.println(hue);
  Serial.print("powerState1 command=");
  Serial.println(powerState1);
  Serial.print("powerState2 command=");
  Serial.println(powerState2);

  //powerController (ON)
  if(powerState1 == 79 && powerState2 == 78) // 79 is the ASCI value of O, 78 is the ASCI value of N
  {
    if(lastColor == 'R'){
      digitalWrite(D6, LOW);
      digitalWrite(D5, HIGH);
      Serial.println("LED_State changed to HIGH (LED red)");
      newState = 'N'; //oN
    }
    else{
      digitalWrite(D5, LOW);
      digitalWrite(D6, HIGH);
      Serial.println("LED_State changed to HIGH (LED green)");
      newState = 'N'; //oN
    }
  }

  //colorController (green)
  //if changes to color green (hue=120...)
  else if(hue == 49) // 49 is the ASCII value of 1, in color green, hue=120
  {
    digitalWrite(D5, LOW);
    digitalWrite(D6, HIGH);
    Serial.println("LED_State changed to HIGH (LED green)");
    newState = 'N'; //oN
    newColor = 'G';
  }
  //colorController (red)
  else if (hue == 48) // 48 is the ASCII value of 0, in color RED, hue=0
  {
    digitalWrite(D5, HIGH);
    digitalWrite(D6, LOW);
    Serial.println("LED_State changed to HIGH (LED red)");
    newState = 'N'; //oN
    newColor = 'R';
  }
  // powerController (OFF)
  else if(powerState1 == 79 && powerState2 == 70) // 79 is the ASCI value of O, 70 is the ASCI value of F
  {
    digitalWrite(D5, LOW);
    digitalWrite(D6, LOW);
    Serial.println("LED_State changed to LOW");
    newState = 'F'; //oFf    
  }   
  Serial.println();
}

WiFiClientSecure espClient;
PubSubClient client(AWS_endpoint, 8883, callback, espClient); //set  MQTT port number to 8883 as per //standard
long lastMsg = 0;
char msg[50];
int value = 0;

void setup_wifi() {

  delay(10);
  // We start by connecting to a WiFi network
  espClient.setBufferSizes(512, 512);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());

  timeClient.begin();
  while(!timeClient.update()){
    timeClient.forceUpdate();
  }

  espClient.setX509Time(timeClient.getEpochTime());

}


void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("ESPthing-2")) {
      Serial.println("connected");
      // Once connected, publish an announcement...
      client.publish("outTopic", "hello world");
      // ... and resubscribe
      client.subscribe(MQTT_SUB_TOPIC);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");

      char buf[256];
      espClient.getLastSSLError(buf,256);
      Serial.print("WiFiClientSecure SSL error: ");
      Serial.println(buf);

      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}


void sendData()
{
  
  DynamicJsonDocument jsonBuffer(JSON_OBJECT_SIZE(3) + 100);
  JsonObject root = jsonBuffer.to<JsonObject>();
  JsonObject state = root.createNestedObject("state");
  JsonObject state_reported = state.createNestedObject("reported");
  
  readStateRed = digitalRead(D5); 
  readStateGreen = digitalRead(D6);

  if(readStateGreen == 0 && readStateRed == 0){
    state_reported["powerState"] = "OFF";
  }
  else{
    if(readStateGreen == 1){
      state_reported["powerState"] = "ON";
      state_reported["color"]["hue"] = 120;
      state_reported["color"]["saturation"] = 100;
      state_reported["color"]["brightness"] = 100;
    }
    else if (readStateRed == 1){
      state_reported["powerState"] = "ON";
      state_reported["color"]["hue"] = 0;
      state_reported["color"]["saturation"] = 100;
      state_reported["color"]["brightness"] = 100;
    }
  }
  
  serializeJson(root, Serial);
  Serial.println();
  char shadow[measureJson(root) + 1];
  serializeJson(root, shadow, sizeof(shadow));
  Serial.printf("Sending  [%s]: ", MQTT_PUB_TOPIC);
  if (!client.publish(MQTT_PUB_TOPIC, shadow, false)){
    Serial.println("Error publishing...");
  }
}

void setup() {

  Serial.begin(9600);
  Serial.setDebugOutput(true);
  // initialize digital pin LED_BUILTIN as an output.
  pinMode(D5, OUTPUT); //pin RED
  pinMode(D6, OUTPUT); // pin GREEN
  setup_wifi();
  delay(1000);
  if (!SPIFFS.begin()) {
    Serial.println("Failed to mount file system");
    return;
  }

  Serial.print("Heap: "); Serial.println(ESP.getFreeHeap());

  // Load certificate files
  //segunda-bombilla-cert
  File cert = SPIFFS.open("/segunda-bombilla-cert.der", "r"); //replace cert.crt eith your uploaded file name
  if (!cert) {
    Serial.println("Failed to open cert file");
  }
  else
    Serial.println("Success to open cert file");

  delay(1000);

  if (espClient.loadCertificate(cert))
    Serial.println("cert loaded");
  else
    Serial.println("cert not loaded");



  // Load private key files
  //segunda
  File private_key = SPIFFS.open("/segunda-bombilla-private.der", "r"); //replace private eith your uploaded file name
  if (!private_key) {
    Serial.println("Failed to open private cert file");
  }
  else
    Serial.println("Success to open private cert file");

  delay(1000);

  if (espClient.loadPrivateKey(private_key))
    Serial.println("private key loaded");
  else
    Serial.println("private key not loaded");


  // Load CA files
  //segunda
  File ca = SPIFFS.open("/segunda-bombilla-ca.der", "r"); //replace ca eith your uploaded file name
  if (!ca) {
    Serial.println("Failed to open ca ");
  }
  else
  Serial.println("Success to open ca");
  
  delay(1000);
  
  if(espClient.loadCACert(ca))
  Serial.println("ca loaded");
  else
  Serial.println("ca failed");
  
  Serial.print("Heap: "); Serial.println(ESP.getFreeHeap());

}



void loop() {

  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  if(lastState == newState && lastColor == newColor){
    updated = 'N';
  }
  else{
    updated = 'Y';
    lastState = newState;
    lastColor = newColor;
  }
  
  if(updated == 'Y'){
    sendData();
  }
}
