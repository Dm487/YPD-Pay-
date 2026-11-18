
const form = document.getElementById("paymentForm");
const amountDisplay = document.getElementById("amount");
const submitButton = document.getElementById("submitButton");

const paymentSection = document.getElementById("paymentSection");
const confirmationSection = document.getElementById("confirmationSection");
const formMessage = document.getElementById("formMessage");

const categoryInputs = document.querySelectorAll(
    'input[name="category"]'
);

// Update registration amount when category changes
categoryInputs.forEach(input => {
    input.addEventListener("change", () => {
        const amount = Number(input.dataset.amount);

        amountDisplay.textContent = `K${amount.toFixed(2)}`;
    });
});

// Submit registration
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedCategory = document.querySelector(
        'input[name="category"]:checked'
    );

    const selectedMethod = document.querySelector(
        'input[name="paymentMethod"]:checked'
    );

    if (!selectedCategory || !selectedMethod) {
        showMessage("Please select your category and payment method.");
        return;
    }

    // Registration information sent to Supabase
    const registration = {
        p_full_name: document.getElementById("fullName").value.trim(),
        p_phone_number: document.getElementById("phone").value.trim(),
        p_conference: document.getElementById("conference").value.trim(),
        p_area: document.getElementById("area").value.trim(),
        p_church: document.getElementById("church").value.trim(),
        p_registration_category: selectedCategory.value,
        p_payment_method: selectedMethod.value,
        p_transaction_reference: null
    };

    // Validate required information
    if (Object.entries(registration).some(
        ([key, value]) =>
            key !== "p_transaction_reference" &&
            (!value || !String(value).trim())
    )) {
        showMessage("Please complete all required fields.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    showMessage("");

    try {
        const { data, error } = await supabaseClient.rpc(
            "submit_registration",
            registration
        );

        if (error) {
            console.error("Registration error:", error);
            console.error("Error code:", error.code);
            console.error("Error details:", error.details);
            console.error("Error hint:", error.hint);

            throw new Error(error.message);
        }

        if (!data) {
            throw new Error(
                "Registration was not confirmed by the database."
            );
        }

        // Display registration confirmation
        document.getElementById("receiptName").textContent =
            registration.p_full_name;

        document.getElementById("receiptCategory").textContent =
            registration.p_registration_category;

        document.getElementById("receiptAmount").textContent =
            amountDisplay.textContent;

        document.getElementById("receiptMethod").textContent =
            registration.p_payment_method;

        paymentSection.classList.add("hidden");
        confirmationSection.classList.remove("hidden");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch (error) {
        console.error("Registration failed:", error);

        showMessage(
            error.message || "Unable to submit registration. Please try again."
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Registration";
    }
});

// Display messages
function showMessage(message) {
    formMessage.textContent = message;
}

// Start a new registration
document.getElementById("newPaymentButton").addEventListener("click", () => {
    form.reset();

    amountDisplay.textContent = "K0.00";
    formMessage.textContent = "";

    confirmationSection.classList.add("hidden");
    paymentSection.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});
