// v6 — PURE JS (no <script> tags). Safe for <script src=".../supabase.js?v=6">
function createDbClient(){
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG_PUBLIC.DATABASE;
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const sb = (typeof SB === 'undefined') ? createDbClient() : SB;

/* ===== utils ===== */
function uid(){ return crypto.getRandomValues(new Uint32Array(1))[0].toString(36); }
function genOrderId(){
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  return `AXP-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${uid().slice(0,4).toUpperCase()}`;
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

/* ===== Catalog / Prices / Counts ===== */
async function db_seedCatalogIfEmpty(catalog){
  const { count } = await sb.from('products').select('*', { count:'exact', head:true });
  if((count||0)>0) return;
  if(!Array.isArray(catalog)||!catalog.length) return;

  const prows = catalog.map(p=>({ id:p.id, name:p.name, category:p.category, icon:p.icon||null, is_active:true }));
  await sb.from('products').insert(prows);

  const priceRows=[];
  catalog.forEach(p=>{
    Object.entries(p.pricing||{}).forEach(([atype, matrix])=>{
      Object.entries(matrix||{}).forEach(([dur, price])=>{
        priceRows.push({ product_id:p.id, account_type:atype, duration_key:dur, price_php:price });
      });
    });
  });
  if(priceRows.length) await sb.from('product_prices').insert(priceRows);
}

async function db_listProductsRaw(){
  const { data, error } = await sb.from('products').select('*').order('name');
  if(error) throw error; return data||[];
}
async function db_pricesByProduct(product_id){
  const { data, error } = await sb.from('product_prices')
    .select('account_type,duration_key,price_php')
    .eq('product_id', product_id).order('account_type',{ascending:true});
  if(error) throw error; return data||[];
}
async function db_stockCounts(){
  const [{ data:avail }, { data:arch }] = await Promise.all([
    sb.from('stocks').select('product_id', { count:'exact', head:false }).eq('is_archived',false),
    sb.from('stocks').select('product_id', { count:'exact', head:false }).eq('is_archived',true)
  ]);
  const cA = {}, cR = {};
  (avail||[]).forEach(r=>{ cA[r.product_id]=(cA[r.product_id]||0)+1; });
  (arch||[]).forEach(r=>{ cR[r.product_id]=(cR[r.product_id]||0)+1; });
  return { avail:cA, arch:cR };
}
async function db_listCatalogWithCounts(){
  const [prods, counts] = await Promise.all([db_listProductsRaw(), db_stockCounts()]);
  const prices = await sb.from('product_prices').select('product_id,account_type,duration_key,price_php');
  const byId = Object.fromEntries(prods.map(p=>[p.id,{...p,available:0,archived:0,prices:[]}]));
  Object.entries(counts.avail).forEach(([pid,n])=>{ if(byId[pid]) byId[pid].available=n; });
  Object.entries(counts.arch).forEach(([pid,n])=>{ if(byId[pid]) byId[pid].archived=n; });
  (prices.data||[]).forEach(pr=>{ if(byId[pr.product_id]) byId[pr.product_id].prices.push(pr); });
  return Object.values(byId);
}

/* ===== Orders & Buyers ===== */
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
    status:'pending'
  };
  const { error } = await sb.from('orders').insert(row);
  if(error) throw error; return { id, ...row };
}
async function db_listOrdersByEmail(email){
  const { data, error } = await sb.from('orders')
    .select('*').eq('buyer_email', email).order('created_at',{ascending:false});
  if(error) throw error; return data||[];
}
async function db_upsertBuyer(u){
  if(!u?.email) return;
  await sb.from('buyers').upsert(
    { email:u.email, name:u.name||'User', joined_at:u.joinDate||new Date().toISOString() },
    { onConflict:'email' }
  );
}

