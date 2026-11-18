
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-admin-password",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
    // Handle browser preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders,
        });
    }

    try {
        // Only allow GET requests
        if (req.method !== "GET") {
            return Response.json(
                { error: "Method not allowed." },
                { status: 405, headers: corsHeaders }
            );
        }

        // Read the executive password
        const ADMIN_PASSWORD = Deno.env.get("YPD_ADMIN_PASSWORD");

        if (!ADMIN_PASSWORD) {
            throw new Error("Executive password is not configured.");
        }

        // Verify the supplied password
        const suppliedPassword = req.headers.get("x-admin-password");

        if (!suppliedPassword || suppliedPassword !== ADMIN_PASSWORD) {
            return Response.json(
                { error: "Incorrect executive password." },
                { status: 401, headers: corsHeaders }
            );
        }

        // Read Supabase server credentials
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
            throw new Error("Supabase server configuration is incomplete.");
        }

        // Create a privileged server-side Supabase connection
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

        // Retrieve registrations and their associated payments
        const { data, error } = await supabase
            .from("registrations")
            .select("*, payments(*)")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Database retrieval error:", error);

            return Response.json(
                { error: "Unable to retrieve registration records." },
                { status: 500, headers: corsHeaders }
            );
        }

        // Return registration records
        return Response.json(
            {
                success: true,
                registrations: data || [],
            },
            {
                status: 200,
                headers: corsHeaders,
            }
        );

    } catch (error) {
        console.error("Executive dashboard error:", error);

        return Response.json(
            { error: "An internal server error occurred." },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
});
