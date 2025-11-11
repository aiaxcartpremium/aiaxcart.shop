import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try{
    const { text } = await req.json();
    const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
    const CHAT_ID = Deno.env.get("CHAT_ID");
    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({ ok:false, error:"Missing secrets" }), { status:500 });
    }
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:"POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" })
    });
    const data = await resp.json();
    return new Response(JSON.stringify(data), { headers: { "Content-Type":"application/json" }});
  } catch(e){
    return new Response(JSON.stringify({ ok:false, error: e?.message || String(e) }), { status: 500 });
  }
});
