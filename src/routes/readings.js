const express = require('express');
const router = express.Router();
const pool = require('../db');

const { v4: uuidv4 } = require('uuid');

// POST /readings
router.post('/', async (req, res) => {
    const { deviceName, sensorName, value } = req.body;

    if (!deviceName || !sensorName || typeof value !== 'number') {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    const id = uuidv4();

    try {
        const result = await pool.query(
            `INSERT INTO sensor_reading (id, device_name, sensor_name, value)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, deviceName, sensorName, value]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error inserting reading:', error);
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

module.exports = router;
