const pool = require("./db");
const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

const { startMqttSubscriber } = require("./mqttClient");
const readings = [];

const sensors = [
  {
    id: "sensor-017",
    zoneId: "zone-3",
    temperature: 26.4,
    humidity: 62.1,
    co2: 742,
    light: 318,
    airQuality: 91
  },
  {
    id: "sensor-018",
    zoneId: "zone-3",
    temperature: 25.8,
    humidity: 60.4,
    co2: 710,
    light: 301,
    airQuality: 94
  }
];

startMqttSubscriber((reading, topic) => {
  const storedReading = {
    ...reading,
    topic,
    receivedAt: new Date().toISOString()
  };

  readings.push(storedReading);

  console.log(
    `${reading.sensorId}: ${reading.temperature} °C`
  );
});

app.get("/api/readings", (req, res) => {
  res.json(readings);
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "seed-storage-api"
  });
});

app.get("/api/sensors", (req, res) => {
  res.json(sensors);
});

app.get("/api/sensors/:id", (req, res) => {
  const sensor = sensors.find((sensor) => {
    return sensor.id === req.params.id;
  });

  if (!sensor) {
    return res.status(404).json({
      error: "Sensor not found"
    });
  }

  res.json(sensor);
});

app.post("/api/readings", (req, res) => {
  const reading = req.body;

  res.status(201).json({
    message: "Reading received",
    reading: reading
  });
});

app.get("/api/db-health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      status: "ok",
      databaseTime: result.rows[0].current_time
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);

    res.status(500).json({
      status: "error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Seed Storage API running on http://localhost:${PORT}`);
});