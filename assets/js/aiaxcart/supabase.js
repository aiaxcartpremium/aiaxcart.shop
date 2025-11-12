<script>
// ====================== Aiaxcart Supabase v4 (single file) ======================
/*  DEPENDENCIES:
    - window.CONFIG_PUBLIC.DATABASE.SUPABASE_URL
    - window.CONFIG_PUBLIC.DATABASE.SUPABASE_ANON_KEY
    - <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
*/

// ---------- Boot ----------
function createDbClient(){
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = (window.CONFIG_PUBLIC?.DATABASE || window.CONFIG?.DATABASE);
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase config.");
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const SB = window.SB || createDbClient();

// ---------- Helpers ----------
function nowIso(){ return new Date().toISOString(); }
function rand(n){ return Math.floor(Math.random()*n); }
function uuidLike(){ return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
  const r=(Math.random()*16)|0, v=c==='x'?r:(r&0x3|0x8); return v.toString(16);
});}
function makeOrderId(){
  // human friendly + sortable + unique
  const t = new Date();
  const ts = t.toISOString().replace(/[-:.TZ]/g,'').slice(0,14); // YYYYMMDDhhmmss
  return `ORD-${ts}-${(rand(36**3)).toString(36).padStart(3,'0').toUpperCase()}`;
}
async function _throwIf(e){ if(e) throw new Error(e.message||e); }

