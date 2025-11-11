// supabase.js — client bootstrap (keep your UI; just include this before other scripts)
const { createClient } = window.supabase;
const url  = window.CONFIG_PRIVATE?.DATABASE?.SUPABASE_URL;
const key  = window.CONFIG_PRIVATE?.DATABASE?.SUPABASE_ANON_KEY;
if(!url || !key) console.warn("Missing Supabase URL/ANON KEY in config.private.js");
window.supabaseClient = createClient(url, key);
