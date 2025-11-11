// admin-gate.js — hide admin controls + allow redirect
async function getClient(){ return window.supabaseClient; }
async function isAdmin(){
  const s = await getClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return false;
  const { data, error } = await s.from('admin_uids').select('uid').eq('uid', user.id).maybeSingle();
  return !!data && !error;
}
export async function guardAdmin(btnId='admin-btn'){
  const ok = await isAdmin();
  const el = document.getElementById(btnId);
  if (el) el.style.display = ok ? '' : 'none';
  return ok;
}
