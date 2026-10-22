require("dotenv").config();

const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const mqtt = require("mqtt");

// MQTT connection
const mqttClient = mqtt.connect("mqtt://192.168.1.120:1883");

mqttClient.on("error", (error) => {
    console.error("MQTT error:", error.message);
});


// Insert Observation
router.post("/insert_observ", async (req, res) => {
    const { client_id, temperature, humidity, sound, date } = req.body;

    try {
        const client = await pool.query(
            "SELECT client_id FROM clients WHERE client_id = ?",
            [client_id]
        );

        if (client.length === 0) {
            return res.status(401).json({
                error: "Unauthorized device"
            });
        }

        await pool.query(
            "CALL insert_observation(?, ?, ?, ?, ?)",
            [client_id, temperature, humidity, sound, date]
        );

        res.status(201).json({
            message: "Observation inserted"
        });
    } catch (error) {
        console.error("Insert observation error:", error);

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
        console.error("Insert client error:", error);

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
        console.error("Insert location error:", error);

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

        const client_id = result?.[0]?.[0]?.client_id;

        if (client_id == null) {
            return res.status(404).json({
                error: "Client not found"
            });
        }

        res.status(200).json({
            client_id
        });
    } catch (error) {
        console.error("Get client ID error:", error);

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
        console.error("Get sensor settings error:", error);

        res.status(500).json({
            error: "Database error"
        });
    }
});


// Insert sensor settings
router.post("/insert_settings", async (req, res) => {
    const {
        client_id,
        database_interval,
        working_start,
        working_end,
        temperature_low,
        temperature_high,
        humidity_low,
        humidity_high,
        door_open_alarm_minutes   // ← tilføjet
    } = req.body;

    if (
        !client_id ||
        !Number.isInteger(Number(client_id)) ||
        !database_interval ||
        !working_start ||
        !working_end ||
        temperature_low === undefined ||
        temperature_high === undefined ||
        humidity_low === undefined ||
        humidity_high === undefined ||
        door_open_alarm_minutes === undefined   // ← tilføjet
    ) {
        return res.status(400).json({
            error: "Missing or invalid settings"
        });
    }

    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
        !timePattern.test(working_start) ||
        !timePattern.test(working_end)
    ) {
        return res.status(400).json({
            error: "Working hours must use HH:MM format"
        });
    }

    // ← ny validering af door_open_alarm_minutes
    const doorMinutes = Number(door_open_alarm_minutes);

    if (!Number.isInteger(doorMinutes) ||
        doorMinutes < 1 ||
        doorMinutes > 60) {
        return res.status(400).json({
            error: "Door alarm must be between 1 and 60 minutes"
        });
    }

    try {
        // ← rettet: proceduren tager 9 parametre, ikke 8
        await pool.query(
            "CALL insert_sensor_settings(?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                Number(client_id),
                Number(database_interval),
                Number(temperature_low),
                Number(temperature_high),
                Number(humidity_low),
                Number(humidity_high),
                working_start,
                working_end,
                doorMinutes
            ]
        );

        res.status(201).json({
            message: "Settings saved"
        });
    } catch (error) {
        console.error("Error saving sensor settings:", error);

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
        console.error("Get clients error:", error);

        res.status(500).json({
            error: "Database error"
        });
    }
});


