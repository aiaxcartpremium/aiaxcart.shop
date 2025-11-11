// orders.js — create orders & confirm payment (auto-fulfill via DB trigger)
async function sb(){ return window.supabaseClient; }
async function ensureBuyer(){
  const s = await sb();
  const { data, error } = await s.rpc('rpc_upsert_buyer');
  if (error) throw error;
  return data;
}

export async function createOrder({ product_key, account_type, duration_code, price }){
  const s = await sb();
  await ensureBuyer();
  const { data, error } = await s.from('orders')
    .insert({ product_key, account_type, duration_code, price, status:'awaiting_payment' })
    .select('id')
    .single();
  if (error) throw error;

  // Notify TG (Edge Function secrets)
  try{
    await fetch('/functions/v1/tg-notify', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: `🛒 New order\nProduct: ${product_key}\nType: ${account_type}\nDuration: ${duration_code}` })
    });
  }catch(e){}

  return data.id;
}

export async function confirmPayment(order_id){
  const s = await sb();
  const { error } = await s.rpc('rpc_confirm_payment', { p_order_id: order_id });
  if (error) throw error;

  try{
    await fetch('/functions/v1/tg-notify', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: `✅ Payment confirmed\nOrder: ${order_id}` })
    });
  }catch(e){}
}
