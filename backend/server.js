const express = require("express");

const cors = require("cors");

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const pool = require("./db");
const { startMqttClient } = require("./mqttClient");

const {
  authenticateCredentials,
  createToken,
  authenticateToken,
  authorizeRoles,
} = require("./auth");

const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: "http://localhost:5173"
  })
);

app.use(express.json());

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws"
});

const equipmentState = {
  ventilation: "unknown",
  cooling: "unknown",
  dehumidification: "unknown"
};

const thresholds = {
  temperatureMax: 26.5,
  humidityMax: 63,
  co2Max: 760,
};

const sensorLastSeen = {};
const sensorDropoutActive = {};

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

wss.on("connection", async (socket) => {
  console.log("Dashboard connected by WebSocket");

  try {
    const result = await pool.query(`
  SELECT
    sensor_id AS "sensorId",
    zone_id AS "zoneId",
    temperature,
    relative_humidity AS "relativeHumidity",
    co2,
    light_intensity AS "lightIntensity",
    air_quality AS "airQuality",
    sensor_timestamp AS "timestamp",
    received_at AS "receivedAt"
    FROM sensor_readings
    ORDER BY received_at DESC
    LIMIT 1
  `);

    const latestTelemetry =
      result.rows.length > 0 ? result.rows[0] : null;

    socket.send(
      JSON.stringify({
        type: "snapshot",
        data: {
          telemetry: latestTelemetry,
          equipment: equipmentState
        }
      })
    );
  } catch (error) {
    console.error("Failed to send dashboard snapshot:", error.message);
  }
});

//const readings = [];

function checkThresholds(reading) {
  const alerts = [];

  if (reading.temperature > thresholds.temperatureMax) {
    alerts.push({
      type: "temperature",
      message: `Temperature exceeded ${thresholds.temperatureMax} °C`,
      value: reading.temperature,
      sensorId: reading.sensorId,
      timestamp: new Date().toISOString(),
    });
  }

  if (reading.relativeHumidity > thresholds.humidityMax) {
    alerts.push({
      type: "humidity",
      message: `Humidity exceeded ${thresholds.humidityMax}%`,
      value: reading.relativeHumidity,
      sensorId: reading.sensorId,
      timestamp: new Date().toISOString(),
    });
  }

  if (reading.co2 > thresholds.co2Max) {
    alerts.push({
      type: "co2",
      message: `CO₂ exceeded ${thresholds.co2Max} ppm`,
      value: reading.co2,
      sensorId: reading.sensorId,
      timestamp: new Date().toISOString(),
    });
  }

  return alerts;
}

function broadcastAlert(alert) {
  const message = JSON.stringify({
    type: "alert",
    data: alert,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}


const mqttClient = startMqttClient({
  onReading: async (reading) => {
    sensorLastSeen[reading.sensorId] = Date.now();
    sensorDropoutActive[reading.sensorId] = false;
    try {
      const receivedAt = new Date().toISOString();

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

      const alerts = checkThresholds(reading);

alerts.forEach((alert) => {
  const alertMessage = JSON.stringify({
    type: "alert",
    data: alert,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(alertMessage);
    }
  });

  console.log(`ALERT: ${alert.message}`);
});

      const message = JSON.stringify({
        type: "telemetry",
        data: {
          ...reading,
          receivedAt,
        },
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error("Failed to store reading:", error.message);
    }
  },

  onEquipmentStatus: (status) => {
  equipmentState[status.equipment] = status.state;

  console.log(
    `Equipment status: ${status.equipment} = ${status.state}`
  );

    const message = JSON.stringify({
      type: "equipment_status",
      data: status
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
});

setInterval(() => {
  const now = Date.now();

  Object.entries(sensorLastSeen).forEach(
    ([sensorId, lastSeen]) => {
      const secondsWithoutReading =
        (now - lastSeen) / 1000;

      if (
        secondsWithoutReading > 15 &&
        !sensorDropoutActive[sensorId]
      ) {
        sensorDropoutActive[sensorId] = true;

        const alert = {
          type: "sensor_dropout",
          message: "Sensor stopped reporting",
          sensorId,
          timestamp: new Date().toISOString(),
        };

        broadcastAlert(alert);

        console.log(
          `ALERT: ${sensorId} stopped reporting`
        );
      }
    }
  );
}, 5000);

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required",
    });
  }

  const user = await authenticateCredentials(
    username,
    password
  );

  if (!user) {
    return res.status(401).json({
      error: "Invalid username or password",
    });
  }

  const token = createToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

app.get("/api/me", authenticateToken, (req, res) => {
  res.json({
    user: req.user,
  });
});

app.get("/api/readings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM (
        SELECT
          sensor_id AS "sensorId",
          zone_id AS "zoneId",
          temperature,
          relative_humidity AS "relativeHumidity",
          co2,
          light_intensity AS "lightIntensity",
          air_quality AS "airQuality",
          sensor_timestamp AS "timestamp",
          received_at AS "receivedAt"
        FROM sensor_readings
        ORDER BY received_at DESC
        LIMIT 60
      ) AS latest_readings
      ORDER BY "receivedAt" ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Failed to load readings:",
      error.message
    );

    res.status(500).json({
      error: "Failed to load readings",
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

// app.post("/api/readings", (req, res) => {
//   const reading = req.body;

//   res.status(201).json({
//     message: "Reading received",
//     reading: reading
//   });
// });

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

app.post(
  "/api/zones/:zoneId/equipment/:equipment",
  authenticateToken,
  authorizeRoles("operator", "admin"),
  (req, res) => {
    const { zoneId, equipment } = req.params;
    const { state } = req.body;

    const allowedEquipment = [
      "ventilation",
      "cooling",
      "dehumidification"
    ];

    const allowedStates = ["on", "off"];

    if (!allowedEquipment.includes(equipment)) {
      return res.status(400).json({
        error: "Invalid equipment"
      });
    }

    if (!allowedStates.includes(state)) {
      return res.status(400).json({
        error: "State must be on or off"
      });
    }

    const commandId = Date.now().toString();

    const command = {
      commandId,
      equipment,
      state,
      requestedAt: new Date().toISOString()
    };

    const topic =
      `seed-storage/${zoneId}/controller/commands/${equipment}`;

    mqttClient.publish(
      topic,
      JSON.stringify(command),
      { qos: 1 },
      (error) => {
        if (error) {
          console.error("Failed to publish command:", error.message);
        }
      }
    );

    res.status(202).json({
      message: "Command accepted",
      commandId
    });
  }
);
server.listen(PORT, () => {
  console.log(`Seed Storage API running on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});