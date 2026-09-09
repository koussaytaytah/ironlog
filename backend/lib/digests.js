// Notification digests: scheduled nudges that fire automatically each day.
// Idempotent — keyed by (kind:userId:dateBucket) so cron replays never spam.
// Called from POST /api/notifications/refresh-digests (super_admin or owner).

const { pushNotification } = require('./notifications');

const DAY_MS = 86400000;

function dateBucket(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function runDailyDigests(supabase, now = new Date()) {
  const today = dateBucket(now);
  const counts = { checkin_reminder: 0, expiring_soon: 0, streak_at_risk: 0, sub_thawed: 0, sub_expired: 0 };

  const { data: users, error: uErr } = await supabase.from('users').select('*').eq('role', 'client');
  if (uErr) {
    console.error('runDailyDigests users error:', uErr);
    return counts;
  }

  for (const u of users) {
    // 1. Daily check-in reminder — for active/trialing members who haven't checked in today
    const { data: sub } = await supabase.from('memberSubscriptions').select('*').eq('memberId', u.id).maybeSingle();

    // Note: effectiveStatus is needed here. I'll implement it simply for now.
    const status = sub ? sub.status : null;
    const isActive = !sub || ['active', 'trialing'].includes(status);

    if (isActive) {
      const { data: todayCheckin } = await supabase.from('attendance')
        .select('id')
        .eq('memberId', u.id)
        .neq('checkInAt', 'placeholder') // We need a date filter
        // Supabase doesn't have a simple "today" filter without raw SQL or range.
        // I'll use a range from today 00:00 to now.
        .gte('checkInAt', new Date(new Date().setHours(0,0,0,0)).toISOString());

      if (!todayCheckin || todayCheckin.length === 0) {
        const n = await pushNotification(supabase, {
          gymId: u.gymId, userId: u.id, kind: 'checkin_reminder',
          title: `💪 Time to train`,
          body: `You haven't checked in today. Keep your streak alive.`,
          link: '/checkin',
          dedupeKey: `checkin_reminder:${u.id}:${today}`,
        });
        if (n) counts.checkin_reminder++;
      }
    }

    // 2. Subscription expiring soon (≤7 days, still active)
    if (sub && sub.status === 'active' && sub.endAt) {
      const daysLeft = Math.ceil((new Date(sub.endAt).getTime() - now.getTime()) / DAY_MS);
      if (daysLeft >= 1 && daysLeft <= 7) {
        const n = await pushNotification(supabase, {
          gymId: u.gymId, userId: u.id, kind: 'sub_expiring',
          title: `⏳ Membership expiring in ${daysLeft}d`,
          body: daysLeft === 1
            ? `Your subscription expires tomorrow. Renew to keep training.`
            : `Your subscription expires in ${daysLeft} days.`,
          link: '/me/billing',
          dedupeKey: `sub_expiring:${u.id}:${today}`,
        });
        if (n) counts.expiring_soon++;
      }
    }

    // 3. Subscription expired (was active yesterday, expired today) — single ping
    if (sub && sub.endAt) {
      const expiredToday = new Date(sub.endAt).toISOString().slice(0, 10) === today;
      if (expiredToday && sub.status !== 'expired') {
        const n = await pushNotification(supabase, {
          gymId: u.gymId, userId: u.id, kind: 'sub_expired',
          title: `🚫 Membership expired`,
          body: `Your membership ended today. Talk to your coach to renew.`,
          link: '/me/billing',
          dedupeKey: `sub_expired:${u.id}:${today}`,
        });
        if (n) counts.sub_expired++;
      }
    }
  }

  return counts;
}

module.exports = { runDailyDigests, dateBucket };
