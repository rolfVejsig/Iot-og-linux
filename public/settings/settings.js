async function getClients() {
    try {
        const response = await fetch("/clients/get_clients");

        if (!response.ok) {
            throw new Error("Could not load clients");
        }

        const clients = await response.json();
        const select = document.getElementById("client");

        clients.forEach(client => {
            const option = document.createElement("option");

            option.value = client.client_id;
            option.textContent = client.client_name;

            select.appendChild(option);
        });

    } catch (error) {
        console.error(error);
        alert("Could not load clients");
    }
}


// Load settings for the selected client.

document.getElementById("client").addEventListener(
    "change",
    async function () {

        const selectedClientID = this.value;

        if (!selectedClientID) {
            return;
        }

        try {
            const response = await fetch(
                "/clients/settings/" + selectedClientID
            );

            if (!response.ok) {
                throw new Error("Could not load settings");
            }

            const result = await response.json();

            // Reset defaults before loading settings.
            document.getElementById("database_interval").value = 10;
            document.getElementById("temperature_low").value = 18;
            document.getElementById("temperature_high").value = 21;
            document.getElementById("humidity_low").value = 30;
            document.getElementById("humidity_high").value = 50;
            document.getElementById("working_start").value = "08:00";
            document.getElementById("working_end").value = "18:00";
            document.getElementById("door_open_alarm_minutes").value = 3;

            if (result.length > 0) {
                const settings = result[0];

                document.getElementById("database_interval").value =
                    settings.database_interval;

                document.getElementById("temperature_low").value =
                    settings.temperature_low;

                document.getElementById("temperature_high").value =
                    settings.temperature_high;

                document.getElementById("humidity_low").value =
                    settings.humidity_low;

                document.getElementById("humidity_high").value =
                    settings.humidity_high;

                document.getElementById("working_start").value =
                    settings.working_start || "08:00";

                document.getElementById("working_end").value =
                    settings.working_end || "18:00";

                document.getElementById("door_open_alarm_minutes").value =
                    settings.door_open_alarm_minutes ?? 3;
            }

        } catch (error) {
            console.error(error);
            alert("Could not load settings");
        }
    }
);


// Save settings.

document.getElementById("saveButton").addEventListener(
    "click",
    async function () {

        const client_id = Number(
            document.getElementById("client").value
        );

        if (!client_id) {
            alert("Select a client");
            return;
        }

        const doorMinutes = Number(
            document.getElementById("door_open_alarm_minutes").value
        );

        if (!Number.isInteger(doorMinutes) ||
            doorMinutes < 1 ||
            doorMinutes > 60) {

            alert("Door alarm must be between 1 and 60 minutes");
            return;
        }

        const data = {
            client_id: client_id,

            working_start:
                document.getElementById("working_start").value,

            working_end:
                document.getElementById("working_end").value,

            database_interval:
                Number(document.getElementById("database_interval").value),

            temperature_low:
                Number(document.getElementById("temperature_low").value),

            temperature_high:
                Number(document.getElementById("temperature_high").value),

            humidity_low:
                Number(document.getElementById("humidity_low").value),

            humidity_high:
                Number(document.getElementById("humidity_high").value),

            door_open_alarm_minutes: doorMinutes
        };

        try {
            const response = await fetch("/clients/insert_settings", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.status === 201) {
                alert("Settings saved");
            } else {
                alert("Error: " + (result.error || "Could not save settings"));
            }

        } catch (error) {
            console.error(error);
            alert("Could not connect to API");
        }
    }
);

getClients();