/* ===== Admin ===== */
async function db_isUidAdmin(uid){
  const { data, error } = await sb.from('admin_uids').select('uid').eq('uid', uid).maybeSingle();
  if(error) return false; return !!data;
}
async function db_addProduct(row){ const { error } = await sb.from('products').insert(row); if(error) throw error; }
async function db_updateProduct(row){ const { id, ...rest }=row; const { error }=await sb.from('products').update(rest).eq('id',id); if(error) throw error; }
async function db_deleteProduct(id){ const { error } = await sb.from('products').delete().eq('id',id); if(error) throw error; }

async function db_addRule(row){ const { error } = await sb.from('rules').insert(row); if(error) throw error; }
async function db_listRules(){ const { data } = await sb.from('rules').select('*').order('created_at',{ascending:false}); return data||[]; }
async function db_deleteRule(id){ const { error } = await sb.from('rules').delete().eq('id',id); if(error) throw error; }

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
    auto_drop_days: Number(payload.auto_drop_days||0),
    notes: payload.notes || null,
    is_archived:false
  }));
  const { error } = await sb.from('stocks').insert(rows);
  if(error) throw error;
}
async function db_autodropStale(){
  const now = new Date().toISOString();
  const { data } = await sb.from('stocks')
    .select('id,created_at,auto_drop_days,is_archived')
    .eq('is_archived',false).gt('auto_drop_days',0);
  const toArchive = (data||[]).filter(s=>{
    const d=new Date(s.created_at); d.setDate(d.getDate()+Number(s.auto_drop_days||0));
    return d.toISOString() < now;
  }).map(s=>s.id);
  if(toArchive.length){
    await sb.from('stocks').update({ is_archived:true, archived_at:new Date().toISOString() }).in('id', toArchive);
  }
}
async function db_listAvailableStocks(){
  const { data, error } = await sb.from('stocks')
    .select('id,product_id,account_type,duration_key,email,profile,created_at')
    .eq('is_archived',false).order('created_at',{ascending:false});
  if(error) throw error;
  const ids=[...new Set((data||[]).map(x=>x.product_id))];
  let names={};
  if(ids.length){
    const { data:prods } = await sb.from('products').select('id,name').in('id',ids);
    names = Object.fromEntries((prods||[]).map(p=>[p.id,p.name]));
  }
  return (data||[]).map(x=>({ ...x, product_name:names[x.product_id]||x.product_id }));
}
async function db_archiveStock(id, archived_at){ const { error }=await sb.from('stocks').update({ is_archived:true, archived_at }).eq('id',id); if(error) throw error; }
async function db_deleteStock(id){ const { error }=await sb.from('stocks').delete().eq('id',id); if(error) throw error; }
async function db_markSold(stock_id, price_php){
  const { data:s } = await sb.from('stocks').select('product_id,account_type,duration_key').eq('id',stock_id).maybeSingle();
  if(!s) throw new Error('Stock not found');
  const { data:p } = await sb.from('products').select('name').eq('id', s.product_id).maybeSingle();
  await sb.from('sold_records').insert({
    product_id:s.product_id, product_name:p?.name||s.product_id,
    account_type:s.account_type, duration_key:s.duration_key, price_php: price_php||0
  });
  await db_archiveStock(stock_id, new Date().toISOString());
}
async function db_adminStats(){
  const [{ count:pc }] = await Promise.all([ sb.from('products').select('*',{count:'exact',head:true}) ]);
  const { count:avail } = await sb.from('stocks').select('*',{count:'exact',head:true}).eq('is_archived',false);
  const { count:pend }  = await sb.from('orders').select('*',{count:'exact',head:true}).eq('status','pending');
  const { data:rev }    = await sb.from('sold_records').select('price_php');
  const revenue = (rev||[]).reduce((a,b)=>a+Number(b.price_php||0),0);
  return { products:pc||0, available:avail||0, pending:pend||0, revenue };
}
async function db_listProducts(){ const { data } = await sb.from('products').select('*').order('name'); return data||[]; }
async function db_listPendingOrders(){ const { data }=await sb.from('orders').select('*').eq('status','pending').order('created_at',{ascending:false}); return data||[]; }
async function db_confirmOrder(id){ await sb.from('orders').update({ status:'confirmed', confirmed_at:new Date().toISOString()}).eq('id',id); }
async function db_cancelOrder(id){ await sb.from('orders').update({ status:'canceled', canceled_at:new Date().toISOString()}).eq('id',id); }
async function db_listSold(){ const { data }=await sb.from('sold_records').select('*').order('sold_at',{ascending:false}); return data||[]; }
async function db_listArchived(){
  const { data }=await sb.from('stocks').select('*').eq('is_archived',true).order('archived_at',{ascending:false});
  const ids=[...new Set((data||[]).map(x=>x.product_id))]; let names={};
  if(ids.length){ const { data:prods }=await sb.from('products').select('id,name').in('id',ids); names=Object.fromEntries((prods||[]).map(p=>[p.id,p.name])); }
  return (data||[]).map(a=>({ ...a, product_name:names[a.product_id]||a.product_id }));
}
async function db_listRecordsSummary(){
  const { data } = await sb.from('sold_records').select('price_php');
  const revenue = (data||[]).reduce((a,b)=>a+Number(b.price_php||0),0);
  return { total:(data||[]).length, revenue, web:(data||[]).length, social:0 };
}

