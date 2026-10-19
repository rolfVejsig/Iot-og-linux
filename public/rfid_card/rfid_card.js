const employeeForm = document.getElementById("employeeForm");
const employeeSelect = document.getElementById("employeeSelect");
const cardInfo = document.getElementById("cardInfo");
const toggleCardButton = document.getElementById("toggleCardButton");
const cardMessage = document.getElementById("cardMessage");

let selectedCard = null;


// Hent lokationer
async function getLocations() {
    const container = document.getElementById("locations");

    try {
        const response = await fetch("/clients/locations");

        if (!response.ok) {
            throw new Error("Could not load locations");
        }

        const locations = await response.json();
        container.replaceChildren();

        if (!Array.isArray(locations) || locations.length === 0) {
            container.textContent = "No locations found";
            return;
        }

        locations.forEach(location => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.name = "location";
            checkbox.value = location.office_location_id;

            label.appendChild(checkbox);
            label.appendChild(
                document.createTextNode(
                    " " + location.office_location_name
                )
            );

            container.appendChild(label);
        });

    } catch (error) {
        console.error(error);
        container.textContent = "Could not load locations";
    }
}


// Opret medarbejder og RFID-kort
employeeForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const first_name =
        document.getElementById("first_name").value.trim();

    const last_name =
        document.getElementById("last_name").value.trim();

    const password =
        document.getElementById("password").value;

    const card_uid =
        document.getElementById("card_uid").value.trim();

    const expiry_date =
        document.getElementById("expiry_date").value;

    const location_ids = Array.from(
        document.querySelectorAll(
            '#locations input[type="checkbox"]:checked'
        )
    ).map(checkbox => Number(checkbox.value));

    const message = document.getElementById("message");

    if (!/^[0-9A-Fa-f]{4,16}$/.test(password)) {
        message.textContent =
            "Password must contain 4-16 hexadecimal characters.";
        return;
    }

    if (location_ids.length === 0) {
        message.textContent = "Select at least one location.";
        return;
    }

    const data = {
        first_name,
        last_name,
        password,
        card_uid,
        expiry_date: expiry_date || null,
        location_ids
    };

    const saveButton = document.getElementById("saveButton");
    saveButton.disabled = true;

    try {
        const response = await fetch("/clients/rfid/employees", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not create employee"
            );
        }

        message.textContent = "Employee created successfully.";

        employeeForm.reset();

        await loadEmployees();

    } catch (error) {
        console.error(error);
        message.textContent = "Error: " + error.message;

    } finally {
        saveButton.disabled = false;
    }
});


// Hent medarbejdere til dropdown
async function loadEmployees() {
    try {
        const response = await fetch("/clients/get_employees");

        if (!response.ok) {
            throw new Error("Could not load employees");
        }

        const employees = await response.json();

        employeeSelect.replaceChildren();

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select employee";
        employeeSelect.appendChild(defaultOption);

        employees.forEach(employee => {
            const option = document.createElement("option");

            option.value = employee.employee_id;
            option.textContent =
                employee.first_name + " " + employee.last_name;

            employeeSelect.appendChild(option);
        });

    } catch (error) {
        console.error(error);
        cardMessage.textContent = "Could not load employees.";
    }
}


// Hent kort for den valgte medarbejder
async function loadEmployeeCard() {
    const employeeId = employeeSelect.value;

    selectedCard = null;
    toggleCardButton.disabled = true;
    cardMessage.textContent = "";

    if (!employeeId) {
        cardInfo.textContent =
            "Select an employee to view their RFID card.";
        return;
    }

    cardInfo.textContent = "Loading card...";

    try {
        const response = await fetch(
            "/clients/rfid/employees/" +
            encodeURIComponent(employeeId) +
            "/card"
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not load card"
            );
        }

        if (!result.card) {
            cardInfo.textContent =
                "This employee has no RFID card.";
            return;
        }

        selectedCard = result.card;

        const uidLabel = document.createElement("p");
        uidLabel.textContent = "Card UID: " + selectedCard.card_uid;

        const expiryLabel = document.createElement("p");
        expiryLabel.textContent =
            "Expiry date: " +
            (selectedCard.expiry_date || "No expiry date");

        const statusLabel = document.createElement("p");
        statusLabel.className = "status";

        const isActive =
            Number(selectedCard.is_active) === 1;

        statusLabel.classList.add(
            isActive ? "active" : "inactive"
        );

        statusLabel.textContent =
            "Status: " + (isActive ? "Active" : "Deactivated");

        cardInfo.replaceChildren(
            uidLabel,
            expiryLabel,
            statusLabel
        );

        toggleCardButton.disabled = false;

        toggleCardButton.textContent =
            isActive ? "Deactivate card" : "Activate card";

        toggleCardButton.className =
            isActive ? "deactivate" : "activate";

        // En udløbet kort kan ikke aktiveres ved kun at ændre is_active. Udløbsdatoen skal også ændres.
        if (
            selectedCard.expiry_date &&
            new Date(
                selectedCard.expiry_date.replace(" ", "T")
            ) <= new Date()
        ) {
            const expiredLabel = document.createElement("p");
            expiredLabel.className = "status inactive";
            expiredLabel.textContent = "Card has expired.";
            cardInfo.appendChild(expiredLabel);

            if (!isActive) {
                toggleCardButton.disabled = true;
            }
        }

    } catch (error) {
        console.error(error);
        cardInfo.textContent = error.message;
    }
}


// Aktivér eller deaktivér kort
toggleCardButton.addEventListener("click", async function() {
    if (!selectedCard) {
        return;
    }

    const currentlyActive =
        Number(selectedCard.is_active) === 1;

    const action = currentlyActive ? "deactivate" : "activate";

    const confirmation = confirm(
        "Are you sure you want to " +
        action +
        " this RFID card?"
    );

    if (!confirmation) {
        return;
    }

    toggleCardButton.disabled = true;
    cardMessage.textContent = "Updating card...";

    try {
        const response = await fetch(
            "/clients/rfid/cards/" +
            encodeURIComponent(selectedCard.rfid_card_id) +
            "/status",
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    is_active: !currentlyActive
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not update card"
            );
        }

        cardMessage.textContent =
            "Card status updated successfully.";

        await loadEmployeeCard();

    } catch (error) {
        console.error(error);
        cardMessage.textContent = "Error: " + error.message;
        toggleCardButton.disabled = false;
    }
});


employeeSelect.addEventListener(
    "change",
    loadEmployeeCard
);


// Indlæs data
getLocations();
loadEmployees();