// admin.ui.js — populate dropdowns & realtime orders without changing design
import { guardAdmin } from "./admin-gate.js";
import { confirmPayment } from "./orders.js";

function q(...sels){ for(const s of sels){ const el = document.querySelector(s); if (el) return el; } return null; }

export async function initAdminUI(){
  const ok = await guardAdmin('admin-btn');
  if(!ok){ const adminBox = q('#admin-panel', '.admin-panel'); if(adminBox) adminBox.style.display = 'none'; return; }

  const s = window.supabaseClient;

  const selProduct  = q('#select-product', '.sel-product', 'select[name=product]');
  const selType     = q('#select-type', '.sel-type', 'select[name=account_type]');
  const selDuration = q('#select-duration', '.sel-duration', 'select[name=duration_code]');
  const ordersTable = q('#orders-table', '.orders-table', 'table#orders');

  const { data: products } = await s.from('products').select('key,name,active').eq('active', true).order('name');
  if (selProduct && products) selProduct.innerHTML = products.map(p => `<option value="${p.key}">${p.name}</option>`).join('');

  async function loadOptions(){
    const product_key = selProduct?.value; if(!product_key) return;
    const [{ data: types }, { data: durs }] = await Promise.all([
      s.from('account_types').select('label,sort_order').eq('product_key', product_key).order('sort_order'),
      s.from('durations').select('code,days,sort_order').eq('product_key', product_key).order('sort_order')
    ]);
    if(selType) selType.innerHTML = (types||[]).map(t => `<option value="${t.label}">${t.label}</option>`).join('');
    if(selDuration) selDuration.innerHTML = (durs||[]).map(d => `<option value="${d.code}">${d.code}</option>`).join('');
  }

  selProduct && selProduct.addEventListener('change', loadOptions);
  await loadOptions();

  async function renderOrders(){
    if(!ordersTable) return;
    const { data: orders } = await s.from('orders')
      .select('id, product_key, account_type, duration_code, price, status, payment_status, created_at, delivered_at')
      .order('created_at', { ascending: false }).limit(50);

    const tbody = ordersTable.querySelector('tbody') || ordersTable;
    if (tbody !== ordersTable) tbody.innerHTML = "";

    const rows = (orders||[]).map(o => `
      <tr data-oid="${o.id}">
        <td>${o.id.slice(0,8)}…</td>
        <td>${o.product_key}</td>
        <td>${o.account_type}</td>
        <td>${o.duration_code}</td>
        <td>${o.price?.toFixed?.(2) || o.price}</td>
        <td>${o.payment_status}</td>
        <td>${o.status}</td>
        <td>${new Date(o.created_at).toLocaleString()}</td>
        <td>${o.delivered_at ? new Date(o.delivered_at).toLocaleString() : '-'}</td>
        <td><button class="btn-confirm" data-id="${o.id}">Confirm</button></td>
      </tr>`).join('');

    if (tbody === ordersTable) ordersTable.innerHTML = rows; else tbody.innerHTML = rows;

    document.querySelectorAll('.btn-confirm').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        try{ await confirmPayment(id); await renderOrders(); }
        catch(e){ alert('Confirm failed: ' + e.message); }
      };
    });
  }

  renderOrders();
  s.channel('admin_orders')
   .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, renderOrders)
   .subscribe();
}