router.post("/arrival", async (req, res) => {
    const { card_uid, client_name } = req.body;

    if (!card_uid || !client_name) {
        return res.status(400).json({
            access_granted: false,
            error_message: "Missing card UID or client name"
        });
    }

    try {
        // Find RFID reader ID
        const clientResult = await pool.query(
            "CALL get_clientid_by_clientname(?)",
            [client_name]
        );

        const clientId = clientResult?.[0]?.[0]?.client_id;

        if (clientId == null) {
            return res.status(404).json({
                access_granted: false,
                error_message: "RFID reader not found"
            });
        }

        // Load sensor settings BEFORE registering arrival
        const settingsResult = await pool.query(
            "CALL get_sensor_settings(?)",
            [clientId]
        );

        const settings = settingsResult?.[0]?.[0];

        if (!settings) {
            return res.status(500).json({
                access_granted: false,
                error_message: "No sensor settings found"
            });
        }

        if (
            settings.working_start == null ||
            settings.working_end == null
        ) {
            return res.status(500).json({
                access_granted: false,
                error_message: "Working hours are missing"
            });
        }

        const workingStart = String(settings.working_start).slice(0, 5);
        const workingEnd = String(settings.working_end).slice(0, 5);

        // Get Danish local time
        const currentTime = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Copenhagen",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).format(new Date());

        const toMinutes = (time) => {
            const [hours, minutes] = time.split(":").map(Number);
            return hours * 60 + minutes;
        };

        const current = toMinutes(currentTime);
        const start = toMinutes(workingStart);
        const end = toMinutes(workingEnd);

        // Support working hours crossing midnight
        const withinWorkingHours = start < end
            ? current >= start && current < end
            : start > end
                ? current >= start || current < end
                : false;

        // Outside working hours: trigger alarm and log denied access
        if (!withinWorkingHours) {
            const topic = `office/alarm/${client_name}`;

            if (mqttClient.connected) {
                mqttClient.publish(
                    topic,
                    "ALARM",
                    { qos: 1, retain: false },
                    (error) => {
                        if (error) {
                            console.error("MQTT publish failed:", error);
                        }
                    }
                );
            } else {
                console.error("MQTT disconnected; alarm was not published");
            }

            const result = await pool.query(
                "CALL register_arrival(?, ?)",
                [card_uid, client_name]
            );

            const employee = result?.[0]?.[0];

            return res.status(200).json({
                employee_id: employee?.employee_id ?? null,
                first_name: employee?.first_name ?? null,
                last_name: employee?.last_name ?? null,
                access_granted: false,
                error_message: "Access denied outside working hours"
            });
        }

        // Within working hours: register and check normal RFID access
        const result = await pool.query(
            "CALL register_arrival(?, ?)",
            [card_uid, client_name]
        );

        const employee = result?.[0]?.[0];

        if (!employee) {
            return res.status(500).json({
                access_granted: false,
                error_message: "No result from access control"
            });
        }

        return res.status(200).json({
            employee_id: employee.employee_id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            access_granted: Number(employee.access_granted) === 1,
            error_message: employee.error_message || null
        });

    } catch (error) {
        console.error("RFID arrival error:", error);

        return res.status(500).json({
            access_granted: false,
            error_message: error.message || "Database error"
        });
    }
});


// Get employees
router.get("/get_employees", async (req, res) => {
    try {
        const employees = await pool.query(`
            SELECT employee_id, first_name, last_name
            FROM employees
            ORDER BY first_name, last_name
        `);

        const safe = employees.map(e => ({
            employee_id: Number(e.employee_id),
            first_name: e.first_name,
            last_name: e.last_name
        }));

        res.status(200).json(safe);
    } catch (error) {
        console.error("Get employees error:", error);

        res.status(500).json({
            error: "Kunne ikke hente medarbejdere"
        });
    }
});


// Get locations
router.get("/locations", async (req, res) => {
    try {
        const result = await pool.query("CALL get_locations()");
        const locations = result[0];

        const safe = locations.map(loc => ({
            office_location_id: Number(loc.office_location_id),
            office_location_name: loc.office_location_name
        }));

        res.status(200).json(safe);
    } catch (error) {
        console.error("Get locations error:", error);

        res.status(500).json({
            error: "Kunne ikke hente lokationer"
        });
    }
});


