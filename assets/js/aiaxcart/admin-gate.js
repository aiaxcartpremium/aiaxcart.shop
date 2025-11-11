// admin-gate.js — hide admin controls for non-admins; RLS still enforces backend security
async function isAdmin(){
  const s = window.supabaseClient;
  const { data: { user } } = await s.auth.getUser();
  if(!user) return false;
  const { data } = await s.from('admin_uids').select('uid').eq('uid', user.id).maybeSingle();
  return !!data;
}

export async function guardAdmin(btnId='admin-btn'){
  const ok = await isAdmin();
  const el = document.getElementById(btnId);
  if (el) el.style.display = ok ? '' : 'none';
  return ok;
}
