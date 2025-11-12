/* Aiaxcart Supabase helper v4
   - Works with open RLS dev policies
   - Generates unique order IDs
   - Has seed mode (?seed=1) to push your full catalog & prices
*/

(function(){
  // ===== CONFIG BRIDGE =====
  const CFG = (window.CONFIG_PRIVATE || window.CONFIG_PUBLIC || window.CONFIG || {}).DATABASE || {};
  const SUPABASE_URL = CFG.SUPABASE_URL;
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY;

  if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
    console.error('[aiax] Missing Supabase config. Check window.CONFIG_PUBLIC.DATABASE.');
  }

  // ===== CLIENT =====
  function createDbClient(){
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 1 } }
    });
    return sb;
  }

  // Expose factory
  window.createDbClient = createDbClient;

  // Use one shared client inside this module as well
  const SB = createDbClient();

  // ====== UTIL ======
  const pad = (n)=> String(n).padStart(2,'0');
  function genNano(n=3){
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s=''; for(let i=0;i<n;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
    return s;
  }
  function genOrderId(){
    const d = new Date();
    const y = d.getFullYear();
    const m = pad(d.getMonth()+1), day = pad(d.getDate());
    const hh = pad(d.getHours()), mm = pad(d.getMinutes()), ss = pad(d.getSeconds());
    return `ORD-${y}${m}${day}${hh}${mm}${ss}-${genNano(3)}`;
  }

  // ====== PUBLIC (Buyer-side) ======
  async function db_listProductsWithStock(){
    // returns [{product_id, name, icon, category, stock_count, sold_count}]
    const { data, error } = await SB
      .rpc('supabase_sql', { // small trick-free approach: do with two queries + map
        // not using RPC actually; we’ll just do two queries and merge
      });
    // We'll do manual since no custom RPC is present:
    const { data: products, error: e1 } = await SB.from('products').select('id, name, icon, category').order('category').order('name');
    if(e1) throw e1;

    const { data: stocksAvail, error: e2 } = await SB
      .from('stocks')
      .select('product_id, status')
      .in('status',['available','sold']);
    if(e2) throw e2;

    const agg = {};
    for(const s of (stocksAvail||[])){
      const k = s.product_id;
      agg[k] = agg[k] || { available:0, sold:0 };
      if(s.status==='available') agg[k].available++;
      if(s.status==='sold') agg[k].sold++;
    }
    return (products||[]).map(p=>({
      product_id: p.id,
      name: p.name,
      icon: p.icon,
      category: p.category,
      stock_count: (agg[p.id]?.available)||0,
      sold_count: (agg[p.id]?.sold)||0
    }));
  }

  async function db_createOrder(payload){
    const id = genOrderId();
    const row = {
      id,
      status: 'pending',
      buyer_name: payload.buyer_name,
      buyer_email: payload.buyer_email,
      product_id: payload.product_id || null,
      product_name: payload.product_name || null,
      account_type: payload.account_type || null,
      duration_key: payload.duration_key || null,
      price: payload.price || null,
      invite_gmail: payload.invite_gmail || null
    };
    const { error } = await SB.from('orders').insert(row);
    if(error) throw error;
    return { id, ...row };
  }

  async function db_fetchRules(){
    const { data, error } = await SB
      .from('rules')
      .select('*')
      .order('product', { ascending: true })
      .order('created_at', { ascending: true });
    if(error) throw error;
    return data||[];
  }

  async function db_addBuyerReport(row){
    const { error } = await SB.from('buyer_reports').insert(row);
    if(error) throw error;
    return true;
  }
  async function db_fetchBuyerReports(email){
    const { data, error } = await SB
      .from('buyer_reports')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending:false });
    if(error) throw error;
    return data||[];
  }

  async function db_addFeedback(row){
    const { error } = await SB.from('feedback').insert(row);
    if(error) throw error;
    return true;
  }
  async function db_fetchFeedback(){
    const { data, error } = await SB
      .from('feedback').select('*').order('created_at', { ascending:false });
    if(error) throw error;
    return data||[];
  }

  // ====== ADMIN helpers ======
  async function db_isUidAdmin(uid){
    const { data, error } = await SB.from('admin_uids').select('uid').eq('uid', uid).maybeSingle();
    if(error) return false;
    return !!data;
  }

  // Products
  async function db_addProduct({id,name,category,icon}){
    const row = { id: (id||name||'').toLowerCase().replace(/\s+/g,'-'), name, category, icon };
    const { error } = await SB.from('products').insert(row);
    if(error) throw error;
  }
  async function db_listProducts(){
    // join quick counts
    const { data: products, error } = await SB.from('products').select('*').order('category').order('name');
    if(error) throw error;

    const { data: stocks } = await SB.from('stocks').select('product_id, status');
    const agg = {};
    for(const s of (stocks||[])){
      const k=s.product_id;
      agg[k] = agg[k]||{available:0,sold:0};
      if(s.status==='available') agg[k].available++;
      if(s.status==='sold') agg[k].sold++;
    }
    return (products||[]).map(p=>({ ...p, stock: agg[p.id]?.available||0, sold: agg[p.id]?.sold||0 }));
  }
  async function db_updateProduct({id,name,category,icon}){
    const patch={}; if(name) patch.name=name; if(category) patch.category=category; if(icon) patch.icon=icon;
    const { error } = await SB.from('products').update(patch).eq('id', id);
    if(error) throw error;
  }
  async function db_deleteProduct(id){
    const { error } = await SB.from('products').delete().eq('id', id);
    if(error) throw error;
  }

  // Prices
  async function db_upsertPrice(product_id, account_type, duration_key, price){
    const { error } = await SB.from('product_prices').upsert({
      product_id, account_type, duration_key, price
    });
    if(error) throw error;
  }

  // Rules
  async function db_addRule({product,text}){
    const { error } = await SB.from('rules').insert({product,text});
    if(error) throw error;
  }
  async function db_listRules(){
    const { data, error } = await SB.from('rules').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return data||[];
  }
  async function db_deleteRule(id){
    const { error } = await SB.from('rules').delete().eq('id', id);
    if(error) throw error;
  }

  // Stocks
  async function db_addStock(payload){
    // payload: {product_id, account_type, duration_key, email, password, profile, pin, premium_until, quantity}
    const q = Math.max(1, Number(payload.quantity||1));
    const rows = [];
    for(let i=0;i<q;i++){
      rows.push({
        product_id: payload.product_id,
        account_type: payload.account_type,
        duration_key: payload.duration_key,
        email: payload.email || null,
        password: payload.password || null,
        profile: payload.profile || null,
        pin: payload.pin || null,
        premium_until: payload.premium_until || null,
        status: 'available'
      });
    }
    const { error } = await SB.from('stocks').insert(rows);
    if(error) throw error;
  }
  async function db_listAvailableStocks(){
    const { data, error } = await SB
      .from('stocks')
      .select('id, product_id, account_type, duration_key, email, profile, pin, created_at')
      .eq('status','available')
      .order('created_at',{ascending:false});
    if(error) throw error;

    // Attach product names
    const map = {};
    const { data: prods } = await SB.from('products').select('id,name');
    for(const p of (prods||[])) map[p.id]=p.name;
    return (data||[]).map(x=>({ ...x, product_name: map[x.product_id]||x.product_id }));
  }
  async function db_deleteStock(id){
    const { error } = await SB.from('stocks').delete().eq('id', id);
    if(error) throw error;
  }
  async function db_archiveStock(id, archived_date){
    const patch = { status:'archived', archived_at: archived_date? new Date(archived_date).toISOString() : new Date().toISOString() };
    const { error } = await SB.from('stocks').update(patch).eq('id', id);
    if(error) throw error;
  }
  async function db_markSold(id, price){
    const { error } = await SB.from('stocks').update({
      status:'sold', price: price||null, sold_at: new Date().toISOString()
    }).eq('id', id);
    if(error) throw error;
  }
  async function db_listSold(){
    const { data, error } = await SB
      .from('stocks')
      .select('product_id, price, sold_at')
      .eq('status','sold')
      .order('sold_at',{ascending:false})
      .limit(200);
    if(error) throw error;

    const map={};
    const { data: prods } = await SB.from('products').select('id,name');
    for(const p of (prods||[])) map[p.id]=p.name;

    return (data||[]).map(x=>({ ...x, product_name: map[x.product_id]||x.product_id }));
  }
  async function db_listArchived(){
    const { data, error } = await SB
      .from('stocks')
      .select('product_id, account_type, duration_key, archived_at')
      .eq('status','archived')
      .order('archived_at',{ascending:false})
      .limit(200);
    if(error) throw error;

    const map={};
    const { data: prods } = await SB.from('products').select('id,name');
    for(const p of (prods||[])) map[p.id]=p.name;

    return (data||[]).map(x=>({ ...x, product_name: map[x.product_id]||x.product_id }));
  }

  // Orders (admin)
  async function db_listPendingOrders(){
    const { data, error } = await SB
      .from('orders').select('*')
      .eq('status','pending')
      .order('created_at',{ascending:false});
    if(error) throw error;
    return data||[];
  }
  async function db_confirmOrder(id){
    const { error } = await SB.from('orders').update({
      status:'confirmed', confirmed_at: new Date().toISOString()
    }).eq('id', id);
    if(error) throw error;
  }
  async function db_cancelOrder(id){
    const { error } = await SB.from('orders').update({
      status:'cancelled', cancelled_at: new Date().toISOString()
    }).eq('id', id);
    if(error) throw error;
  }

  // Records summary (for the Records panel)
  async function db_listRecordsSummary(){
    const [{ data: sold, error: e1 }, { data: web, error: e2 }] = await Promise.all([
      SB.from('stocks').select('price').eq('status','sold'),
      SB.from('orders').select('id')
    ]);
    if(e1) throw e1; if(e2) throw e2;
    let revenue = 0; (sold||[]).forEach(s=> revenue += Number(s.price||0));
    return { total: (sold||[]).length, revenue, web: (web||[]).length, social: 0 };
  }

  // Realtime hook
  function db_subscribeStockAndOrders(callback){
    try{
      const ch = SB.channel('aiax-realtime')
        .on('postgres_changes',{event:'*',schema:'public',table:'stocks'}, ()=>callback&&callback())
        .on('postgres_changes',{event:'*',schema:'public',table:'orders'}, ()=>callback&&callback())
        .subscribe();
      return ch;
    }catch(e){ console.warn('Realtime disabled', e); }
  }

  // Expose functions
  window.db_listProductsWithStock = db_listProductsWithStock;
  window.db_createOrder = db_createOrder;
  window.db_fetchRules = db_fetchRules;
  window.db_addBuyerReport = db_addBuyerReport;
  window.db_fetchBuyerReports = db_fetchBuyerReports;
  window.db_addFeedback = db_addFeedback;
  window.db_fetchFeedback = db_fetchFeedback;

  window.db_isUidAdmin = db_isUidAdmin;
  window.db_addProduct = db_addProduct;
  window.db_listProducts = db_listProducts;
  window.db_updateProduct = db_updateProduct;
  window.db_deleteProduct = db_deleteProduct;

  window.db_upsertPrice = db_upsertPrice;
  window.db_addRule = db_addRule;
  window.db_listRules = db_listRules;
  window.db_deleteRule = db_deleteRule;

  window.db_addStock = db_addStock;
  window.db_listAvailableStocks = db_listAvailableStocks;
  window.db_deleteStock = db_deleteStock;
  window.db_archiveStock = db_archiveStock;
  window.db_markSold = db_markSold;
  window.db_listSold = db_listSold;
  window.db_listArchived = db_listArchived;

  window.db_listPendingOrders = db_listPendingOrders;
  window.db_confirmOrder = db_confirmOrder;
  window.db_cancelOrder  = db_cancelOrder;

  window.db_adminStats = async function(){
    const [prods, avail, pend, revenue] = await Promise.all([
      SB.from('products').select('id', { count:'exact', head:true }),
      SB.from('stocks').select('id', { count:'exact', head:true }).eq('status','available'),
      SB.from('orders').select('id', { count:'exact', head:true }).eq('status','pending'),
      SB.rpc('sum_sold_revenue').select()
    ]);
    const r = Number((revenue?.data)||0);
    return {
      products: prods.count||0,
      available: avail.count||0,
      pending: pend.count||0,
      revenue: r.toFixed(2)
    };
  };

  window.db_listRecordsSummary = db_listRecordsSummary;
  window.db_subscribeStockAndOrders = db_subscribeStockAndOrders;

  // ====== SEEDER (run once): add products + prices from your list ======
  const PRODUCT_CATALOG = [
    // ----- Entertainment -----
    {id:'netflix',name:'Netflix Premium',category:'entertainment',icon:'📺',
      pricing:{
        "solo profile": {'1m':160,'2m':280,'3m':435,'4m':565,'6m':850,'8m':1090,'12m':1500},
        "shared profile": {'1m':80,'2m':145,'3m':205,'4m':270,'6m':410,'8m':520,'12m':800}
      }},
    {id:'viu',name:'Viu Premium',category:'entertainment',icon:'🎬',
      pricing:{
        "solo account": {'1m':70,'2m':105,'3m':145,'4m':170,'6m':205,'10m':280,'12m':310},
        "shared account": {'1m':30,'2m':55,'3m':75,'4m':90,'6m':120,'10m':190,'12m':220}
      }},
    {id:'viva-max',name:'VIVAMAX VIVAONE',category:'entertainment',icon:'🎭',
      pricing:{
        "solo account": {'1m':110,'2m':145,'3m':170},
        "shared account": {'1m':65,'2m':90,'3m':120}
      }},
    {id:'wetv',name:'WeTV',category:'entertainment',icon:'📱',
      pricing:{
        "solo account": {'1m':150},
        "shared account": {'1m':55,'2m':95,'3m':135}
      }},
    {id:'iwant-tfc',name:'IWANT TFC',category:'entertainment',icon:'📺',
      pricing:{
        "solo account": {'1m':145},
        "shared account": {'1m':50,'2m':90,'3m':125}
      }},
    {id:'crunchyroll',name:'Crunchyroll',category:'entertainment',icon:'🎮',
      pricing:{
        "solo profile": {'1m':75,'2m':115,'3m':160,'4m':195},
        "shared profile": {'1m':35,'2m':60,'3m':90,'4m':115}
      }},
    {id:'disney-plus',name:'Disney+',category:'entertainment',icon:'🦁',
      pricing:{
        "solo account": {'1m':390},
        "solo profile": {'1m':160,'2m':315,'4m':630,'10m':1480,'12m':1700},
        "shared profile": {'1m':85,'2m':165,'4m':330,'10m':720,'12m':880}
      }},
    {id:'bilibili',name:'Bilibili',category:'entertainment',icon:'📺',
      pricing:{ "shared account": {'1m':45,'2m':75,'3m':105} }},
    {id:'loklok',name:'Loklok',category:'entertainment',icon:'📱',
      pricing:{
        "solo account": {'1m':150},
        "shared account": {'1m':65,'2m':115,'3m':170}
      }},
    {id:'iqiyi',name:'iQiyi',category:'entertainment',icon:'📺',
      pricing:{ "shared account": {'1m':50,'2m':90,'3m':135} }},
    {id:'hbo-max',name:'HBO Max',category:'entertainment',icon:'📹',
      pricing:{
        "solo account": {'1m':240,'2m':360,'3m':480},
        "solo profile": {'1m':135,'2m':240,'3m':350},
        "shared profile": {'1m':70,'2m':120,'3m':170}
      }},
    {id:'amazon-prime',name:'Amazon Prime',category:'entertainment',icon:'🛒',
      pricing:{
        "solo account": {'1m':80,'2m':110,'3m':135,'4m':160,'5m':185,'6m':210},
        "solo profile": {'1m':50,'2m':80,'3m':110,'4m':135,'5m':150,'6m':170},
        "shared profile": {'1m':30,'2m':50,'3m':70,'4m':80,'5m':90,'6m':100}
      }},
    {id:'youku',name:'Youku',category:'entertainment',icon:'📺',
      pricing:{
        "solo account": {'1m':125},
        "shared account": {'1m':50,'2m':90,'3m':125}
      }},
    {id:'nba-league-pass',name:'NBA League Pass Premium',category:'entertainment',icon:'🏀',
      pricing:{
        "solo account": {'1m':150},
        "shared account": {'1m':75}
      }},

    // Streaming
    {id:'youtube',name:'YouTube Premium',category:'streaming',icon:'📹',
      pricing:{
        "famhead": {'1m':70,'2m':90,'3m':125,'4m':150,'5m':175,'6m':200},
        "solo": {'1m':45,'2m':60,'3m':85,'4m':105,'5m':125,'6m':145},
        "invite": {'1m':20,'2m':35,'3m':50,'4m':60,'5m':70,'6m':80}
      }},
    {id:'spotify',name:'Spotify Premium',category:'streaming',icon:'🎵',
      pricing:{ "solo fw": {'1m':60,'2m':110,'3m':150,'4m':200}, "solo nw": {'1m':45,'2m':80,'3m':120,'4m':150} }},
    {id:'apple-music',name:'Apple Music',category:'streaming',icon:'🎧',
      pricing:{ "solo account": {'1m':49,'2m':89,'3m':129,'4m':159} }},

    // AI
    {id:'chatgpt',name:'ChatGPT Plus',category:'ai',icon:'🧠',
      pricing:{ "solo account": {'1m':600,'2m':1050,'3m':1500}, "shared account": {'1m':120,'2m':200,'3m':290} }},
    {id:'blackbox-ai',name:'Blackbox AI',category:'ai',icon:'🤖',
      pricing:{ "solo account": {'1m':90,'2m':170,'3m':250} }},
    {id:'perplexity',name:'Perplexity AI',category:'ai',icon:'🔍',
      pricing:{ "solo account": {'1m':120,'4m':200,'6m':250,'12m':300,'24m':450}, "shared account": {'1m':55,'4m':140,'6m':190,'12m':230,'24m':350} }},
    {id:'google-one',name:'Google One + Gemini AI',category:'ai',icon:'☁️',
      pricing:{ "solo account": {'1m':50,'2m':85,'3m':120,'12m':280}, "shared account": {'1m':30,'2m':50,'3m':80,'12m':150} }},

    // Educational
    {id:'quizlet',name:'Quizlet+',category:'educational',icon:'📚',
      pricing:{ "solo account": {'1m':45,'2m':65,'3m':100}, "shared account": {'1m':20,'2m':35,'3m':50} }},
    {id:'scribd',name:'Scribd Premium',category:'educational',icon:'📖',
      pricing:{ "solo account": {'1m':50,'2m':85,'3m':120}, "shared account": {'1m':30,'2m':50,'3m':80} }},
    {id:'studocu',name:'Studocu Premium',category:'educational',icon:'🎓',
      pricing:{ "solo account": {'1m':50,'2m':85,'3m':120}, "shared account": {'1m':30,'2m':50,'3m':80} }},
    {id:'duolingo',name:'Duolingo Super',category:'educational',icon:'🧑‍🎓',
      pricing:{ "solo account": {'1m':80,'2m':130,'3m':170} }},
    {id:'turnitin-student',name:'Turnitin Student',category:'educational',icon:'📝',
      pricing:{ "solo account": {'7d':35,'14d':50,'1m':80,'2m':140,'3m':160,'6m':330,'12m':580} }},
    {id:'turnitin-instructor',name:'Turnitin Instructor',category:'educational',icon:'👨‍🏫',
      pricing:{ "solo account": {'1m':520}, "shared account": {'7d':120,'14d':175,'1m':280} }},

    // Editing
    {id:'canva',name:'Canva Pro',category:'editing',icon:'🎨',
      pricing:{ "edu lifetime": {'nw':19,'3m w':39,'6m w':49,'12m w':69},
                "teamhead": {'1m':45,'2m':55,'3m':65,'4m':75,'5m':85,'6m':95},
                "solo": {'1m':25,'2m':35,'3m':45,'4m':55,'5m':65,'6m':75},
                "invite": {'1m':10,'2m':15,'3m':20,'4m':25,'5m':30,'6m':35} }},
    {id:'picsart',name:'Picsart Gold',category:'editing',icon:'👏',
      pricing:{ "teamhead account": {'1m':70,'2m':115,'3m':150},
                "solo account": {'1m':50,'2m':85,'3m':120},
                "shared account": {'1m':25,'2m':45,'3m':70} }},
    {id:'capcut',name:'CapCut Pro',category:'editing',icon:'📝',
      pricing:{ "solo account": {'7d':50,'1m':130,'2m':190,'3m':240},
                "shared account": {'1m':70,'2m':120,'3m':155} }},
    {id:'alight-motion',name:'Alight Motion Pro',category:'editing',icon:'📱',
      pricing:{ "solo account": {'1m':90,'12m':149}, "shared account": {'1m':35,'12m':69} }},
    {id:'remini',name:'Remini Web',category:'editing',icon:'✨',
      pricing:{ "solo account": {'7d':30,'1m':50}, "shared account": {'7d':15,'1m':25} }},
    {id:'grammarly',name:'Grammarly Premium',category:'educational',icon:'✍️',
      pricing:{ "solo account": {'1m':85}, "shared account": {'1m':35,'2m':65,'3m':95} }},
    {id:'quillbot',name:'Quillbot Premium',category:'educational',icon:'📝',
      pricing:{ "solo account": {'1m':100}, "shared account": {'1m':45,'2m':75,'3m':110} }},
    {id:'ms-365',name:'Microsoft 365',category:'educational',icon:'🤬',
      pricing:{ "solo account": {'1m':55,'2m':90,'3m':120}, "shared account": {'1m':25,'2m':45,'3m':65} }},
    {id:'cams-canner',name:'CamScanner Pro',category:'editing',icon:'📁',
      pricing:{ "solo account": {'1m':100,'2m':180,'3m':250}, "shared account": {'1m':50,'2m':90,'3m':120} }},
    {id:'small-pdf',name:'Small PDF Pro',category:'editing',icon:'📁',
      pricing:{ "solo account": {'1m':55,'2m':95,'3m':130}, "shared account": {'1m':30,'2m':50,'3m':70} }},
    {id:'zoom',name:'Zoom Pro',category:'educational',icon:'📽️',
      pricing:{ "solo account": {'14d':45,'1m':70,'2m':120,'3m':160} }}
  ];

  async function seedProducts(){
    // upsert products
    for(const p of PRODUCT_CATALOG){
      await SB.from('products').upsert({ id:p.id, name:p.name, category:p.category, icon:p.icon });
      // upsert prices
      for(const acct in (p.pricing||{})){
        const table = p.pricing[acct];
        for(const dur in table){
          await SB.from('product_prices').upsert({
            product_id: p.id, account_type: acct, duration_key: dur, price: table[dur]
          });
        }
      }
    }
    console.log('[aiax] Seeding complete.');
  }

  // Run seeder if URL has ?seed=1
  try{
    const u = new URL(String(location));
    if(u.searchParams.get('seed')==='1'){ seedProducts(); }
  }catch(_){}

})();