/* ===== Reports & Feedback ===== */
async function db_fetchRules(){ const { data }=await sb.from('rules').select('*').order('created_at',{ascending:false}); return data||[]; }
async function db_addBuyerReport({ order_id, product, issue, buyer, email, file }){
  let image_path=null; if(file) image_path=await uploadPublic('reports', file);
  const { error } = await sb.from('buyer_reports').insert({ order_id, product, issue, buyer, email, image_path });
  if(error) throw error;
}
async function db_fetchBuyerReports(email){
  const { data, error } = await sb.from('buyer_reports').select('*').eq('email',email).order('created_at',{ascending:false});
  if(error) throw error; return data||[];
}
async function db_listBuyerReports(){ const { data }=await sb.from('buyer_reports').select('*').order('created_at',{ascending:false}); return data||[]; }
async function db_markReportResolved(id){ await sb.from('buyer_reports').update({ status:'resolved' }).eq('id',id); }
async function db_deleteReport(id){ await sb.from('buyer_reports').delete().eq('id',id); }

async function db_addFeedback({ user, text, file }){
  let image_path=null; if(file) image_path=await uploadPublic('feedback', file);
  const { error }=await sb.from('feedback').insert({ user_name:user, text, image_path });
  if(error) throw error;
}
async function db_fetchFeedback(){ const { data }=await sb.from('feedback').select('*').order('created_at',{ascending:false}); 
  return (data||[]).map(x=>({ ...x, user:x.user_name })); }

/* ===== Realtime ===== */
function db_subscribeStockAndOrders(onChange){
  try{
    sb.channel('aiax-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'stocks'},onChange)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},onChange)
      .subscribe();
  }catch(_){}
}

/* ===== expose to window ===== */
window.createDbClient = createDbClient;
window.db_seedCatalogIfEmpty = db_seedCatalogIfEmpty;
window.db_listCatalogWithCounts = db_listCatalogWithCounts;
window.db_pricesByProduct = db_pricesByProduct;

window.db_createOrder = db_createOrder;
window.db_listOrdersByEmail = db_listOrdersByEmail;
window.db_upsertBuyer = db_upsertBuyer;

window.db_isUidAdmin = db_isUidAdmin;
window.db_addProduct = db_addProduct;
window.db_updateProduct = db_updateProduct;
window.db_deleteProduct = db_deleteProduct;

window.db_addRule = db_addRule;
window.db_listRules = db_listRules;
window.db_deleteRule = db_deleteRule;

window.db_addStock = db_addStock;
window.db_autodropStale = db_autodropStale;
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
