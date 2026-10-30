
/* ==================================
   YPD PAY - FRONTEND JAVASCRIPT
   ================================== */

// Registration fees
const registrationFees = {
    "Ordinary YPDer": 150,

    "Area Presidents, Directors and LTI Delegates": 200,

    "Conference Presidents and Conference Directors": 350,

    "Episcopal Officers": 500
};

// Get HTML elements
const registrationForm = document.getElementById("registrationForm");
const amountDisplay = document.getElementById("amount");
const paymentMessage = document.getElementById("paymentMessage");

const categoryOptions = document.querySelectorAll(
    'input[name="category"]'
);

// Update registration fee
categoryOptions.forEach((option) => {

    option.addEventListener("change", function () {

        const amount = registrationFees[this.value];

        if (amount !== undefined) {
            amountDisplay.textContent = `K${amount}`;
        }

    });

});


// ==================================
// REGISTRATION FORM SUBMISSION
// ==================================

if (registrationForm) {

    registrationForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        // Get selected registration category
        const selectedCategory = document.querySelector(
            'input[name="category"]:checked'
        );

        // Get selected payment provider
        const selectedProvider = document.querySelector(
            'input[name="paymentMethod"]:checked'
        );

        // Validate selections
        if (!selectedCategory) {
            alert("Please select a registration category.");
            return;
        }

        if (!selectedProvider) {
            alert("Please select a payment method.");
            return;
        }

        // Calculate amount from our fee list
        const amount = registrationFees[selectedCategory.value];

        if (amount === undefined) {
            alert("Invalid registration category.");
            return;
        }

        // Collect registration information
        const formData = new FormData(registrationForm);

        const registrationData = {
            fullName: formData.get("fullName"),
            phone: formData.get("phone"),
            conference: formData.get("conference"),
            area: formData.get("area"),
            church: formData.get("church"),

            category: selectedCategory.value,
            amount: amount,

            paymentMethod: selectedProvider.value
        };

        // Show processing message
        const submitButton = registrationForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Processing...";

        paymentMessage.textContent = "Preparing your payment request...";
        paymentMessage.style.color = "inherit";

        try {

            // Send information to our backend
            const response = await fetch("/api/payments", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(registrationData)

            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to process your request."
                );
            }

            // Display payment status
            if (result.status === "SUCCESSFUL") {

                paymentMessage.textContent =
                    "Payment successful! Your registration is confirmed.";

            } else if (result.status === "PENDING") {

                paymentMessage.textContent =
                    "Payment request sent. Please check your phone and approve the payment.";

            } else {

                paymentMessage.textContent =
                    result.message || "Payment could not be completed.";

            }

        } catch (error) {

            console.error("Payment error:", error);

            paymentMessage.textContent =
                error.message || "Something went wrong. Please try again.";

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = "Continue to Payment";

        }

    });

}
