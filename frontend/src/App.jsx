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

function App() {
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [connected, setConnected] = useState(false);

  const [equipment, setEquipment] = useState({
    ventilation: "unknown",
    cooling: "unknown",
    dehumidification: "unknown",
  });

  const [pendingEquipment, setPendingEquipment] = useState(null);

  async function sendEquipmentCommand(equipmentName, state) {
    setPendingEquipment(equipmentName);

    try {
      const response = await fetch(
        `http://localhost:3000/api/zones/zone-3/equipment/${equipmentName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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

      if (message.type === "snapshot") {
        if (message.data.telemetry) {
          setTelemetry(message.data.telemetry);
        }

        setEquipment(message.data.equipment);
      }

      if (message.type === "telemetry") {
        setTelemetry(message.data);
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
          </div>

          <div className="equipment-row">
            <div>
              <span>Cooling</span>
              <small>{equipment.cooling}</small>
            </div>

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
          </div>

          <div className="equipment-row">
            <div>
              <span>Dehumidification</span>
              <small>{equipment.dehumidification}</small>
            </div>

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
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
