<script>
// Aiaxcart Supabase v4 – hybrid-safe helpers + DB calls
// Exposes globally: createDbClient, db_* functions

(function(){
  const CFG = (window.CONFIG_PRIVATE || window.CONFIG_PUBLIC || window.CONFIG || {}).DATABASE || {};
  const SB_URL = CFG.SUPABASE_URL;
  const SB_KEY = CFG.SUPABASE_ANON_KEY;

  if (!window.supabase) {
    console.error("[Aiaxcart] supabase-js not loaded");
  }

  function createDbClient(){
    if(!SB_URL || !SB_KEY) throw new Error("Missing Supabase URL or ANON KEY");
    if (!window.supabaseClient) {
      window.supabaseClient = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: { persistSession: false }
      });
    }
    return window.supabaseClient;
  }

  // ---------- Utils ----------
  function uuid(){
    try { return crypto.randomUUID(); }
    catch(e){
      return 'xxxxxxxyxxxx4xxxyxxxxxx'.replace(/[xy]/g, c=>{
        const r = Math.random()*16|0, v = c=='x'? r : (r&0x3|0x8);
        return v.toString(16);
      });
    }
  }
  function nowIso(){ return new Date().toISOString(); }
  function _throw(e){ throw e instanceof Error ? e : new Error(e?.message||String(e)); }
  function table(name){ return createDbClient().from(name); }

  // safe select wrapper
  async function _select(q){
    const { data, error } = await q;
    if (error) _throw(error);
    return data || [];
  }
  async function _single(q){
    const { data, error } = await q.single();
    if (error) _throw(error);
    return data;
  }

  // ---------- Public DB API ----------

  // PRODUCTS
  async function db_listProducts(){
    const q = table('products').select('*').order('name', { ascending: true });
    const list = await _select(q);
    // try to compute stock/sold if columns don't exist
    for (const p of list){
      if (typeof p.stock === 'undefined'){
        const available = await _select(
          table('stock_onhand')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', p.id).eq('status', 'available')
        );
        p.stock = available?.length || 0; // count head returns no rows; fallback
      }
      if (typeof p.sold === 'undefined'){
        const sold = await _select(
          table('stock_onhand')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', p.id).eq('status', 'sold')
        );
        p.sold = sold?.length || 0;
      }
    }
    return list;
  }

  async function db_listProductsWithStock(){
    // returns: [{product_id, name, icon, category, stock_count}]
    // Prefer a view if exists; else compose
    try {
      const q = table('v_products_with_stock').select('*').order('name',{ascending:true});
      return await _select(q);
    } catch(e){
      const products = await db_listProducts();
      return products.map(p=>({
        product_id: p.id || p.product_id || p.key || p.name,
        name: p.name,
        icon: p.icon,
        category: p.category,
        stock_count: p.stock || 0
      }));
    }
  }

  async function db_addProduct({name, category, icon}){
    const payload = { id: uuid(), name, category, icon, created_at: nowIso() };
    const { error } = await table('products').insert(payload);
    if (error) _throw(error);
    return payload;
  }
  async function db_updateProduct({id,name,category,icon}){
    const patch = {};
    if (name) patch.name = name;
    if (category) patch.category = category;
    if (icon) patch.icon = icon;
    const { error } = await table('products').update(patch).eq('id', id);
    if (error) _throw(error);
    return true;
  }
  async function db_deleteProduct(id){
    const { error } = await table('products').delete().eq('id', id);
    if (error) _throw(error);
  }

  // RULES
  async function db_fetchRules(){
    try{
      return await _select(table('rules').select('*').order('created_at',{ascending:false}));
    }catch(e){ return []; }
  }
  async function db_listRules(){ return db_fetchRules(); }
  async function db_addRule({product, text}){
    const payload = { id: uuid(), product: product||'general', text, created_at: nowIso() };
    const { error } = await table('rules').insert(payload);
    if (error) _throw(error);
    return payload;
  }
  async function db_deleteRule(id){
    const { error } = await table('rules').delete().eq('id', id);
    if (error) _throw(error);
  }

  // STOCKS
  async function db_addStock({product_id, account_type, duration_key, email, password, profile, pin, quantity=1}){
    const items = [];
    for(let i=0;i<Number(quantity||1);i++){
      items.push({
        id: uuid(),
        product_id, account_type, duration_key,
        email: email || null, password: password || null, profile: profile || null, pin: pin || null,
        status: 'available',
        created_at: nowIso()
      });
    }
    const { error } = await table('stock_onhand').insert(items);
    if (error) _throw(error);
    return true;
  }

  async function db_listAvailableStocks(){
    const q = table('stock_onhand')
      .select('id,product_id,account_type,duration_key,email,profile,created_at,products(name,icon)')
      .eq('status','available').order('created_at',{ascending:false});
    const data = await _select(q);
    return data.map(x=>({
      id:x.id,
      product_id:x.product_id,
      product_name:x.products?.name || '',
      account_type:x.account_type,
      duration_key:x.duration_key,
      email:x.email,
      profile:x.profile,
      created_at:x.created_at
    }));
  }

  async function db_markSold(stock_id, price){
    const { error } = await table('stock_onhand')
      .update({ status:'sold', sold_at: nowIso(), price: price||null })
      .eq('id', stock_id).eq('status','available');
    if (error) _throw(error);
    return true;
  }
  async function db_archiveStock(stock_id){
    const { error } = await table('stock_onhand')
      .update({ status:'archived', archived_at: nowIso() })
      .eq('id', stock_id).neq('status','archived');
    if (error) _throw(error);
    return true;
  }
  async function db_deleteStock(stock_id){
    const { error } = await table('stock_onhand').delete().eq('id', stock_id);
    if (error) _throw(error);
  }

  async function db_listSold(){
    const q = table('stock_onhand')
      .select('id,product_id,price,sold_at,products(name,icon)')
      .eq('status','sold').order('sold_at',{ascending:false});
    const data = await _select(q);
    return data.map(x=>({
      id:x.id, product_id:x.product_id,
      product_name:x.products?.name || '',
      price:x.price||0, sold_at:x.sold_at
    }));
  }
  async function db_listArchived(){
    const q = table('stock_onhand')
      .select('id,product_id,archived_at,account_type,duration_key,products(name,icon)')
      .eq('status','archived').order('archived_at',{ascending:false});
    const data = await _select(q);
    return data.map(x=>({
      id:x.id, product_id:x.product_id,
      product_name:x.products?.name || '',
      account_type:x.account_type, duration_key:x.duration_key,
      archived_at:x.archived_at
    }));
  }

  // ORDERS
  async function db_createOrder({
    buyer_name, buyer_email, product_id, product_name, account_type, duration_key, price, invite_gmail
  }){
    const id = uuid(); // unique order id
    const payload = {
      id,
      buyer_name, buyer_email,
      product_id, product_name: product_name||null,
      account_type, duration_key,
      price: Number(price||0),
      invite_gmail: invite_gmail || null,
      status: 'pending',
      created_at: nowIso()
    };
    const { error } = await table('orders').insert(payload);
    if (error) _throw(error);
    return payload;
  }
  async function db_listPendingOrders(){
    const q = table('orders').select('*').eq('status','pending').order('created_at',{ascending:false});
    return await _select(q);
  }
  async function db_confirmOrder(order_id){
    const { error } = await table('orders').update({ status:'confirmed', confirmed_at: nowIso() }).eq('id', order_id);
    if (error) _throw(error);
    return true;
  }
  async function db_cancelOrder(order_id){
    const { error } = await table('orders').update({ status:'canceled', canceled_at: nowIso() }).eq('id', order_id);
    if (error) _throw(error);
    return true;
  }

  // BUYER REPORTS
  async function db_addBuyerReport({order_id, product, issue, buyer, email}){
    const payload = { id: uuid(), order_id, product, issue, buyer, email, status:'pending', created_at: nowIso() };
    const { error } = await table('buyer_reports').insert(payload);
    if (error) _throw(error);
    return payload;
  }
  async function db_listBuyerReports(){
    return await _select(table('buyer_reports').select('*').order('created_at',{ascending:false}));
  }
  async function db_fetchBuyerReports(email){
    return await _select(table('buyer_reports').select('*').eq('email',email).order('created_at',{ascending:false}));
  }
  async function db_markReportResolved(id){
    const { error } = await table('buyer_reports').update({ status:'resolved', resolved_at: nowIso() }).eq('id', id);
    if (error) _throw(error);
    return true;
  }
  async function db_deleteReport(id){
    const { error } = await table('buyer_reports').delete().eq('id', id);
    if (error) _throw(error);
  }

  // FEEDBACK
  async function db_addFeedback({user,text}){
    const payload = { id: uuid(), user, text, created_at: nowIso() };
    const { error } = await table('feedback').insert(payload);
    if (error) _throw(error);
    return payload;
  }
  async function db_fetchFeedback(){
    try { return await _select(table('feedback').select('*').order('created_at',{ascending:false})); }
    catch(e){ return []; }
  }

  // ADMIN STATS (fallback compute)
  async function db_adminStats(){
    try {
      const rpc = await _single(createDbClient().rpc('admin_stats'));
      return rpc;
    } catch(e){
      const [prods, avail, pend, sold] = await Promise.all([
        db_listProducts(),
        _select(table('stock_onhand').select('id').eq('status','available')),
        db_listPendingOrders(),
        db_listSold()
      ]);
      const revenue = (sold||[]).reduce((a,b)=>a+Number(b.price||0),0);
      return {
        products: prods.length,
        available: (avail||[]).length || (prods.reduce((s,p)=>s+(p.stock||0),0)),
        pending: (pend||[]).length,
        revenue
      };
    }
  }

  // REALTIME
  function db_subscribeStockAndOrders(onChange){
    const sb = createDbClient();
    const ch = sb.channel('aiax-realtime');
    try{
      ch.on('postgres_changes', { event: '*', schema:'public', table:'orders' }, ()=> onChange && onChange());
      ch.on('postgres_changes', { event: '*', schema:'public', table:'stock_onhand' }, ()=> onChange && onChange());
      ch.subscribe(status=>{ if(status==='SUBSCRIBED'){ /* ok */ }});
    }catch(e){ /* ignore */ }
    return ()=>{ try{ sb.removeChannel(ch); }catch(e){} };
  }

  // ADMIN VERIFY (RPC or fallback)
  async function db_isUidAdmin(uid){
    try{
      const { data, error } = await createDbClient().rpc('is_uid_admin', { p_uid: uid });
      if (error) _throw(error);
      return !!data;
    }catch(e){ return false; }
  }

  // RECORDS SUMMARY (simple fallback)
  async function db_listRecordsSummary(){
    const [sold, orders] = await Promise.all([ db_listSold(), _select(table('orders').select('id')) ]);
    const revenue = (sold||[]).reduce((a,b)=>a+Number(b.price||0),0);
    return { total: (sold?.length||0)+(orders?.length||0), revenue, web:(orders?.length||0), social: 0 };
  }

  // expose
  window.createDbClient = createDbClient;

  window.db_listProducts = db_listProducts;
  window.db_listProductsWithStock = db_listProductsWithStock;
  window.db_addProduct = db_addProduct;
  window.db_updateProduct = db_updateProduct;
  window.db_deleteProduct = db_deleteProduct;

  window.db_fetchRules = db_fetchRules;
  window.db_listRules = db_listRules;
  window.db_addRule = db_addRule;
  window.db_deleteRule = db_deleteRule;

  window.db_addStock = db_addStock;
  window.db_listAvailableStocks = db_listAvailableStocks;
  window.db_markSold = db_markSold;
  window.db_archiveStock = db_archiveStock;
  window.db_deleteStock = db_deleteStock;
  window.db_listSold = db_listSold;
  window.db_listArchived = db_listArchived;

  window.db_createOrder = db_createOrder;
  window.db_listPendingOrders = db_listPendingOrders;
  window.db_confirmOrder = db_confirmOrder;
  window.db_cancelOrder = db_cancelOrder;

  window.db_addBuyerReport = db_addBuyerReport;
  window.db_listBuyerReports = db_listBuyerReports;
  window.db_fetchBuyerReports = db_fetchBuyerReports;
  window.db_markReportResolved = db_markReportResolved;
  window.db_deleteReport = db_deleteReport;

  window.db_addFeedback = db_addFeedback;
  window.db_fetchFeedback = db_fetchFeedback;

  window.db_adminStats = db_adminStats;
  window.db_subscribeStockAndOrders = db_subscribeStockAndOrders;
  window.db_isUidAdmin = db_isUidAdmin;
  window.db_listRecordsSummary = db_listRecordsSummary;

})();
</script>