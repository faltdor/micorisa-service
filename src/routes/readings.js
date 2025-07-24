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
            const { deviceName, sensorName, value } = reading;

            if (!deviceName || !sensorName || typeof value !== 'number') {
                return res.status(400).json({ error: 'Invalid input data in one of the readings' });
            }

            const id = uuidv4();

            const result = await pool.query(
                `INSERT INTO sensor_reading (id, device_name, sensor_name, value)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [id, deviceName, sensorName, value]
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
        let query = `
            SELECT
                device_name,
                sensor_name,
                created_at,
                value AS avg_value
            FROM sensor_reading
            WHERE 1 = 1
        `;
        const params = [];

        if (deviceName) {
            params.push(deviceName);
            query += ` AND device_name = $${params.length}`;
        }

        if (sensorName) {
            params.push(sensorName);
            query += ` AND sensor_name = $${params.length}`;
        }

        if (from) {
            params.push(from);
            query += ` AND created_at >= $${params.length}`;
        }

        if (to) {
            params.push(to);
            query += ` AND created_at <= $${params.length}`;
        }

        if (groupBy === "hour") {
            query = `
                SELECT 
                    device_name, 
                    sensor_name,
                    DATE_TRUNC('hour', created_at) AS created_at,
                    AVG(value) AS avg_value
                FROM sensor_reading
                WHERE 1 = 1
                    ${deviceName ? ` AND device_name = $1` : ''}
                    ${sensorName ? ` AND sensor_name = $2` : ''}
                    ${from ? ` AND created_at >= $3` : ''}
                    ${to ? ` AND created_at <= $4` : ''}
                GROUP BY device_name, sensor_name, DATE_TRUNC('hour', created_at)
                ORDER BY created_at ASC
            `;
        }

        if (groupBy === "day") {
            query = `
                SELECT 
                    device_name, 
                    sensor_name,
                    DATE_TRUNC('day', created_at) AS created_at,
                    AVG(value) AS avg_value
                FROM sensor_reading
                WHERE 1 = 1
                    ${deviceName ? ` AND device_name = $1` : ''}
                    ${sensorName ? ` AND sensor_name = $2` : ''}
                    ${from ? ` AND created_at >= $3` : ''}
                    ${to ? ` AND created_at <= $4` : ''}
                GROUP BY device_name, sensor_name, DATE_TRUNC('day', created_at)
                ORDER BY created_at ASC
            `;
        }

        const result = await pool.query(query, params);
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
