/* assets/js/aiaxcart/supabase.js  — v4
   Works with the index.html/admin.html provided by user.
   Uses window.CONFIG_PUBLIC.DATABASE + ADMIN.OWNER_UID from the page.
*/

(function(global){

  // ---- CONFIG ----
  const CFG = (global.CONFIG_PUBLIC || global.CONFIG || {}).DATABASE || {};
  const ADMIN_CFG = (global.CONFIG_PUBLIC || global.CONFIG || {}).ADMIN || {};
  if(!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY){
    console.error('[aiaxcart v4] Missing Supabase config.');
  }

  // ---- CLIENT ----
  function createDbClient(){
    if(!global.supabase) { throw new Error('supabase-js not loaded'); }
    return global.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      db:   { schema:'public' },
      realtime: { params: { eventsPerSecond: 5 } }
    });
  }

  const SB = createDbClient();

  // ---- ID HELPERS ----
  function rnd(n){ return Math.floor(Math.random()*n).toString(36); }
  function genId(prefix='id'){
    // prefer crypto.randomUUID if available; else custom
    if (typeof crypto!=='undefined' && crypto.randomUUID){
      return `${prefix}_${crypto.randomUUID().replace(/-/g,'')}`;
    }
    const ts = Date.now().toString(36);
    return `${prefix}_${ts}${rnd(1e8)}${rnd(1e8)}`;
  }

  // ---- SAFE SELECT helper ----
  async function safeSelect(q){
    const { data, error } = await q;
    if(error){ console.warn('[aiaxcart] select error:', error.message); return []; }
    return data || [];
  }
  async function safeSingle(q){
    const { data, error } = await q;
    if(error){ console.warn('[aiaxcart] single error:', error.message); return null; }
    return data || null;
  }
  async function safeExec(q){
    const { data, error } = await q;
    if(error){ throw error; }
    return data;
  }

  // ===== PUBLIC (Buyer) =====

  // Products with available stock count
  async function db_listProductsWithStock(){
    // 1) fetch products
    const products = await safeSelect(
      SB.from('products').select('id,name,category,icon').order('name',{ascending:true})
    );

    if(!products.length){
      // Return empty gracefully
      return [];
    }

    // 2) fetch counts per product from onhand_accounts (not archived, not sold)
    const onhand = await safeSelect(
      SB.from('onhand_accounts')
        .select('product_id,is_archived,is_sold', { count:'exact', head:false })
        .in('product_id', products.map(p=>p.id))
    );

    // build count map
    const map = {};
    onhand.forEach(x=>{
      if(x.is_archived || x.is_sold) return;
      map[x.product_id] = (map[x.product_id] || 0) + 1;
    });

    // 3) merge
    return products.map(p=>({
      product_id: p.id,
      name: p.name,
      category: p.category,
      icon: p.icon,
      stock_count: map[p.id] || 0
    }));
  }

  // Create order (unique ID here)
  async function db_createOrder(payload){
    const id = genId('ord');
    const row = {
      id,
      buyer_name:  payload.buyer_name || null,
      buyer_email: payload.buyer_email || null,
      product_id:  payload.product_id || null,
      product_name:payload.product_name || null,
      account_type:payload.account_type || null,
      duration_key:payload.duration_key || null,
      price:       payload.price ?? null,
      invite_gmail:payload.invite_gmail || null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    await safeExec(SB.from('orders').insert(row));
    return { id, ...row };
  }

  // Rules (public view)
  async function db_fetchRules(){
    return await safeSelect(
      SB.from('rules').select('id,product,text,created_at').order('created_at',{ascending:false})
    );
  }

  // Feedback
  async function db_addFeedback({user,text}){
    const row = { id:genId('fb'), user, text, created_at:new Date().toISOString() };
    await safeExec(SB.from('feedback').insert(row));
    return row;
  }
  async function db_fetchFeedback(){
    return await safeSelect(
      SB.from('feedback').select('id,user,text,created_at').order('created_at',{ascending:false})
    );
  }

  // Buyer Reports
  async function db_addBuyerReport(row){
    const rec = {
      id: genId('rep'),
      order_id: row.order_id || null,
      product:  row.product  || null,
      issue:    row.issue    || null,
      buyer:    row.buyer    || null,
      email:    row.email    || null,
      status:   'pending',
      created_at: new Date().toISOString()
    };
    await safeExec(SB.from('buyer_reports').insert(rec));
    return rec;
  }
  async function db_fetchBuyerReports(email){
    if(!email) return [];
    return await safeSelect(
      SB.from('buyer_reports')
        .select('id,order_id,product,issue,status,created_at')
        .eq('email',email)
        .order('created_at',{ascending:false})
    );
  }

  // ===== ADMIN =====

  // Auth helper (DB-side check)
  async function db_isUidAdmin(uid){
    try{
      const row = await safeSingle(
        SB.from('admin_uids').select('uid').eq('uid', uid).maybeSingle()
      );
      return !!row;
    }catch(_){ return false; }
  }

  // Products CRUD
  async function db_listProducts(){
    // optionally enrich with stock/sold counts
    const prods = await safeSelect(SB.from('products').select('id,name,category,icon').order('name',{ascending:true}));
    const onhand = await safeSelect(SB.from('onhand_accounts').select('id,product_id,is_sold,is_archived'));
    const sold = await safeSelect(SB.from('onhand_accounts').select('id,product_id,is_sold').eq('is_sold',true));
    const stockMap = {};
    onhand.forEach(a=>{ if(!a.is_archived && !a.is_sold){ stockMap[a.product_id]=(stockMap[a.product_id]||0)+1; }});
    const soldMap = {};
    sold.forEach(a=>{ soldMap[a.product_id]=(soldMap[a.product_id]||0)+1; });
    return prods.map(p=>({ ...p, stock: stockMap[p.id]||0, sold: soldMap[p.id]||0 }));
  }
  async function db_addProduct({name,category,icon}){
    const row = { id: genId('prd'), name, category, icon };
    await safeExec(SB.from('products').insert(row));
    return row;
  }
  async function db_updateProduct({id,name,category,icon}){
    const patch = {};
    if(name) patch.name=name;
    if(category) patch.category=category;
    if(icon) patch.icon=icon;
    if(!Object.keys(patch).length) return;
    await safeExec(SB.from('products').update(patch).eq('id',id));
  }
  async function db_deleteProduct(id){
    await safeExec(SB.from('products').delete().eq('id',id));
  }

  // Stocks
  async function db_addStock(payload){
    const qty = Number(payload.quantity||1);
    const base = {
      product_id:  payload.product_id,
      account_type:payload.account_type,
      duration_key:payload.duration_key,
      email:   payload.email   || null,
      password:payload.password|| null,
      profile: payload.profile || null,
      pin:     payload.pin     || null,
      is_archived:false,
      is_sold:false
    };
    const rows = [];
    for(let i=0;i<qty;i++){
      rows.push({ ...base, id: genId('stk'), created_at:new Date().toISOString() });
    }
    await safeExec(SB.from('onhand_accounts').insert(rows));
    return rows;
  }
  async function db_listAvailableStocks(){
    return await safeSelect(
      SB.from('onhand_accounts')
        .select('id,product_id,account_type,duration_key,email,profile,pin,created_at,products(name)')
        .eq('is_archived', false).eq('is_sold', false)
        .order('created_at',{ascending:false})
    ).then(rows => rows.map(r=>({
      id:r.id,
      product_id:r.product_id,
      product_name: (r.products && r.products.name) || '',
      account_type:r.account_type,
      duration_key:r.duration_key,
      email:r.email,
      profile:r.profile,
      pin:r.pin
    })));
  }
  async function db_markSold(stock_id, price){
    // mark stock sold + write sold_at + (optional) price
    await safeExec(
      SB.from('onhand_accounts').update({ is_sold:true, sold_at:new Date().toISOString(), price: price||null })
        .eq('id', stock_id)
    );
  }
  async function db_archiveStock(stock_id){
    await safeExec(SB.from('onhand_accounts').update({ is_archived:true, archived_at:new Date().toISOString() }).eq('id',stock_id));
  }
  async function db_deleteStock(stock_id){
    await safeExec(SB.from('onhand_accounts').delete().eq('id',stock_id));
  }
  async function db_listSold(){
    return await safeSelect(
      SB.from('onhand_accounts')
        .select('id,product_id,price,sold_at,products(name)')
        .eq('is_sold',true)
        .order('sold_at',{ascending:false})
    ).then(rows=>rows.map(r=>({
      id:r.id,
      product_id:r.product_id,
      product_name:(r.products&&r.products.name)||'',
      price:r.price||0,
      sold_at:r.sold_at
    })));
  }
  async function db_listArchived(){
    return await safeSelect(
      SB.from('onhand_accounts')
        .select('id,product_id,account_type,duration_key,archived_at,products(name)')
        .eq('is_archived',true)
        .order('archived_at',{ascending:false})
    ).then(rows=>rows.map(r=>({
      id:r.id,
      product_id:r.product_id,
      product_name:(r.products&&r.products.name)||'',
      account_type:r.account_type,
      duration_key:r.duration_key,
      archived_at:r.archived_at
    })));
  }

  // Orders workflow
  async function db_listPendingOrders(){
    return await safeSelect(
      SB.from('orders')
        .select('id,buyer_name,buyer_email,product_id,product_name,account_type,duration_key,price,created_at')
        .eq('status','pending')
        .order('created_at',{ascending:true})
    );
  }
  async function db_confirmOrder(order_id){
    // 1) find one available stock for the product
    const order = await safeSingle(
      SB.from('orders').select('id,product_id,price').eq('id',order_id).maybeSingle()
    );
    if(!order) throw new Error('Order not found');

    const stock = await safeSingle(
      SB.from('onhand_accounts')
        .select('id').eq('product_id', order.product_id)
        .eq('is_archived',false).eq('is_sold',false)
        .order('created_at',{ascending:true}).limit(1).maybeSingle()
    );
    if(!stock) throw new Error('No available stock for this product');

    // 2) mark stock sold
    await db_markSold(stock.id, order.price||null);

    // 3) set order status
    await safeExec(SB.from('orders').update({ status:'confirmed', confirmed_at:new Date().toISOString(), stock_id:stock.id }).eq('id',order_id));
  }
  async function db_cancelOrder(order_id){
    await safeExec(SB.from('orders').update({ status:'cancelled', cancelled_at:new Date().toISOString() }).eq('id',order_id));
  }

  // Rules admin
  async function db_listRules(){
    return await safeSelect(SB.from('rules').select('id,product,text,created_at').order('created_at',{ascending:false}));
  }
  async function db_addRule({product,text}){
    const row = { id:genId('rul'), product:product||'general', text, created_at:new Date().toISOString() };
    await safeExec(SB.from('rules').insert(row));
    return row;
  }
  async function db_deleteRule(id){
    await safeExec(SB.from('rules').delete().eq('id',id));
  }

  // Buyer Reports (admin)
  async function db_listBuyerReports(){
    return await safeSelect(
      SB.from('buyer_reports').select('id,order_id,buyer,product,issue,status,created_at').order('created_at',{ascending:false})
    );
  }
  async function db_markReportResolved(id){
    await safeExec(SB.from('buyer_reports').update({ status:'resolved', resolved_at:new Date().toISOString() }).eq('id',id));
  }
  async function db_deleteReport(id){
    await safeExec(SB.from('buyer_reports').delete().eq('id',id));
  }

  // Records summary
  async function db_listRecordsSummary(){
    // total orders + revenue (confirmed)
    const conf = await safeSelect(
      SB.from('orders').select('price,status').eq('status','confirmed')
    );
    const all  = await safeSelect(SB.from('orders').select('id'));
    const revenue = conf.reduce((t,r)=> t + (Number(r.price)||0), 0);
    // (Optional) if you track source, you can split; else mock 100% web
    return { total: all.length, revenue, web: all.length, social: 0 };
  }

  // Admin stats
  async function db_adminStats(){
    const prods = await safeSelect(SB.from('products').select('id'));
    const avail = await safeSelect(SB.from('onhand_accounts').select('id').eq('is_archived',false).eq('is_sold',false));
    const pend  = await safeSelect(SB.from('orders').select('id').eq('status','pending'));
    const conf  = await safeSelect(SB.from('orders').select('price').eq('status','confirmed'));
    const revenue = conf.reduce((t,r)=> t + (Number(r.price)||0), 0);
    return { products: prods.length, available: avail.length, pending: pend.length, revenue };
  }

  // Realtime (lightweight)
  function db_subscribeStockAndOrders(onChange){
    try{
      const ch1 = SB.channel('rt_orders').on('postgres_changes',
        { event:'*', schema:'public', table:'orders' },
        ()=> onChange && onChange()
      ).subscribe();
      const ch2 = SB.channel('rt_onhand').on('postgres_changes',
        { event:'*', schema:'public', table:'onhand_accounts' },
        ()=> onChange && onChange()
      ).subscribe();
      return ()=>{ SB.removeChannel(ch1); SB.removeChannel(ch2); };
    }catch(e){ console.warn('realtime not available', e?.message); return ()=>{}; }
  }

  // ---- EXPORTS ----
  global.createDbClient = createDbClient;

  global.db_listProductsWithStock = db_listProductsWithStock;
  global.db_createOrder = db_createOrder;

  global.db_fetchRules = db_fetchRules;

  global.db_addFeedback = db_addFeedback;
  global.db_fetchFeedback = db_fetchFeedback;

  global.db_addBuyerReport = db_addBuyerReport;
  global.db_fetchBuyerReports = db_fetchBuyerReports;

  // admin
  global.db_isUidAdmin = db_isUidAdmin;

  global.db_listProducts = db_listProducts;
  global.db_addProduct = db_addProduct;
  global.db_updateProduct = db_updateProduct;
  global.db_deleteProduct = db_deleteProduct;

  global.db_addStock = db_addStock;
  global.db_listAvailableStocks = db_listAvailableStocks;
  global.db_markSold = db_markSold;
  global.db_archiveStock = db_archiveStock;
  global.db_deleteStock = db_deleteStock;
  global.db_listSold = db_listSold;
  global.db_listArchived = db_listArchived;

  global.db_listPendingOrders = db_listPendingOrders;
  global.db_confirmOrder = db_confirmOrder;
  global.db_cancelOrder = db_cancelOrder;

  global.db_listRules = db_listRules;
  global.db_addRule = db_addRule;
  global.db_deleteRule = db_deleteRule;

  global.db_listBuyerReports = db_listBuyerReports;
  global.db_markReportResolved = db_markReportResolved;
  global.db_deleteReport = db_deleteReport;

  global.db_listRecordsSummary = db_listRecordsSummary;
  global.db_adminStats = db_adminStats;

  global.db_subscribeStockAndOrders = db_subscribeStockAndOrders;

})(window);