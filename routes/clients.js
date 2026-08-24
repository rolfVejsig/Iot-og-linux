require("dotenv").config();
const express = require("express");
const router = express.Router();
const pool = require("../database/db");


// Insert Observation
router.post("/insert_observ", async (req, res) => {

    const { client_id, temperature, humidity, sound, date } = req.body;

    try {

        // Tjek om client eksisterer
        const client = await pool.query(
            "SELECT client_id FROM clients WHERE client_id = ?",
            [client_id]
        );

        // Ukendt client
        if (client.length === 0) {
            return res.status(401).json({
                error: "Unauthorized device"
            });
        }

        // Client er godkendt
        await pool.query(
            "CALL insert_observation(?, ?, ?, ?, ?)",
            [client_id, temperature, humidity, sound, date]
        );

        res.status(201).json({
            message: "Observation inserted"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database error"
        });

    }

});

// Insert Client
router.post("/insert_client", async (req, res) => {

    const { office_id, client_name } = req.body;

    try {

        await pool.query(
            "CALL insert_client(?, ?)",
            [office_id, client_name]
        );

        res.status(201).json({
            message: "Client inserted"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database error"
        });

    }

});


// Insert Location
router.post("/insert_location", async (req, res) => {

    const { office_name } = req.body;

    try {

        await pool.query(
            "CALL insert_office_location(?)",
            [office_name]
        );

        res.status(201).json({
            message: "Location inserted"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database error"
        });

    }

});

// Get Client ID
router.get("/get_client_id/:client_name", async (req, res) => {

    const client_name = req.params.client_name;

    try {

        const result = await pool.query(
            "CALL get_clientid_by_clientname(?)",
            [client_name]
        );

        const client_id = result[0][0].client_id;

        res.status(200).json({
            client_id: client_id
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database error"
        });

    }

});



// Get sensor settings
router.get("/settings/:client_id", async (req, res) => {

    const client_id = req.params.client_id;

    try {

        const result = await pool.query(
            "CALL get_sensor_settings(?)",
            [client_id]
        );

        res.status(200).json(result[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database error"
        });

    }

});


// Insert sensor settings
router.post("/insert_settings", async (req, res) => {

    const {client_id, database_interval, monitoring_start, monitoring_end, 
        temperature_low, temperature_high, humidity_low, humidity_high, sound_low, sound_high} = req.body;

    try {

        await pool.query(
            "CALL insert_sensor_settings(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [client_id, database_interval,monitoring_start, monitoring_end, 
                temperature_low, temperature_high, humidity_low, humidity_high, sound_low,sound_high]
        );

        res.status(201).json({
            message: "Settings saved"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database error"
        });

    }

});

// Get all clients
router.get("/get_clients", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT client_id, client_name FROM clients"
        );

        res.status(200).json(result);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database error"
        });

    }

});

module.exports = router;