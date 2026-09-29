const mqtt = require("mqtt");

const MQTT_URL = "mqtt://localhost:1883";
const TELEMETRY_TOPIC = "seed-storage/+/+/telemetry";

function startMqttSubscriber(onReading) {
  const client = mqtt.connect(MQTT_URL);

  client.on("connect", () => {
    console.log("Connected to MQTT broker");

    client.subscribe(TELEMETRY_TOPIC, { qos: 1 }, (error) => {
      if (error) {
        console.error("Failed to subscribe:", error.message);
        return;
      }

      console.log(`Subscribed to ${TELEMETRY_TOPIC}`);
    });
  });

  client.on("message", (topic, payload) => {
    try {
      const reading = JSON.parse(payload.toString());

      onReading(reading, topic);
    } catch (error) {
      console.error("Invalid MQTT message:", error.message);
    }
  });

  client.on("error", (error) => {
    console.error("MQTT error:", error.message);
  });

  return client;
}

module.exports = {
  startMqttSubscriber
};