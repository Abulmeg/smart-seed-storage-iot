import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import "./index.css";

const initialTelemetry = {
  sensorId: "-",
  zoneId: "-",
  temperature: null,
  relativeHumidity: null,
  co2: null,
  lightIntensity: null,
  airQuality: null,
  timestamp: null,
  receivedAt: null,
};

function Metric({ label, value, unit }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>

      <div className="metric-value">
        {value ?? "--"}
        {value !== null && <span className="metric-unit">{unit}</span>}
      </div>
    </div>
  );
}

function Login({ onLogin, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onLogin(username, password);
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Seed Storage Control</h1>
        <p>Sign in to access the monitoring system</p>

        <label>
          Username
          <input
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
          />
        </label>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <button type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}

function App() {
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [equipment, setEquipment] = useState({
    ventilation: "unknown",
    cooling: "unknown",
    dehumidification: "unknown",
  });

  const [token, setToken] = useState(
  sessionStorage.getItem("token")
);

const [user, setUser] = useState(() => {
  const savedUser = sessionStorage.getItem("user");
  return savedUser ? JSON.parse(savedUser) : null;
});

const [loginError, setLoginError] = useState("");

  const [pendingEquipment, setPendingEquipment] = useState(null);

  async function login(username, password) {
  setLoginError("");

  try {
    const response = await fetch(
      "http://localhost:3000/api/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Invalid username or password");
    }

    const data = await response.json();

    setToken(data.token);
    setUser(data.user);

    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );
  } catch (error) {
    setLoginError(error.message);
  }
}

