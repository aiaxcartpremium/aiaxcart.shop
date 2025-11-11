// ===========================================
// supabase.js (Public - No secrets, uses CONFIG_PRIVATE)
// ===========================================

// Make sure config.private.js is loaded already!
const SUPABASE_URL = CONFIG_PRIVATE.DATABASE.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG_PRIVATE.DATABASE.SUPABASE_ANON_KEY;

// Only initialize if supabase-js library is loaded
if (typeof window.supabase !== "undefined" && SUPABASE_URL && SUPABASE_ANON_KEY) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn("Supabase client not initialized. Check if supabase-js CDN is loaded and config.private.js exists.");
}

// Sample function to get the supabase client elsewhere
function getSupabase() {
    return window.supabaseClient;
}

// Example: Fetch all products (replace 'products' with your actual table)
async function getProducts() {
    if (!window.supabaseClient) {
        console.error('Supabase client not initialized.');
        return [];
    }
    // Uncomment and edit below when supabase-js is in use:
    // const { data, error } = await window.supabaseClient
    //     .from('products')
    //     .select('*');
    // if (error) {
    //     console.error(error);
    //     return [];
    // }
    // return data;

    // Placeholder return (safe for demo)
    return [];
}
