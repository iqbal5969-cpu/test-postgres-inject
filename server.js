
require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Create table
async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS gas_readings_3 (
            id SERIAL PRIMARY KEY,
            time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            concentration NUMERIC(6,1) NOT NULL
        );
    `);

    console.log("Database table is ready.");
}

// Wait for ESP32 JSON at POST /data
app.post("/data", async (req, res) => {
    try {
        // Convert incoming JSON value to a JavaScript number
        let concentration = Number(req.body.conc);

        if (req.body.conc === undefined ||
            req.body.conc === null ||
            req.body.conc === "" ||
            !Number.isFinite(concentration)) {
            return res.status(400).json({
                error: "Invalid or missing conc value"
            });
        }

        // Prevent negative readings and round to nearest 0.5
        concentration = Math.max(
            0,
            Math.round(concentration * 2) / 2
        );

        // Insert numeric value into PostgreSQL
        const result = await pool.query(
            `INSERT INTO gas_readings_3 (concentration)
             VALUES ($1)
             RETURNING *`,
            [concentration]
        );

        console.log("Saved:", result.rows[0]);

        res.status(200).json({
            message: "Reading saved",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error:", error.message);

        res.status(500).json({
            error: "Failed to save reading"
        });
    }
});

// Initialize database before accepting requests
async function startServer() {
    try {
        await initializeDatabase();

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
            console.log("Waiting for ESP32 data at POST /data");
        });
    } catch (error) {
        console.error("Startup failed:", error.message);
        await pool.end();
        process.exit(1);
    }
}

startServer();