function logout() {
  setToken(null);
  setUser(null);

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}

  async function sendEquipmentCommand(equipmentName, state) {
    setPendingEquipment(equipmentName);

    try {
      const response = await fetch(
        `http://localhost:3000/api/zones/zone-3/equipment/${equipmentName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            state,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Command failed");
      }
    } catch (error) {
      console.error(error);
      setPendingEquipment(null);
    }
  }

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000/ws");

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "alert") {
          setAlerts((current) => {
            return [message.data, ...current].slice(0, 10);
        });
      }

      if (message.type === "snapshot") {
        if (message.data.telemetry) {
          setTelemetry(message.data.telemetry);
        }

        setEquipment(message.data.equipment);
      }

      if (message.type === "telemetry") {
  setTelemetry(message.data);

  setHistory((current) => {
    const updated = [...current, message.data];

    return updated.slice(-60);
      });
    }

      if (message.type === "equipment_status") {
        setEquipment((current) => ({
          ...current,
          [message.data.equipment]: message.data.state,
        }));

        setPendingEquipment(null);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
  async function loadHistory() {
    try {
      const response = await fetch(
        "http://localhost:3000/api/readings"
      );

      if (!response.ok) {
        throw new Error("Failed to load history");
      }

      const readings = await response.json();

      setHistory(readings);
    } catch (error) {
      console.error(error);
    }
  }

  loadHistory();
}, []);

  if (!token || !user) {
  return (
    <Login
      onLogin={login}
      error={loginError}
    />
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Seed Storage Control</h1>
          <p>Environmental monitoring and control</p>
        </div>

        <div className={`connection ${connected ? "online" : "offline"}`}>
          <span className="status-dot" />
          {connected ? "Live" : "Disconnected"}
        </div>
        <div className="topbar-actions">
  <span className="user-info">
    {user.username} · {user.role}
  </span>

  <div
    className={`connection ${
      connected ? "online" : "offline"
    }`}
  >
    <span className="status-dot" />
    {connected ? "Live" : "Disconnected"}
  </div>

  <button
    className="logout-button"
    onClick={logout}
  >
    Sign out
  </button>
</div>
      </header>

      <section className="section-header">
        <div>
          <h2>{telemetry.zoneId !== "-" ? telemetry.zoneId : "Zone"}</h2>
          <p>Sensor {telemetry.sensorId}</p>
        </div>

        <div className="updated">
          Last update
          <strong>
            {telemetry.receivedAt
              ? new Date(telemetry.receivedAt).toLocaleTimeString()
              : "--"}
          </strong>
        </div>
      </section>

      <section className="metrics-grid">
        <Metric label="Temperature" value={telemetry.temperature} unit="°C" />

        <Metric
          label="Relative humidity"
          value={telemetry.relativeHumidity}
          unit="%"
        />

        <Metric label="CO₂" value={telemetry.co2} unit="ppm" />

        <Metric
          label="Light intensity"
          value={telemetry.lightIntensity}
          unit="lx"
        />

        <Metric label="Air quality" value={telemetry.airQuality} unit="" />
      </section>

              <section className="panel history-panel">
  <div className="panel-header">
    <div>
      <h2>Historical trends</h2>
      <p>Recent environmental readings</p>
    </div>
  </div>

  <div className="chart-container">
    {history.length === 0 ? (
      <div className="chart-empty">
        No historical readings available
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={history}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
          />

          <XAxis
            dataKey="receivedAt"
            tickFormatter={(value) =>
              new Date(value).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            }
            minTickGap={28}
          />

          <YAxis yAxisId="temperature" width={45} />

          <YAxis
            yAxisId="humidity"
            orientation="right"
            width={45}
          />

          <Tooltip
            labelFormatter={(value) =>
              new Date(value).toLocaleString()
            }
          />

          <Legend />

          <Line
            yAxisId="temperature"
            type="monotone"
            dataKey="temperature"
            name="Temperature °C"
            stroke="#333333"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          <Line
            yAxisId="humidity"
            type="monotone"
            dataKey="relativeHumidity"
            name="Humidity %"
            stroke="#777777"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    )}
  </div>
</section>
      <section className="panel alerts-panel">
  <div className="panel-header">
    <div>
      <h2>Alerts</h2>
      <p>Environmental threshold warnings</p>
    </div>
  </div>

  <div className="alerts-list">
    {alerts.length === 0 ? (
      <div className="alert-empty">
        No active alerts
      </div>
    ) : (
      alerts.map((alert, index) => (
        <div className="alert-row" key={`${alert.timestamp}-${index}`}>
          <div>
            <strong>{alert.message}</strong>
            <small>Sensor {alert.sensorId}</small>
          </div>

          <span>
            {new Date(alert.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))
    )}
  </div>
</section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Equipment</h2>
            <p>Environmental control equipment</p>
          </div>
        </div>

        <div className="equipment-list">
          <div className="equipment-row">
            <div>
              <span>Ventilation</span>
              <small>{equipment.ventilation}</small>
            </div>

            {user.role !== "viewer" && (
            <button
              disabled={pendingEquipment === "ventilation"}
              onClick={() =>
                sendEquipmentCommand(
                  "ventilation",
                  equipment.ventilation === "on" ? "off" : "on",
                )
              }
            >
              {pendingEquipment === "ventilation"
                ? "Waiting..."
                : equipment.ventilation === "on"
                  ? "Turn off"
                  : "Turn on"}
            </button>
            )}
          </div>

          <div className="equipment-row">
            <div>
              <span>Cooling</span>
              <small>{equipment.cooling}</small>
            </div>

            {user.role !== "viewer" && (
            <button
              disabled={pendingEquipment === "cooling"}
    onClick={() =>
      sendEquipmentCommand(
        "cooling",
        equipment.cooling === "on" ? "off" : "on",
      )
    }
  >
    {pendingEquipment === "cooling"
      ? "Waiting..."
      : equipment.cooling === "on"
        ? "Turn off"
        : "Turn on"}
            </button>
            )}
          </div>

          <div className="equipment-row">
            <div>
              <span>Dehumidification</span>
              <small>{equipment.dehumidification}</small>
            </div>

            {user.role !== "viewer" && (
  <button
    disabled={pendingEquipment === "dehumidification"}
    onClick={() =>
      sendEquipmentCommand(
        "dehumidification",
        equipment.dehumidification === "on" ? "off" : "on",
      )
    }
  >
    {pendingEquipment === "dehumidification"
      ? "Waiting..."
      : equipment.dehumidification === "on"
        ? "Turn off"
        : "Turn on"}
  </button>
)}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
