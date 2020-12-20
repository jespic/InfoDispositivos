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
const char* AWS_endpoint = "XXXXXXXXX.iot.eu-west-1.amazonaws.com"; //MQTT broker ip
const char MQTT_SUB_TOPIC_UPDATE[] = "XXXXXXXXXXXX";
const char MQTT_PUB_TOPIC_UPDATE[] = "XXXXXXXXXXXX";
char updated = 'N'; // N => NO, Y => YES
char lastState = 'F'; // F => OFF, N => ON
char newState = 'F'; //F => OFF, N => ON


void callback(char* topic, byte* payload, unsigned int length) {
  int aux = 0;
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]); // Print payload content
  }
  char powerState1 = (char)payload[35]; // Extracting the controlling command from the Payload to Controlling LED from AWS
  char powerState2 = (char)payload[36];
  Serial.print("powerState1 command=");
  Serial.println(powerState1);
  Serial.print("powerState2 command=");
  Serial.println(powerState2);
  if(powerState1==79 && powerState2==78) // 79 is the ASCI value of O, 78 is the ASCI value of N
  {
    digitalWrite(D1, HIGH);
    Serial.println("LED_State changed to HIGH");
    newState = 'N';
  }
  else if(powerState1==79 && powerState2==70) // 79 is the ASCI value of O, 70 is the ASCI value of F
  {
    digitalWrite(D1, LOW);
    Serial.println("LED_State changed to LOW");
    newState = 'F';
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
    if (client.connect("ESPthing")) {
      Serial.println("connected");
      // Once connected, publish an announcement...
      client.publish("outTopic", "hello world");
      // ... and resubscribe
      client.subscribe(MQTT_SUB_TOPIC_UPDATE);
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
  int readState = digitalRead(D1);
  if(readState == 0){
    state_reported["powerState"] = "OFF";
  }
  else{
    state_reported["powerState"] = "ON";
  }
  serializeJson(root, Serial);
  Serial.println();
  char shadow[measureJson(root) + 1];
  serializeJson(root, shadow, sizeof(shadow));
  Serial.printf("Sending  [%s]: ", MQTT_PUB_TOPIC_UPDATE);
  if (!client.publish(MQTT_PUB_TOPIC_UPDATE, shadow, false)){
    Serial.println("Error publishing...");
  }
}

void setup() {

  Serial.begin(9600);
  Serial.setDebugOutput(true);
  // initialize digital pin as an output.
  pinMode(D1, OUTPUT);
  setup_wifi();
  delay(1000);
  if (!SPIFFS.begin()) {
    Serial.println("Failed to mount file system");
    return;
  }

  Serial.print("Heap: "); Serial.println(ESP.getFreeHeap());

  // Load certificate files
  //primera-bombilla-cert
  File cert = SPIFFS.open("/primera-bombilla-cert.der", "r"); //replace cert.crt eith your uploaded file name
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
  //primera
  File private_key = SPIFFS.open("/primera-bombilla-private.der", "r"); //replace private eith your uploaded file name
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
  //primera
  File ca = SPIFFS.open("/primera-bombilla-ca.der", "r"); //replace ca eith your uploaded file name
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
  if(lastState == newState){
    updated = 'N';
  }
  else{
    updated = 'Y';
    lastState = newState;
  }
  
  if(updated == 'Y'){
    sendData();
  }
}
