
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
    body: Record<string, unknown>,
    status = 200
) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonResponse(
            { error: "Method not allowed." },
            405
        );
    }

    try {
        // Read server-side configuration
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE_KEY =
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        const GATEWAY_BASE_URL =
            Deno.env.get("PAYMENT_GATEWAY_BASE_URL");

        const GATEWAY_API_KEY =
            Deno.env.get("PAYMENT_GATEWAY_API_KEY");

        if (
            !SUPABASE_URL ||
            !SERVICE_ROLE_KEY ||
            !GATEWAY_BASE_URL ||
            !GATEWAY_API_KEY
        ) {
            throw new Error(
                "Payment gateway or Supabase configuration is incomplete."
            );
        }

        // Read registration ID from the website
        const body = await req.json();
        const registrationId = body.registration_id;

        if (
            typeof registrationId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                .test(registrationId)
        ) {
            return jsonResponse(
                { error: "A valid registration ID is required." },
                400
            );
        }

        // Connect securely to Supabase
        const supabase = createClient(
            SUPABASE_URL,
            SERVICE_ROLE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Retrieve the registration
        const { data: registration, error: registrationError } =
            await supabase
                .from("registrations")
                .select(
                    "id, full_name, phone_number, amount_zmw"
                )
                .eq("id", registrationId)
                .single();

        if (registrationError || !registration) {
            return jsonResponse(
                { error: "Registration not found." },
                404
            );
        }

        // Retrieve the latest payment attempt
        const { data: payment, error: paymentError } =
            await supabase
                .from("payments")
                .select(
                    "id, payment_method, payment_status, transaction_reference, amount_zmw"
                )
                .eq("registration_id", registrationId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

        if (paymentError || !payment) {
            return jsonResponse(
                { error: "Payment record not found." },
                404
            );
        }

        // Prevent duplicate payment requests
        if (payment.transaction_reference) {
            return jsonResponse({
                success: true,
                message: "A payment request already exists.",
                transaction_id: payment.transaction_reference,
                status: payment.payment_status,
            });
        }

        if (payment.payment_status !== "pending") {
            return jsonResponse(
                { error: "This payment cannot be initiated." },
                409
            );
        }

        // Validate payment method
        if (
            !["MTN Money", "Airtel Money"].includes(
                payment.payment_method
            )
        ) {
            return jsonResponse(
                { error: "Unsupported payment method." },
                400
            );
        }

        // Validate phone number and detect its network
        const phone = registration.phone_number.replace(
            /[\s+\-()]/g,
            ""
        );

        const localPhone = phone.startsWith("260")
            ? phone.slice(3)
            : phone;

        if (!/^0[0-9]{9}$/.test(localPhone)) {
            return jsonResponse(
                { error: "Invalid Zambian phone number." },
                400
            );
        }

        const prefix = localPhone.slice(0, 3);

        const airtelPrefixes = ["097", "077"];
        const mtnPrefixes = ["096", "076"];

        const isAirtel = airtelPrefixes.includes(prefix);
        const isMTN = mtnPrefixes.includes(prefix);

        if (
            (payment.payment_method === "Airtel Money" && !isAirtel) ||
            (payment.payment_method === "MTN Money" && !isMTN)
        ) {
            return jsonResponse(
                {
                    error:
                        "The selected payment network does not match the phone number.",
                },
                400
            );
        }

        // Use the database amount, never an amount from the browser
        const amount = Number(payment.amount_zmw);

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount !== Number(registration.amount_zmw)
        ) {
            return jsonResponse(
                { error: "Invalid payment amount." },
                400
            );
        }

        // Initiate collection through Ontech
        const baseUrl = GATEWAY_BASE_URL.replace(/\/+$/, "");

        const gatewayResponse = await fetch(
            `${baseUrl}/pay/collect`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": GATEWAY_API_KEY,
                    "X-Idempotency-Key": `ypd-${payment.id}`,
                },
                body: JSON.stringify({
                    amount,
                    phone: localPhone,
                    reference: `YPD-${registration.id}`,
                    description: "YPD LTI Registration",
                    customer_name: registration.full_name,
                }),
            }
        );

        const gatewayData = await gatewayResponse.json();

        if (
            !gatewayResponse.ok ||
            gatewayData.success !== true ||
            !gatewayData.transaction_id
        ) {
            console.error(
                "Ontech collection error:",
                gatewayData
            );

            return jsonResponse(
                {
                    error:
                        gatewayData.detail ||
                        gatewayData.message ||
                        "Unable to initiate payment.",
                },
                502
            );
        }

        // Save the Ontech transaction reference.
        // Keep status as submitted until the webhook is verified.
        const { data: updatedPayment, error: updateError } =
            await supabase
                .from("payments")
                .update({
                    transaction_reference:
                        gatewayData.transaction_id,
                    payment_status: "submitted",
                })
                .eq("id", payment.id)
                .eq("payment_status", "pending")
                .select("id")
                .maybeSingle();

        if (updateError || !updatedPayment) {
            console.error(
                "Payment record update error:",
                updateError
            );

            return jsonResponse(
                {
                    error:
                        "The gateway received the request, but the payment record needs attention. Do not retry with a new payment attempt.",
                    transaction_id: gatewayData.transaction_id,
                },
                500
            );
        }

        return jsonResponse({
            success: true,
            message: "Payment request initiated.",
            transaction_id: gatewayData.transaction_id,
            status: "submitted",
            amount,
            provider: gatewayData.provider,
        });

    } catch (error) {
        console.error("YPD payment error:", error);

        return jsonResponse(
            { error: "Unable to process the payment request." },
            500
        );
    }
});