// ---------- Catalog (from you) ----------
const CATALOG = [
  // Entertainment
  {id:'netflix',name:'Netflix Premium',category:'entertainment',icon:'📺',pricing:{
    "solo profile":{"1m":160,"2m":280,"3m":435,"4m":565,"6m":850,"8m":1090,"12m":1500},
    "shared profile":{"1m":80,"2m":145,"3m":205,"4m":270,"6m":410,"8m":520,"12m":800}
  }},
  {id:'viu',name:'Viu Premium',category:'entertainment',icon:'🎬',pricing:{
    "solo account":{"1m":70,"2m":105,"3m":145,"4m":170,"6m":205,"10m":280,"12m":310},
    "shared account":{"1m":30,"2m":55,"3m":75,"4m":90,"6m":120,"10m":190,"12m":220}
  }},
  {id:'viva-max',name:'VIVAMAX VIVAONE',category:'entertainment',icon:'🎭',pricing:{
    "solo account":{"1m":110,"2m":145,"3m":170},
    "shared account":{"1m":65,"2m":90,"3m":120}
  }},
  {id:'wetv',name:'WeTV',category:'entertainment',icon:'📱',pricing:{
    "solo account":{"1m":150},
    "shared account":{"1m":55,"2m":95,"3m":135}
  }},
  {id:'iwant-tfc',name:'IWANT TFC',category:'entertainment',icon:'📺',pricing:{
    "solo account":{"1m":145},
    "shared account":{"1m":50,"2m":90,"3m":125}
  }},
  {id:'crunchyroll',name:'Crunchyroll',category:'entertainment',icon:'🎮',pricing:{
    "solo profile":{"1m":75,"2m":115,"3m":160,"4m":195},
    "shared profile":{"1m":35,"2m":60,"3m":90,"4m":115}
  }},
  {id:'disney-plus',name:'Disney+',category:'entertainment',icon:'🦁',pricing:{
    "solo account":{"1m":390},
    "solo profile":{"1m":160,"2m":315,"4m":630,"10m":1480,"12m":1700},
    "shared profile":{"1m":85,"2m":165,"4m":330,"10m":720,"12m":880}
  }},
  {id:'bilibili',name:'Bilibili',category:'entertainment',icon:'📺',pricing:{
    "shared account":{"1m":45,"2m":75,"3m":105}
  }},
  {id:'loklok',name:'Loklok',category:'entertainment',icon:'📱',pricing:{
    "solo account":{"1m":150},
    "shared account":{"1m":65,"2m":115,"3m":170}
  }},
  {id:'iqiyi',name:'iQiyi',category:'entertainment',icon:'📺',pricing:{
    "shared account":{"1m":50,"2m":90,"3m":135}
  }},
  {id:'hbo-max',name:'HBO Max',category:'entertainment',icon:'📹',pricing:{
    "solo account":{"1m":240,"2m":360,"3m":480},
    "solo profile":{"1m":135,"2m":240,"3m":350},
    "shared profile":{"1m":70,"2m":120,"3m":170}
  }},
  {id:'amazon-prime',name:'Amazon Prime',category:'entertainment',icon:'🛒',pricing:{
    "solo account":{"1m":80,"2m":110,"3m":135,"4m":160,"5m":185,"6m":210},
    "solo profile":{"1m":50,"2m":80,"3m":110,"4m":135,"5m":150,"6m":170},
    "shared profile":{"1m":30,"2m":50,"3m":70,"4m":80,"5m":90,"6m":100}
  }},
  {id:'youku',name:'Youku',category:'entertainment',icon:'📺',pricing:{
    "solo account":{"1m":125},
    "shared account":{"1m":50,"2m":90,"3m":125}
  }},
  {id:'nba-league-pass',name:'NBA League Pass Premium',category:'entertainment',icon:'🏀',pricing:{
    "solo account":{"1m":150},
    "shared account":{"1m":75}
  }},
  // Streaming
  {id:'youtube',name:'YouTube Premium',category:'streaming',icon:'📹',pricing:{
    "famhead":{"1m":70,"2m":90,"3m":125,"4m":150,"5m":175,"6m":200},
    "solo":{"1m":45,"2m":60,"3m":85,"4m":105,"5m":125,"6m":145},
    "invite":{"1m":20,"2m":35,"3m":50,"4m":60,"5m":70,"6m":80}
  }},
  {id:'spotify',name:'Spotify Premium',category:'streaming',icon:'🎵',pricing:{
    "solo fw":{"1m":60,"2m":110,"3m":150,"4m":200},
    "solo nw":{"1m":45,"2m":80,"3m":120,"4m":150}
  }},
  {id:'apple-music',name:'Apple Music',category:'streaming',icon:'🎧',pricing:{
    "solo account":{"1m":49,"2m":89,"3m":129,"4m":159}
  }},
  // AI
  {id:'chatgpt',name:'ChatGPT Plus',category:'ai',icon:'🧠',pricing:{
    "solo account":{"1m":600,"2m":1050,"3m":1500},
    "shared account":{"1m":120,"2m":200,"3m":290}
  }},
  {id:'blackbox-ai',name:'Blackbox AI',category:'ai',icon:'🤖',pricing:{
    "solo account":{"1m":90,"2m":170,"3m":250}
  }},
  {id:'perplexity',name:'Perplexity AI',category:'ai',icon:'🔍',pricing:{
    "solo account":{"1m":120,"4m":200,"6m":250,"12m":300,"24m":450},
    "shared account":{"1m":55,"4m":140,"6m":190,"12m":230,"24m":350}
  }},
  {id:'google-one',name:'Google One + Gemini AI',category:'ai',icon:'☁️',pricing:{
    "solo account":{"1m":50,"2m":85,"3m":120,"12m":280},
    "shared account":{"1m":30,"2m":50,"3m":80,"12m":150}
  }},
  // Educational
  {id:'quizlet',name:'Quizlet+',category:'educational',icon:'📚',pricing:{
    "solo account":{"1m":45,"2m":65,"3m":100},
    "shared account":{"1m":20,"2m":35,"3m":50}
  }},
  {id:'scribd',name:'Scribd Premium',category:'educational',icon:'📖',pricing:{
    "solo account":{"1m":50,"2m":85,"3m":120},
    "shared account":{"1m":30,"2m":50,"3m":80}
  }},
  {id:'studocu',name:'Studocu Premium',category:'educational',icon:'🎓',pricing:{
    "solo account":{"1m":50,"2m":85,"3m":120},
    "shared account":{"1m":30,"2m":50,"3m":80}
  }},
  {id:'duolingo',name:'Duolingo Super',category:'educational',icon:'🧑‍🎓',pricing:{
    "solo account":{"1m":80,"2m":130,"3m":170}
  }},
  {id:'turnitin-student',name:'Turnitin Student',category:'educational',icon:'📝',pricing:{
    "solo account":{"7d":35,"14d":50,"1m":80,"2m":140,"3m":160,"6m":330,"12m":580}
  }},
  {id:'turnitin-instructor',name:'Turnitin Instructor',category:'educational',icon:'👨‍🏫',pricing:{
    "solo account":{"1m":520},
    "shared account":{"7d":120,"14d":175,"1m":280}
  }},
  // Editing
  {id:'canva',name:'Canva Pro',category:'editing',icon:'🎨',pricing:{
    "edu lifetime":{"nw":19,"3m w":39,"6m w":49,"12m w":69},
    "teamhead":{"1m":45,"2m":55,"3m":65,"4m":75,"5m":85,"6m":95},
    "solo":{"1m":25,"2m":35,"3m":45,"4m":55,"5m":65,"6m":75},
    "invite":{"1m":10,"2m":15,"3m":20,"4m":25,"5m":30,"6m":35}
  }},
  {id:'picsart',name:'Picsart Gold',category:'editing',icon:'👏',pricing:{
    "teamhead account":{"1m":70,"2m":115,"3m":150},
    "solo account":{"1m":50,"2m":85,"3m":120},
    "shared account":{"1m":25,"2m":45,"3m":70}
  }},
  {id:'capcut',name:'CapCut Pro',category:'editing',icon:'📝',pricing:{
    "solo account":{"7d":50,"1m":130,"2m":190,"3m":240},
    "shared account":{"1m":70,"2m":120,"3m":155}
  }},
  {id:'alight-motion',name:'Alight Motion Pro',category:'editing',icon:'📱',pricing:{
    "solo account":{"1m":90,"12m":149},
    "shared account":{"1m":35,"12m":69}
  }},
  {id:'remini',name:'Remini Web',category:'editing',icon:'✨',pricing:{
    "solo account":{"7d":30,"1m":50},
    "shared account":{"7d":15,"1m":25}
  }},
  {id:'grammarly',name:'Grammarly Premium',category:'educational',icon:'✍️',pricing:{
    "solo account":{"1m":85},
    "shared account":{"1m":35,"2m":65,"3m":95}
  }},
  {id:'quillbot',name:'Quillbot Premium',category:'educational',icon:'📝',pricing:{
    "solo account":{"1m":100},
    "shared account":{"1m":45,"2m":75,"3m":110}
  }},
  {id:'ms-365',name:'Microsoft 365',category:'educational',icon:'🤬',pricing:{
    "solo account":{"1m":55,"2m":90,"3m":120},
    "shared account":{"1m":25,"2m":45,"3m":65}
  }},
  {id:'cams-canner',name:'CamScanner Pro',category:'editing',icon:'📁',pricing:{
    "solo account":{"1m":100,"2m":180,"3m":250},
    "shared account":{"1m":50,"2m":90,"3m":120}
  }},
  {id:'small-pdf',name:'Small PDF Pro',category:'editing',icon:'📁',pricing:{
    "solo account":{"1m":55,"2m":95,"3m":130},
    "shared account":{"1m":30,"2m":50,"3m":70}
  }},
  {id:'zoom',name:'Zoom Pro',category:'educational',icon:'📽️',pricing:{
    "solo account":{"14d":45,"1m":70,"2m":120,"3m":160}
  }},
];

