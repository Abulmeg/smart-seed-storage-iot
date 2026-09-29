require("dotenv").config();
const mqtt = require("mqtt");

const MQTT_URL = "mqtt://localhost:1883";

const sensorId = "sensor-017";
const zoneId = "zone-3";

const topic = `seed-storage/${zoneId}/${sensorId}/telemetry`;

const client = mqtt.connect(MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

function randomValue(base, variation) {
  return Number(
    (base + (Math.random() - 0.5) * variation).toFixed(2)
  );
}

function createReading() {
  return {
    sensorId,
    zoneId,
    temperature: randomValue(26, 2),
    relativeHumidity: randomValue(61, 4),
    co2: randomValue(720, 80),
    lightIntensity: randomValue(320, 40),
    airQuality: randomValue(90, 8),
    timestamp: new Date().toISOString()
  };
}

client.on("connect", () => {
  console.log("Sensor connected to MQTT broker");
  console.log(`Publishing to ${topic}`);

  setInterval(() => {
    const reading = createReading();

    client.publish(
      topic,
      JSON.stringify(reading),
      { qos: 1 }
    );

    console.log(reading);
  }, 5000);
});

client.on("error", (error) => {
  console.error("MQTT error:", error.message);
});