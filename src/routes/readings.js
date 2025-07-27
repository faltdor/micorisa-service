const express = require('express');
const router = express.Router();
const pool = require('../db');

const { v4: uuidv4 } = require('uuid');

// POST /readings
router.post('/', async (req, res) => {
    const readings = req.body;

    if (!Array.isArray(readings)) {
        return res.status(400).json({ error: 'Expected an array of readings' });
    }

    const saved = [];

    try {
        for (const reading of readings) {
            const { deviceName, sensorName, value, readAt } = reading;

            if (!deviceName || !sensorName || typeof value !== 'number') {
                return res.status(400).json({ error: 'Invalid input data in one of the readings' });
            }

            const id = uuidv4();
            const createdAt = new Date();
            const finalReadAt = readAt ? new Date(readAt) : createdAt;

            const result = await pool.query(
                `INSERT INTO sensor_reading (id, device_name, sensor_name, value, read_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                [id, deviceName, sensorName, value, finalReadAt, createdAt]
            );

            saved.push(result.rows[0]);
        }
        console.log('Record saved:', saved);
        res.status(201).json(saved);
    } catch (error) {
        console.error('Error inserting readings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/", async (req, res) => {
    const { deviceName, sensorName, from, to, groupBy } = req.query;

    try {
        const conditions = [];
        const params = [];

        // Filtros opcionales
        if (deviceName) {
            params.push(deviceName);
            conditions.push(`device_name = $${params.length}`);
        }

        if (sensorName) {
            params.push(sensorName);
            conditions.push(`sensor_name = $${params.length}`);
        }

        // Si from y to están vacíos, usar últimas 24 horas
        if (!from && !to) {
            conditions.push(`created_at >= NOW() - INTERVAL '24 hours'`);
        } else {
            if (from) {
                params.push(from);
                conditions.push(`created_at >= $${params.length}`);
            }
            if (to) {
                params.push(to);
                conditions.push(`created_at <= $${params.length}`);
            }
        }

        let select = `
            SELECT
                device_name,
                sensor_name,
                created_at,
                value AS avg_value
        `;

        let groupClause = "";
        if (groupBy === "hour") {
            select = `
                SELECT
                    device_name,
                    sensor_name,
                    DATE_TRUNC('hour', created_at) AS created_at,
                    AVG(value) AS avg_value
            `;
            groupClause = `GROUP BY device_name, sensor_name, DATE_TRUNC('hour', created_at)`;
        } else if (groupBy === "day") {
            select = `
                SELECT
                    device_name,
                    sensor_name,
                    DATE_TRUNC('day', created_at) AS created_at,
                    AVG(value) AS avg_value
            `;
            groupClause = `GROUP BY device_name, sensor_name, DATE_TRUNC('day', created_at)`;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const finalQuery = `
            ${select}
            FROM sensor_reading
            ${whereClause}
            ${groupClause}
            ORDER BY created_at ASC
        `;

        const result = await pool.query(finalQuery, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener lecturas:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener lista única de device_name
router.get("/devices", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT DISTINCT device_name FROM sensor_reading ORDER BY device_name ASC
    `);
        res.json(result.rows.map(row => row.device_name));
    } catch (err) {
        console.error("Error al obtener devices:", err);
        res.status(500).json({ error: "Error al obtener devices" });
    }
});

// Obtener lista única de sensor_name
router.get("/sensors", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT DISTINCT sensor_name FROM sensor_reading ORDER BY sensor_name ASC
    `);
        res.json(result.rows.map(row => row.sensor_name));
    } catch (err) {
        console.error("Error al obtener sensores:", err);
        res.status(500).json({ error: "Error al obtener sensores" });
    }
});

module.exports = router;
