const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://localhost:1883");

const zoneId = "zone-3";

const commandTopic =
  `seed-storage/${zoneId}/controller/commands/+`;

const statusTopic =
  `seed-storage/${zoneId}/controller/status`;

const equipmentState = {
  ventilation: "off",
  cooling: "off",
  dehumidification: "off"
};

client.on("connect", () => {
  console.log("Controller connected to MQTT broker");

  client.subscribe(commandTopic, { qos: 1 }, (error) => {
    if (error) {
      console.error("Subscription failed:", error.message);
      return;
    }

    console.log(`Listening for commands on ${commandTopic}`);
  });
});

client.on("message", (topic, payload) => {
  try {
    const command = JSON.parse(payload.toString());

    const equipment = command.equipment;
    const state = command.state;

    if (!(equipment in equipmentState)) {
      return;
    }

    equipmentState[equipment] = state;

    console.log(`${equipment} → ${state}`);

    const status = {
      zoneId,
      equipment,
      state,
      commandId: command.commandId,
      timestamp: new Date().toISOString()
    };

    client.publish(
      statusTopic,
      JSON.stringify(status),
      { qos: 1 }
    );
  } catch (error) {
    console.error("Invalid command:", error.message);
  }
});