// Create employee, assign RFID card and locations
router.post("/rfid/employees", async (req, res) => {
    const {
        first_name,
        last_name,
        password,
        card_uid,
        expiry_date,
        location_ids
    } = req.body;

    if (!first_name || !last_name || !password || !card_uid) {
        return res.status(400).json({
            error: "Udfyld alle obligatoriske felter."
        });
    }

    if (!Array.isArray(location_ids) || location_ids.length === 0) {
        return res.status(400).json({
            error: "Vælg mindst én lokation."
        });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(
            "CALL insert_employee(?, ?, ?)",
            [first_name, last_name, password]
        );

        const idResult = await connection.query(
            "SELECT LAST_INSERT_ID() AS employee_id"
        );

        const employee_id = Number(idResult[0].employee_id);

        await connection.query(
            "CALL assign_rfid_card(?, ?, ?)",
            [employee_id, card_uid, expiry_date || null]
        );

        for (const location_id of location_ids) {
            await connection.query(
                "CALL assign_employee_location(?, ?)",
                [employee_id, location_id]
            );
        }

        await connection.commit();

        res.status(201).json({
            message: "Medarbejderen blev oprettet.",
            employee_id
        });
    } catch (error) {
        await connection.rollback();

        console.error("Create employee error:", error);

        res.status(500).json({
            error: error.sqlMessage ||
                error.message ||
                "Kunne ikke oprette medarbejderen."
        });
    } finally {
        connection.release();
    }
});


// Get RFID card for an employee
router.get("/rfid/employees/:id/card", async (req, res) => {
    const employee_id = Number(req.params.id);

    if (!Number.isInteger(employee_id) || employee_id <= 0) {
        return res.status(400).json({
            error: "Ugyldigt medarbejder-ID."
        });
    }

    try {
        const cards = await pool.query(
            `SELECT
                rfid_card_id,
                card_uid,
                is_active,
                expiry_date
             FROM rfid_cards
             WHERE employee_id = ?
             LIMIT 1`,
            [employee_id]
        );

        if (cards.length === 0) {
            return res.status(200).json({
                card: null
            });
        }

        const card = cards[0];

        return res.status(200).json({
            card: {
                rfid_card_id: Number(card.rfid_card_id),
                card_uid: card.card_uid,
                is_active: Number(card.is_active),
                expiry_date: card.expiry_date
                    ? new Date(card.expiry_date).toISOString()
                    : null
            }
        });
    } catch (error) {
        console.error("Get RFID card error:", error);

        return res.status(500).json({
            error: "Kunne ikke hente RFID-kortet."
        });
    }
});


// Activate or deactivate an RFID card
router.patch("/rfid/cards/:id/status", async (req, res) => {
    const rfid_card_id = Number(req.params.id);
    const { is_active } = req.body;

    if (!Number.isInteger(rfid_card_id) || rfid_card_id <= 0) {
        return res.status(400).json({
            error: "Ugyldigt RFID-kort-ID."
        });
    }

    if (typeof is_active !== "boolean") {
        return res.status(400).json({
            error: "is_active skal være true eller false."
        });
    }

    try {
        const result = await pool.query(
            `UPDATE rfid_cards
             SET is_active = ?
             WHERE rfid_card_id = ?`,
            [is_active ? 1 : 0, rfid_card_id]
        );

        if (result.affectedRows === 0) {
            const cards = await pool.query(
                `SELECT rfid_card_id
                 FROM rfid_cards
                 WHERE rfid_card_id = ?`,
                [rfid_card_id]
            );

            if (cards.length === 0) {
                return res.status(404).json({
                    error: "RFID-kortet blev ikke fundet."
                });
            }
        }

        return res.status(200).json({
            message: is_active
                ? "RFID-kortet er aktiveret."
                : "RFID-kortet er deaktiveret.",
            rfid_card_id,
            is_active
        });
    } catch (error) {
        console.error("Update RFID status error:", error);

        res.status(500).json({
            error: "Kunne ikke ændre kortets status."
        });
    }
});

module.exports = router;