
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

// Receive ESP32 JSON
app.post("/data", async (req, res) => {

    try {

        const conc = req.body.conc;

        // Validate input
        if (
            conc === undefined ||
            conc === null ||
            conc === "" ||
            !Number.isFinite(Number(conc))
        ) {
            return res.status(400).json({
                error: "Invalid or missing concentration"
            });
        }

        // Convert to number and round to nearest 0.5
        let x = Number(conc);

let concentration = Math.max(
    0,
    Math.round(((0.00718116 * x) - 25.16279) * 2) / 2
);

        console.log("Received concentration:", concentration);

        // Insert into gas_readings_3
        const result = await pool.query(
            `INSERT INTO gas_readings_3 (concentration)
             VALUES ($1)
             RETURNING *`,
            [concentration]
        );

        console.log("Saved:", result.rows[0]);

        return res.status(200).json({
            message: "Reading saved successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error("DATABASE ERROR:", error.message);
        console.error("ERROR CODE:", error.code);
        console.error("ERROR DETAIL:", error.detail);

        return res.status(500).json({
            error: error.message,
            code: error.code
        });
    }
});

// Start server
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
