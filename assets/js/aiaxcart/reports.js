// reports.js — upload report with optional image; feedback with time is automatic via timestamptz
export async function submitReport({ type, title, message, file }){
  const s = window.supabaseClient;
  let image_path = null;
  if (file){
    const { data: { user } } = await s.auth.getUser();
    const fileName = `${user?.id || 'anon'}/${Date.now()}-${file.name}`;
    const { error: upErr } = await s.storage.from('reports').upload(fileName, file, { upsert:false });
    if (upErr) throw upErr;
    image_path = fileName;
  }
  const { error } = await s.from('reports').insert({ type, title, message, image_path });
  if (error) throw error;
}

export async function leaveFeedback({ order_id, message, rating }){
  const s = window.supabaseClient;
  const { error } = await s.from('feedback').insert({ order_id, message, rating });
  if (error) throw error;
  // created_at includes time automatically
}
