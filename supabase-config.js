const SUPABASE_URL =
    "https://fhnzrfmtiscfcnhxtkmx.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AJ3aNUeWUmTBALCtbvVWqg_ARQJSD1h";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);