// ---------- Seeding ----------
async function db_seedCatalog(){
  // upsert products
  const productsRows = CATALOG.map(p=>({
    id: p.id,            // using text slug as PK (match our SQL)
    name: p.name,
    category: p.category,
    icon: p.icon || null,
    updated_at: nowIso()
  }));
  let { error: e1 } = await SB.from('products').upsert(productsRows, { onConflict: 'id' });
  await _throwIf(e1);

  // upsert prices
  const prices = [];
  CATALOG.forEach(p=>{
    const pricing = p.pricing || {};
    Object.keys(pricing).forEach(accType=>{
      const table = pricing[accType] || {};
      Object.keys(table).forEach(dur=>{
        prices.push({
          product_id: p.id,
          account_type: accType,
          duration_key: dur,
          price: Number(table[dur]),
          updated_at: nowIso()
        });
      });
    });
  });
  let { error: e2 } = await SB.from('product_prices').upsert(prices, { onConflict:'product_id,account_type,duration_key' });
  await _throwIf(e2);

  return { products: productsRows.length, price_rows: prices.length };
}

// ---------- Public API used by UI ----------

// Products + prices
async function db_listProducts(){
  const { data, error } = await SB.from('products').select('*').order('category',{ascending:true}).order('name',{ascending:true});
  await _throwIf(error); return data||[];
}
async function db_getPrices(product_id){
  const { data, error } = await SB.from('product_prices').select('account_type,duration_key,price').eq('product_id', product_id);
  await _throwIf(error); return data||[];
}
async function db_listProductsWithStock(){
  const [prods, agg] = await Promise.all([
    db_listProducts(),
    SB.from('stocks').select('product_id, count:id', { count:'exact', head:false }).eq('status','available').group('product_id')
  ]);
  const counts = {};
  (agg.data||[]).forEach(r=>counts[r.product_id]=Number(r.count||0));
  return prods.map(p=>({ ...p, stock_count: counts[p.id]||0 }));
}
async function db_addProduct({name, category, icon}){
  const id = name?.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || ('p-'+rand(99999));
  const { error } = await SB.from('products').upsert([{ id, name, category, icon: icon||null, updated_at: nowIso() }], { onConflict:'id' });
  await _throwIf(error); return { id };
}
async function db_updateProduct({id, name, category, icon}){
  const patch={updated_at:nowIso()}; if(name)patch.name=name; if(category)patch.category=category; if(icon)patch.icon=icon;
  const { error } = await SB.from('products').update(patch).eq('id',id);
  await _throwIf(error);
}
async function db_deleteProduct(id){
  const { error } = await SB.from('products').delete().eq('id',id);
  await _throwIf(error);
}

