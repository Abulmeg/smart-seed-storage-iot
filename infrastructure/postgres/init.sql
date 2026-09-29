CREATE TABLE IF NOT EXISTS sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) NOT NULL,
    zone_id VARCHAR(50) NOT NULL,

    temperature DOUBLE PRECISION NOT NULL,
    relative_humidity DOUBLE PRECISION NOT NULL,
    co2 DOUBLE PRECISION NOT NULL,
    light_intensity DOUBLE PRECISION NOT NULL,
    air_quality DOUBLE PRECISION NOT NULL,

    sensor_timestamp TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);