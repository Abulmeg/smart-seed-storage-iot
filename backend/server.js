const pool = require("./db");
const express = require("express");

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();
const PORT = 3000;

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws"
});

wss.on("connection", (socket) => {
  console.log("Dashboard connected by WebSocket");
});

app.use(express.json());

const { startMqttSubscriber } = require("./mqttClient");
//const readings = [];

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

startMqttSubscriber(async (reading) => {
  try {
    await pool.query(
      `INSERT INTO sensor_readings (
        sensor_id,
        zone_id,
        temperature,
        relative_humidity,
        co2,
        light_intensity,
        air_quality,
        sensor_timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        reading.sensorId,
        reading.zoneId,
        reading.temperature,
        reading.relativeHumidity,
        reading.co2,
        reading.lightIntensity,
        reading.airQuality,
        reading.timestamp
      ]
    );

    console.log(
      `Stored ${reading.sensorId}: ${reading.temperature} °C`
    );

    // Send the same new reading to all connected WebSocket clients
    const message = JSON.stringify({
      type: "telemetry",
      data: reading
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

  } catch (error) {
    console.error("Failed to store reading:", error.message);
  }
});

app.get("/api/readings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM sensor_readings
      ORDER BY sensor_timestamp DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to load readings:", error.message);

    res.status(500).json({
      error: "Failed to load readings"
    });
  }
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

server.listen(PORT, () => {
  console.log(`Seed Storage API running on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});