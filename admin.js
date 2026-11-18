
const loginForm = document.getElementById("adminLoginForm");
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginMessage = document.getElementById("loginMessage");
const dashboardMessage = document.getElementById("dashboardMessage");

const loginButton = document.getElementById("loginButton");

let adminPassword = "";

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    adminPassword = document.getElementById("adminPassword").value;

    loginButton.disabled = true;
    loginButton.textContent = "Checking...";

    try {
        await loadRegistrations();

        loginSection.classList.add("hidden");
        dashboardSection.classList.remove("hidden");

    } catch (error) {
        loginMessage.textContent =
            error.message || "Invalid password or login failed.";

        adminPassword = "";

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});


async function loadRegistrations() {

    dashboardMessage.textContent = "Loading registrations...";

    const response = await fetch(
        `${ADMIN_FUNCTION_URL}/registrations`,
        {
            method: "GET",
            headers: {
                "x-admin-password": adminPassword
            }
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Unable to retrieve registrations.");
    }

    const registrations = result.registrations || [];

    displayRegistrations(registrations);

    dashboardMessage.textContent =
        `${registrations.length} registration(s) loaded.`;
}


function displayRegistrations(registrations) {

    const table = document.getElementById("registrationsTable");

    table.innerHTML = "";

    let confirmed = 0;
    let pending = 0;
    let totalCollected = 0;

    if (registrations.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="10">No registrations found.</td>
            </tr>
        `;
    }

    registrations.forEach(registration => {

        const payment = Array.isArray(registration.payments)
            ? registration.payments[0]
            : registration.payments;

        const status = payment?.payment_status || "pending";
        const amount = Number(payment?.amount_zmw ?? registration.amount_zmw ?? 0);

        const isConfirmed = [
            "confirmed",
            "successful",
            "paid"
        ].includes(status.toLowerCase());

        if (isConfirmed) {
            confirmed++;
            totalCollected += amount;
        } else {
            pending++;
        }

        const statusClass = isConfirmed
            ? "status-confirmed"
            : status.toLowerCase() === "submitted"
                ? "status-submitted"
                : status.toLowerCase() === "failed"
                    ? "status-failed"
                    : "status-pending";

        const row = document.createElement("tr");

        const values = [
            registration.full_name,
            registration.phone_number,
            registration.conference,
            registration.area,
            registration.church,
            registration.registration_category,
            `K${amount.toFixed(2)}`,
            payment?.payment_method || "—",
            payment?.transaction_reference || "—"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "—";
            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = `status-badge ${statusClass}`;
        badge.textContent = status;

        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        table.appendChild(row);
    });

    document.getElementById("totalRegistrations").textContent =
        registrations.length;

    document.getElementById("confirmedPayments").textContent =
        confirmed;

    document.getElementById("pendingPayments").textContent =
        pending;

    document.getElementById("totalCollected").textContent =
        `K${totalCollected.toFixed(2)}`;
}


document.getElementById("refreshButton").addEventListener("click", async () => {
    try {
        await loadRegistrations();
    } catch (error) {
        dashboardMessage.textContent = error.message;
    }
});


document.getElementById("logoutButton").addEventListener("click", () => {

    adminPassword = "";

    loginForm.reset();

    dashboardSection.classList.add("hidden");
    loginSection.classList.remove("hidden");

    loginMessage.textContent = "";
    dashboardMessage.textContent = "";
});
