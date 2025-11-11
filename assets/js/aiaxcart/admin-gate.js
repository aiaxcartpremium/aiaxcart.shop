// admin-gate.js — UI guard + backend check (no UI redesign)
async function getClient() { return window.supabaseClient; }

async function isAdmin() {
  const s = await getClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return false;
  const { data, error } = await s
    .from('admin_uids')
    .select('uid')
    .eq('uid', user.id)
    .maybeSingle();
  return !!data && !error;
}

/**
 * Hides an Admin button by id (optional) and returns boolean if admin.
 * Use on any page with an admin nav/button.
 */
export async function guardAdmin(btnId = 'admin-btn') {
  const ok = await isAdmin();
  const el = document.getElementById(btnId);
  if (el) el.style.display = ok ? '' : 'none';
  return ok;
}