// Rules
async function db_addRule({product, text}){
  const row={ product: product||'general', text, created_at: nowIso() };
  const { error } = await SB.from('rules').insert(row);
  await _throwIf(error);
}
async function db_listRules(){
  const { data, error } = await SB.from('rules').select('*').order('created_at',{ascending:false});
  await _throwIf(error); return data||[];
}
async function db_deleteRule(id){
  const { error } = await SB.from('rules').delete().eq('id',id);
  await _throwIf(error);
}

// Stocks
async function db_addStock(payload){
  const { product_id, account_type, duration_key, email, password, profile, pin, quantity=1, premium_until=null } = payload;
  const rows = Array.from({length: quantity}).map(()=>({
    id: uuidLike(),
    product_id, account_type, duration_key,
    email: email||null, password: password||null, profile: profile||null, pin: pin||null,
    premium_until: premium_until, // nullable date
    status: 'available',
    created_at: nowIso()
  }));
  const { error } = await SB.from('stocks').insert(rows);
  await _throwIf(error);
}
async function db_listAvailableStocks(){
  const { data, error } = await SB.from('stocks').select('*, products(name)').eq('status','available').order('created_at',{ascending:false});
  await _throwIf(error);
  return (data||[]).map(r=>({ ...r, product_name: r.products?.name || r.product_id }));
}
async function db_archiveStock(stockId, archived_at){
  const patch={ status:'archived', archived_at: archived_at || nowIso() };
  const { error } = await SB.from('stocks').update(patch).eq('id',stockId);
  await _throwIf(error);
}
async function db_deleteStock(stockId){
  const { error } = await SB.from('stocks').delete().eq('id',stockId);
  await _throwIf(error);
}
async function db_markSold(stockId, price){
  const { error } = await SB.from('stocks').update({ status:'sold', sold_at: nowIso(), price: Number(price)||0 }).eq('id',stockId);
  await _throwIf(error);
}
async function db_listArchived(){
  const { data, error } = await SB.from('stocks').select('*, products(name)').eq('status','archived').order('archived_at',{ascending:false});
  await _throwIf(error);
  return (data||[]).map(r=>({ ...r, product_name: r.products?.name || r.product_id }));
}
async function db_listSold(){
  const { data, error } = await SB.from('stocks').select('*, products(name)').eq('status','sold').order('sold_at',{ascending:false});
  await _throwIf(error);
  return (data||[]).map(r=>({ ...r, product_name: r.products?.name || r.product_id }));
}

// Orders
async function db_createOrder({ buyer_name, buyer_email, product_id, product_name, account_type, duration_key, price, invite_gmail }){
  const id = makeOrderId();
  const row = {
    id, status:'pending', created_at: nowIso(),
    buyer_name, buyer_email, product_id, product_name,
    account_type, duration_key, price: Number(price)||0,
    invite_gmail: invite_gmail||null
  };
  const { error } = await SB.from('orders').insert(row);
  await _throwIf(error);
  return { id };
}
async function db_listPendingOrders(){
  const { data, error } = await SB.from('orders').select('*').eq('status','pending').order('created_at',{ascending:false});
  await _throwIf(error); return data||[];
}
async function db_confirmOrder(orderId){
  const { error } = await SB.from('orders').update({ status:'confirmed', confirmed_at: nowIso() }).eq('id',orderId);
  await _throwIf(error);
}
async function db_cancelOrder(orderId){
  const { error } = await SB.from('orders').update({ status:'cancelled', cancelled_at: nowIso() }).eq('id',orderId);
  await _throwIf(error);
}

