// supabase.js — bootstrap Supabase client using window.CONFIG
const { createClient } = window.supabase;

if (!window.CONFIG || !window.CONFIG.DATABASE) {
  console.error("CONFIG missing. Load config.private.js (local) or config.js (public) first.");
}

const URL = window.CONFIG?.DATABASE?.SUPABASE_URL;
const KEY = window.CONFIG?.DATABASE?.SUPABASE_ANON_KEY;

window.supabaseClient = createClient(URL, KEY);
