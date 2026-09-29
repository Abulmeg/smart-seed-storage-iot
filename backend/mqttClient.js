const mqtt = require("mqtt");
require("dotenv").config();

const MQTT_URL = "mqtt://localhost:1883";

const TELEMETRY_TOPIC = "seed-storage/+/+/telemetry";
const EQUIPMENT_STATUS_TOPIC = "seed-storage/+/controller/status";

function startMqttClient({ onReading, onEquipmentStatus }) {
  const client = mqtt.connect(MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  });
  client.on("connect", () => {
    console.log("Connected to MQTT broker");

    client.subscribe(
      [TELEMETRY_TOPIC, EQUIPMENT_STATUS_TOPIC],
      { qos: 1 },
      (error) => {
        if (error) {
          console.error("MQTT subscription failed:", error.message);
          return;
        }

        console.log("Subscribed to telemetry and equipment status");
      }
    );
  });

  client.on("message", (topic, payload) => {
    try {
      const message = JSON.parse(payload.toString());

      if (topic.endsWith("/telemetry")) {
        onReading(message, topic);
      }

      if (topic.endsWith("/controller/status")) {
        onEquipmentStatus(message, topic);
      }
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
  startMqttClient
};