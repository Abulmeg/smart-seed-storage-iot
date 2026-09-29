import { useEffect, useState } from "react";
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

function App() {
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000/ws");

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "telemetry") {
        setTelemetry(message.data);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

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
      </header>

      <section className="section-header">
        <div>
          <h2>{telemetry.zoneId !== "-" ? telemetry.zoneId : "Zone"}</h2>
          <p>Sensor {telemetry.sensorId}</p>
        </div>

        <div className="updated">
          Last update
          <strong>
            {telemetry.timestamp
              ? new Date(telemetry.timestamp).toLocaleTimeString()
              : "--"}
          </strong>
        </div>
      </section>

      <section className="metrics-grid">
        <Metric
          label="Temperature"
          value={telemetry.temperature}
          unit="°C"
        />

        <Metric
          label="Relative humidity"
          value={telemetry.relativeHumidity}
          unit="%"
        />

        <Metric
          label="CO₂"
          value={telemetry.co2}
          unit="ppm"
        />

        <Metric
          label="Light intensity"
          value={telemetry.lightIntensity}
          unit="lx"
        />

        <Metric
          label="Air quality"
          value={telemetry.airQuality}
          unit=""
        />
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
            <span>Ventilation</span>
            <strong>Off</strong>
          </div>

          <div className="equipment-row">
            <span>Cooling</span>
            <strong>Off</strong>
          </div>

          <div className="equipment-row">
            <span>Dehumidification</span>
            <strong>Off</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;