// Buyer Reports
async function db_addBuyerReport({order_id, product, issue, buyer, email}){
  const row = { id: uuidLike(), order_id, product, issue, buyer, email, status:'pending', created_at: nowIso() };
  const { error } = await SB.from('buyer_reports').insert(row);
  await _throwIf(error);
}
async function db_fetchBuyerReports(email){
  const q = SB.from('buyer_reports').select('*').order('created_at',{ascending:false});
  const { data, error } = email ? await q.eq('email', email) : await q ;
  await _throwIf(error); return data||[];
}
async function db_markReportResolved(id){
  const { error } = await SB.from('buyer_reports').update({ status:'resolved', resolved_at: nowIso() }).eq('id',id);
  await _throwIf(error);
}
async function db_deleteReport(id){
  const { error } = await SB.from('buyer_reports').delete().eq('id',id);
  await _throwIf(error);
}
async function db_listBuyerReports(){
  const { data, error } = await SB.from('buyer_reports').select('*').order('created_at',{ascending:false});
  await _throwIf(error); return data||[];
}

// Feedback
async function db_addFeedback({user,text}){
  const { error } = await SB.from('feedback').insert({ id: uuidLike(), user, text, created_at: nowIso() });
  await _throwIf(error);
}
async function db_fetchFeedback(){
  const { data, error } = await SB.from('feedback').select('*').order('created_at',{ascending:false});
  await _throwIf(error); return data||[];
}

// Admin stats
async function db_adminStats(){
  const [p, a, pend, rev] = await Promise.all([
    SB.from('products').select('id', { count:'exact', head:true }),
    SB.from('stocks').select('id', { count:'exact', head:true }).eq('status','available'),
    SB.from('orders').select('id', { count:'exact', head:true }).eq('status','pending'),
    SB.rpc?.('sum_sold_revenue') // optional RPC; if not exists, fallback
  ]);
  let revenue = 0;
  if(rev?.data!=null) revenue = Number(rev.data)||0;
  else {
    const { data, error } = await SB.from('stocks').select('price').eq('status','sold');
    if(!error) revenue = (data||[]).reduce((s,x)=>s+Number(x.price||0),0);
  }
  return {
    products: p.count||0,
    available: a.count||0,
    pending: pend.count||0,
    revenue
  };
}

// Admin allow-list check (optional)
async function db_isUidAdmin(uid){
  const { data, error } = await SB.from('admin_uids').select('uid').eq('uid', uid).maybeSingle();
  await _throwIf(error);
  return !!data;
}

// Live changes (optional)
function db_subscribeStockAndOrders(onChange){
  try{
    const ch1 = SB.channel('stk').on('postgres_changes',{event:'*',schema:'public',table:'stocks'},()=>onChange()).subscribe();
    const ch2 = SB.channel('ord').on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>onChange()).subscribe();
    return ()=>{ SB.removeChannel(ch1); SB.removeChannel(ch2); };
  }catch(e){ /* ignore on static hosting */ }
}

// ------------- Expose to window (used by pages) -------------
Object.assign(window, {
  createDbClient,
  db_seedCatalog,
  db_listProducts, db_getPrices, db_listProductsWithStock,
  db_addProduct, db_updateProduct, db_deleteProduct,
  db_addRule, db_listRules, db_deleteRule,
  db_addStock, db_listAvailableStocks, db_archiveStock, db_deleteStock, db_markSold, db_listArchived, db_listSold,
  db_createOrder, db_listPendingOrders, db_confirmOrder, db_cancelOrder,
  db_addBuyerReport, db_fetchBuyerReports, db_listBuyerReports, db_markReportResolved, db_deleteReport,
  db_addFeedback, db_fetchFeedback,
  db_adminStats, db_isUidAdmin, db_subscribeStockAndOrders,
  makeOrderId
});

// ---------- (Optional) one-click seed via URL ?seed=1 ----------
(function maybeSeed(){
  try{
    const url = new URL(location.href);
    if(url.searchParams.get('seed')==='1'){
      db_seedCatalog().then(r=>alert('Catalog seeded: '+JSON.stringify(r))).catch(e=>alert('Seed error: '+e.message));
    }
  }catch(_){}
})();
</script>