<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script>
/* ===== Supabase bootstrap ===== */
const SB_URL  = "https://oujvsjnbxmgpdoftzpxl.supabase.co";  // ← Project URL mo
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anZzam5ieG1ncGRvZnR6cHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzE1NTYsImV4cCI6MjA3ODQ0NzU1Nn0.vs06C-2kx4H2whyTReUPsVgLYhWotfkzetxdKD5LVQo";  // ← anon key mo                  // <-- put yours
window.sb = supabase.createClient(SB_URL, SB_ANON);

/* ===== Products & Stock (RPC-based, safe) ===== */
// get live stock per product (uses SQL function below)
async function db_listProductsWithStock() {
  const { data, error } = await sb.rpc('get_product_stock'); // returns [{product_id,name,category,icon,stock_count}]
  if (error) throw error;
  return data;
}

// Admin: add on-hand account (stock)
async function db_addOnhandStock({product_id, acc_type, duration_key, email, password, profile, pin, premium_at, auto_archive_days}) {
  const payload = {
    product_id,
    account_type: acc_type,
    duration_key,
    email, password, profile, pin,
    premium_at,
    auto_archive_days: auto_archive_days ?? 0,
    status: 'available'
  };
  const { data, error } = await sb.from('onhand_accounts').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/* ===== Orders ===== */
async function db_createOrder({buyer_name, buyer_email, product_id, account_type, duration_key, price}) {
  const payload = {
    buyer_name, buyer_email,
    product_id, account_type, duration_key,
    price: Number(price)||0,
    status: 'pending'
  };
  const { data, error } = await sb.from('orders').insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function db_listPendingOrders() {
  const { data, error } = await sb
    .from('orders')
    .select('id, created_at, buyer_name, buyer_email, status, price, account_type, duration_key, product:products(name)')
    .eq('status','pending')
    .order('created_at', { ascending:false });
  if (error) throw error;
  return data;
}

// Preferred: RPC to confirm & fulfill (assigns an available stock)
async function db_confirmPayment(order_id) {
  const { data, error } = await sb.rpc('fulfill_paid_order', { p_order_id: order_id });
  if (error) throw error;
  return data; // returns delivery bundle (with credentials)
}

/* ===== Realtime ===== */
function db_subscribeOrders(onChange){
  return sb.channel('orders-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload)=> onChange && onChange(payload))
    .subscribe();
}
</script>