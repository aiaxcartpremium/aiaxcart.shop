/* assets/js/aiaxcart/supabase.js?v=4 */

function createDbClient(){
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG_PUBLIC.DATABASE;
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const sb = (typeof SB==='undefined') ? createDbClient() : SB;

/* ========== helpers ========== */
function uid(){ return crypto.getRandomValues(new Uint32Array(1))[0].toString(36); }
function genOrderId(){
  const d = new Date();
  const pad = n => n.toString().padStart(2,'0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  return `AXP-${stamp}-${uid().slice(0,4).toUpperCase()}`;
}
async function uploadPublic(bucket, file){
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
  const { data, error } = await sb.storage.from(bucket).upload(name, file, { upsert:false });
  if(error) throw error;
  return `${bucket}/${data.path}`;
}
async function getPublicURL(path){
  const [bucket, ...rest] = path.split('/');
  const key = rest.join('/');
  const { data } = sb.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

/* ========== Catalog / Prices / Stocks ========== */
async function db_seedCatalogIfEmpty(catalog){
  const { data } = await sb.from('products').select('id', { count: 'exact', head: true });
  if (data === null) return; // not needed
  const { count: existing } = await sb.from('products').select('*', { count: 'exact', head: true });
  if ((existing ?? 0) > 0) return;
  // insert products
  const prows = catalog.map(p=>({ id:p.id, name:p.name, category:p.category, icon:p.icon || null }));
  await sb.from('products').insert(prows);
  // insert prices
  const priceRows = [];
  catalog.forEach(p=>{
    Object.entries(p.pricing||{}).forEach(([atype, matrix])=>{
      Object.entries(matrix||{}).forEach(([dur, price])=>{
        priceRows.push({ product_id:p.id, account_type:atype, duration_key:dur, price_php:price });
      });
    });
  });
  if(priceRows.length) await sb.from('product_prices').insert(priceRows);
}

async function db_listCatalogWithCounts(){
  // products, counts, and expose min price for display
  const [{ data: prods, error: e1 }, { data: summary, error: e2 }, { data: prices, error: e3 }] = await Promise.all([
    sb.from('products').select('*').eq('is_active', true).order('name'),
    sb.from('product_stock_summary').select('*'),
    sb.from('product_prices').select('product_id, account_type, duration_key, price_php')
  ]);
  if(e1||e2||e3) throw (e1||e2||e3);

  const byId = Object.fromEntries(prods.map(p=>[p.id, { ...p, available:0, archived:0, prices:[] }]));
  (summary||[]).forEach(r=>{
    if(byId[r.product_id]){ byId[r.product_id].available = r.available||0; byId[r.product_id].archived = r.archived||0; }
  });
  (prices||[]).forEach(pr=>{
    if(byId[pr.product_id]) byId[pr.product_id].prices.push(pr);
  });
  return Object.values(byId);
}

async function db_getPrices(product_id){
  const { data, error } = await sb.from('product_prices')
    .select('account_type, duration_key, price_php')
    .eq('product_id', product_id)
    .order('account_type', { ascending:true });
  if(error) throw error;
  return data;
}

/* ========== Orders ========== */
async function db_createOrder(payload){
  const id = genOrderId();
  const row = {
    id,
    buyer_name:  payload.buyer_name,
    buyer_email: payload.buyer_email,
    product_id:  payload.product_id,
    product_name:payload.product_name,
    account_type:payload.account_type,
    duration_key:payload.duration_key,
    price_php:   payload.price,
    invite_gmail:payload.invite_gmail || null,
    status: 'pending'
  };
  const { error } = await sb.from('orders').insert(row);
  if(error) throw error;
  return { id, ...row };
}

async function db_listOrdersByEmail(email){
  const { data, error } = await sb.from('orders')
    .select('*')
    .eq('buyer_email', email)
    .order('created_at', { ascending:false });
  if(error) throw error;
  return data;
}

/* ========== Admin Ops (panel) ========== */
async function db_isUidAdmin(uid){
  const { data, error } = await sb.from('admin_uids').select('uid').eq('uid', uid).maybeSingle();
  if(error) return false;
  return !!data;
}

async function db_addProduct(row){ return (await sb.from('products').insert(row)).error ?? null; }
async function db_updateProduct(row){ const { id, ...rest } = row; return (await sb.from('products').update(rest).eq('id', id)).error ?? null; }
async function db_deleteProduct(id){ return (await sb.from('products').delete().eq('id', id)).error ?? null; }

async function db_addRule(row){ return (await sb.from('rules').insert(row)).error ?? null; }
async function db_listRules(){ const { data } = await sb.from('rules').select('*').order('created_at', { ascending:false }); return data||[]; }
async function db_deleteRule(id){ return (await sb.from('rules').delete().eq('id', id)).error ?? null; }

async function db_addStock(payload){
  const qty = Math.max(1, Number(payload.quantity||1));
  const rows = Array.from({length:qty}).map(()=>({
    product_id: payload.product_id,
    account_type: payload.account_type,
    duration_key: payload.duration_key,
    email: payload.email || null,
    password: payload.password || null,
    profile: payload.profile || null,
    pin: payload.pin || null,
    premium_until: payload.premium_until || null,
    notes: payload.notes || null
  }));
  const { error } = await sb.from('stocks').insert(rows);
  if(error) throw error;
}

async function db_listAvailableStocks(){
  const { data, error } = await sb.from('stocks')
    .select('id, product_id, account_type, duration_key, email, profile, created_at, products(name)')
    .eq('is_archived', false)
    .order('created_at', { ascending:false });
  if(error) throw error;
  return (data||[]).map(x=>({
    id: x.id,
    product_name: x.products?.name || x.product_id,
    account_type: x.account_type,
    duration_key: x.duration_key,
    email: x.email,
    profile: x.profile
  }));
}

async function db_archiveStock(id, archived_at){
  const { error } = await sb.from('stocks').update({ is_archived:true, archived_at }).eq('id', id);
  if(error) throw error;
}

async function db_deleteStock(id){ const { error } = await sb.from('stocks').delete().eq('id', id); if(error) throw error; }

async function db_markSold(stock_id, price_php){
  // just record a sale and archive that stock
  const { data: s, error: e1 } = await sb.from('stocks').select('product_id, account_type, duration_key, products(name)').eq('id', stock_id).maybeSingle();
  if(e1) throw e1;
  if(!s) throw new Error('Stock not found');
  await sb.from('sold_records').insert({
    product_id: s.product_id,
    product_name: s.products?.name || s.product_id,
    account_type: s.account_type,
    duration_key: s.duration_key,
    price_php: price_php||0
  });
  await db_archiveStock(stock_id, new Date().toISOString());
}

async function db_adminStats(){
  const [{ data: p }, { data: avail }, { data: pend }, { data: rev }] = await Promise.all([
    sb.from('products').select('id', { count:'exact', head:true }),
    sb.from('stocks').select('*', { count:'exact', head:true }).eq('is_archived', false),
    sb.from('orders').select('*', { count:'exact', head:true }).eq('status', 'pending'),
    sb.from('sold_records').select('price_php')
  ]);
  const revenue = (rev||[]).reduce((a,b)=>a+Number(b.price_php||0),0);
  return {
    products: p?.length ?? 0,
    available: avail?.length ?? 0,
    pending: pend?.length ?? 0,
    revenue
  };
}

async function db_listProducts(){ const { data } = await sb.from('products').select('*').order('name'); return data||[]; }
async function db_listPendingOrders(){ const { data } = await sb.from('orders').select('*').eq('status','pending').order('created_at', { ascending:false }); return data||[]; }
async function db_confirmOrder(id){ await sb.from('orders').update({ status:'confirmed', confirmed_at: new Date().toISOString()}).eq('id', id); }
async function db_cancelOrder(id){ await sb.from('orders').update({ status:'canceled',  canceled_at:  new Date().toISOString()}).eq('id', id); }
async function db_listSold(){ const { data } = await sb.from('sold_records').select('*').order('sold_at', { ascending:false }); return data||[]; }
async function db_listArchived(){ const { data } = await sb.from('stocks').select('*, products(name)').eq('is_archived', true).order('archived_at', { ascending:false }); return (data||[]).map(a=>({ ...a, product_name: a.products?.name || a.product_id })); }
async function db_listRecordsSummary(){
  const { data } = await sb.from('sold_records').select('price_php');
  const revenue = (data||[]).reduce((a,b)=>a+Number(b.price_php||0),0);
  // simple split (placeholder)
  return { total: (data||[]).length, revenue, web: (data||[]).length, social: 0 };
}

/* ========== Rules / Reports / Feedback with images ========== */
async function db_fetchRules(){ const { data } = await sb.from('rules').select('*').order('created_at',{ascending:false}); return data||[]; }

async function db_addBuyerReport({ order_id, product, issue, buyer, email, file }){
  let image_path = null;
  if(file) image_path = await uploadPublic('reports', file);
  const { error } = await sb.from('buyer_reports').insert({ order_id, product, issue, buyer, email, image_path });
  if(error) throw error;
}

async function db_fetchBuyerReports(email){
  const { data, error } = await sb.from('buyer_reports').select('*').eq('email', email).order('created_at',{ascending:false});
  if(error) throw error;
  return data||[];
}
async function db_listBuyerReports(){ const { data } = await sb.from('buyer_reports').select('*').order('created_at',{ascending:false}); return data||[]; }
async function db_markReportResolved(id){ await sb.from('buyer_reports').update({ status:'resolved'}).eq('id', id); }
async function db_deleteReport(id){ await sb.from('buyer_reports').delete().eq('id', id); }

async function db_addFeedback({ user, text, file }){
  let image_path = null;
  if(file) image_path = await uploadPublic('feedback', file);
  const { error } = await sb.from('feedback').insert({ user_name:user, text, image_path });
  if(error) throw error;
}
async function db_fetchFeedback(){
  const { data } = await sb.from('feedback').select('*').order('created_at',{ascending:false});
  return (data||[]).map(x=>({ ...x, user: x.user_name }));
}

/* ========== Live updates (optional) ========== */
function db_subscribeStockAndOrders(onChange){
  try{
    sb.channel('aiax-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .subscribe();
  }catch(_){}
}

/* expose to window (used by your pages) */
window.createDbClient = createDbClient;
window.db_seedCatalogIfEmpty = db_seedCatalogIfEmpty;
window.db_listCatalogWithCounts = db_listCatalogWithCounts;
window.db_getPrices = db_getPrices;

window.db_createOrder = db_createOrder;
window.db_listOrdersByEmail = db_listOrdersByEmail;

window.db_isUidAdmin = db_isUidAdmin;
window.db_addProduct = db_addProduct;
window.db_updateProduct = db_updateProduct;
window.db_deleteProduct = db_deleteProduct;

window.db_addRule = db_addRule;
window.db_listRules = db_listRules;
window.db_deleteRule = db_deleteRule;

window.db_addStock = db_addStock;
window.db_listAvailableStocks = db_listAvailableStocks;
window.db_archiveStock = db_archiveStock;
window.db_deleteStock = db_deleteStock;
window.db_markSold = db_markSold;

window.db_adminStats = db_adminStats;
window.db_listProducts = db_listProducts;
window.db_listPendingOrders = db_listPendingOrders;
window.db_confirmOrder = db_confirmOrder;
window.db_cancelOrder = db_cancelOrder;
window.db_listSold = db_listSold;
window.db_listArchived = db_listArchived;
window.db_listRecordsSummary = db_listRecordsSummary;

window.db_fetchRules = db_fetchRules;
window.db_addBuyerReport = db_addBuyerReport;
window.db_fetchBuyerReports = db_fetchBuyerReports;
window.db_listBuyerReports = db_listBuyerReports;
window.db_markReportResolved = db_markReportResolved;
window.db_deleteReport = db_deleteReport;

window.db_addFeedback = db_addFeedback;
window.db_fetchFeedback = db_fetchFeedback;
window.db_subscribeStockAndOrders = db_subscribeStockAndOrders;
window.getPublicURL = getPublicURL;