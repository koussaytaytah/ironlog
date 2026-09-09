// Notifications: per-user, in-app, read/unread, polling-friendly.
// No email yet — that's a later phase. This is the in-app layer.

async function pushNotification(supabase, { gymId = null, userId, kind, title, body, link = null, dedupeKey = null }) {
  if (dedupeKey) {
    const { data: dupe } = await supabase.from('notifications').select('*').eq('dedupeKey', dedupeKey).maybeSingle();
    if (dupe) return dupe;
  }

  const n = {
    id: 'ntf_' + Math.random().toString(36).slice(2, 10),
    gymId, userId, kind, title, body, link,
    read: 0,
    createdAt: new Date().toISOString(),
    dedupeKey: dedupeKey || null,
  };

  const { data, error } = await supabase.from('notifications').insert(n).select().single();
  if (error) console.error('pushNotification error:', error);
  return data;
}

module.exports = { pushNotification };
