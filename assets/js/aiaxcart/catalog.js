// catalog.js — homepage data wiring (stocks/sold/rules/prices) without changing UI classes
async function sb(){ return window.supabaseClient; }

export async function fetchCatalog(){
  const s = await sb();
  const [{ data: cats, error: e1 },
         { data: prods, error: e2 },
         { data: stock, error: e3 },
         { data: sold , error: e4 }] = await Promise.all([
    s.from('categories').select('key,label').order('label'),
    s.from('products').select('key,name,category_key,icon,active').eq('active', true).order('name'),
    s.from('v_product_stock').select('*'),
    s.from('v_product_sold').select('*')
  ]);
  if (e1||e2||e3||e4) console.error(e1||e2||e3||e4);
  const stockIdx = Object.fromEntries((stock||[]).map(r => [r.product_key, r.stock_available]));
  const soldIdx  = Object.fromEntries((sold ||[]).map(r => [r.product_key, r.sold_count]));
  return {
    cats: cats||[],
    prods: (prods||[]).map(p => ({ ...p, stock: stockIdx[p.key]||0, sold: soldIdx[p.key]||0 }))
  };
}

export async function fetchOptions(product_key){
  const s = await sb();
  const [{ data: types }, { data: durs }, { data: rules }, { data: prices }] = await Promise.all([
    s.from('account_types').select('label,sort_order').eq('product_key', product_key).order('sort_order'),
    s.from('durations').select('code,days,sort_order').eq('product_key', product_key).order('sort_order'),
    s.from('product_rules').select('rules_md').eq('product_key', product_key).maybeSingle(),
    s.from('pricing').select('account_type,duration_code,price').eq('product_key', product_key)
  ]);
  const priceIdx = {};
  (prices||[]).forEach(p => priceIdx[`${p.account_type}|${p.duration_code}`]=p.price);
  return { types: types||[], durs: durs||[], rules: rules?.rules_md || '', priceIdx };
}

export function bindRealtime(onOrdersChange, onStockChange){
  const s = window.supabaseClient;
  s.channel('orders')
   .on('postgres_changes', { event: '*', schema:'public', table:'orders' }, onOrdersChange||(()=>{}))
   .subscribe();
  s.channel('stock')
   .on('postgres_changes', { event: '*', schema:'public', table:'onhand_accounts' }, onStockChange||(()=>{}))
   .subscribe();
}
