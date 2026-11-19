
const form = document.getElementById("paymentForm");
const amountDisplay = document.getElementById("amount");
const submitButton = document.getElementById("submitButton");

const paymentSection = document.getElementById("paymentSection");
const confirmationSection = document.getElementById("confirmationSection");
const formMessage = document.getElementById("formMessage");
const paymentStatusMessage = document.getElementById("paymentStatusMessage");
const receiptPaymentStatus = document.getElementById("receiptPaymentStatus");

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

// Display registration form messages
function showMessage(message) {
    formMessage.textContent = message;
}

// Display payment status in confirmation section
function showPaymentStatus(message, isError = false) {
    paymentStatusMessage.textContent = message;
    paymentStatusMessage.style.color = isError ? "#b42318" : "#176b3a";
}

// Display registration confirmation
function showConfirmation(registration) {
    document.getElementById("receiptName").textContent =
        registration.p_full_name;

    document.getElementById("receiptCategory").textContent =
        registration.p_registration_category;

    document.getElementById("receiptAmount").textContent =
        amountDisplay.textContent;

    document.getElementById("receiptMethod").textContent =
        registration.p_payment_method;

    receiptPaymentStatus.textContent = "Awaiting payment";

    paymentSection.classList.add("hidden");
    confirmationSection.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// Submit registration and initiate payment
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

    // Registration details
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

    // Validate required fields
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
        // STEP 1: Save registration in Supabase
        const { data: registrationId, error: registrationError } =
            await supabaseClient.rpc(
                "submit_registration",
                registration
            );

        if (registrationError) {
            console.error("Registration error:", registrationError);
            throw new Error(registrationError.message);
        }

        if (!registrationId) {
            throw new Error(
                "Registration was not confirmed by the database."
            );
        }

        console.log("Registration saved:", registrationId);

        // STEP 2: Display registration confirmation
        showConfirmation(registration);

        showPaymentStatus(
            "Registration saved. Connecting to Ontech payment gateway..."
        );

        // STEP 3: Call the deployed Supabase payment function
        submitButton.textContent = "Processing payment...";

        const { data: paymentData, error: paymentError } =
            await supabaseClient.functions.invoke(
                "ypd-pay",
                {
                    body: {
                        registration_id: registrationId
                    }
                }
            );

        if (paymentError) {
            console.error("Payment initiation error:", paymentError);

            receiptPaymentStatus.textContent = "Not initiated";

            showPaymentStatus(
                "Your registration was saved, but payment could not be initiated. Please contact YPD administration. Do not register again.",
                true
            );

            return;
        }

        if (!paymentData || paymentData.success !== true) {
            console.error("Unexpected payment response:", paymentData);

            receiptPaymentStatus.textContent = "Not confirmed";

            showPaymentStatus(
                paymentData?.error ||
                "Your registration was saved, but payment initiation could not be confirmed. Please contact YPD administration. Do not register again.",
                true
            );

            return;
        }

        // STEP 4: Display successful payment initiation
        receiptPaymentStatus.textContent = "Payment request submitted";

        showPaymentStatus(
            `Payment request initiated. Amount: K${paymentData.amount}. Transaction reference: ${paymentData.transaction_id}. Please follow the payment prompt on your phone. Final payment confirmation is still pending.`
        );

        console.log("Ontech payment response:", paymentData);

    } catch (error) {
        console.error("Registration failed:", error);

        showMessage(
            error.message ||
            "Unable to submit registration. Please try again."
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Registration";
    }
});

// Start a new registration
document.getElementById("newPaymentButton").addEventListener("click", () => {
    form.reset();

    amountDisplay.textContent = "K0.00";
    formMessage.textContent = "";
    paymentStatusMessage.textContent = "";
    receiptPaymentStatus.textContent = "Awaiting payment";

    confirmationSection.classList.add("hidden");
    paymentSection.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});
