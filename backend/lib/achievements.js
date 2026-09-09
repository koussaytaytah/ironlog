const { pushNotification } = require('./notifications');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

async function evaluateAchievements(supabase, user, attendanceRow) {
  const { data: achievements = [] } = await supabase.from('achievements').select('*');
  const unlockedAchievements = user.unlockedAchievements || [];
  const already = new Set(unlockedAchievements);

  const { data: myAtt = [] } = await supabase.from('attendance').select('checkInAt').eq('memberId', user.id);
  const totalVisits = myAtt.length;

  const days = new Set(myAtt.map(a => {
    const d = new Date(a.checkInAt); d.setHours(0, 0, 0, 0);
    return d.getTime();
  }));
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  while (days.has(cursor.getTime())) { streak++; cursor = new Date(cursor.getTime() - DAY_MS); }

  const hour = new Date(attendanceRow.checkInAt).getHours();
  const newUnlocks = [];

  async function unlock(ach) {
    if (already.has(ach.key)) return;

    // Update user's unlockedAchievements array in Supabase
    const updatedAchievements = [...unlockedAchievements, ach.key];
    await supabase.from('users').update({ unlockedAchievements: updatedAchievements }).eq('id', user.id);

    already.add(ach.key);
    await pushNotification(supabase, {
      gymId: user.gymId,
      userId: user.id,
      kind: 'achievement',
      title: `${ach.emoji} Achievement unlocked: ${ach.name}`,
      body: ach.description,
      link: '/achievements',
    });
    newUnlocks.push(ach);
  }

  for (const ach of achievements) {
    switch (ach.key) {
      case 'first_checkin': if (totalVisits >= 1) await unlock(ach); break;
      case 'streak_3':      if (streak >= 3) await unlock(ach); break;
      case 'streak_7':      if (streak >= 7) await unlock(ach); break;
      case 'streak_30':     if (streak >= 30) await unlock(ach); break;
      case 'visits_10':     if (totalVisits >= 10) await unlock(ach); break;
      case 'visits_50':     if (totalVisits >= 50) await unlock(ach); break;
      case 'visits_100':    if (totalVisits >= 100) await unlock(ach); break;
      case 'visits_500':    if (totalVisits >= 500) await unlock(ach); break;
      case 'early_bird':    if (hour < 7) await unlock(ach); break;
      case 'night_owl':     if (hour >= 22) await unlock(ach); break;
    }
  }

  return newUnlocks;
}

async function progressFor(supabase, user) {
  const { data: achievements = [] } = await supabase.from('achievements').select('*');
  const unlockedAchievements = user.unlockedAchievements || [];
  const unlocked = new Set(unlockedAchievements);

  const { data: myAtt = [] } = await supabase.from('attendance').select('checkInAt').eq('memberId', user.id);
  const totalVisits = myAtt.length;
  const days = new Set(myAtt.map(a => { const d = new Date(a.checkInAt); d.setHours(0,0,0,0); return d.getTime(); }));
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0,0,0,0);
  while (days.has(cursor.getTime())) { streak++; cursor = new Date(cursor.getTime() - DAY_MS); }
  const earlyCount  = myAtt.filter(a => new Date(a.checkInAt).getHours() < 7).length;
  const nightCount  = myAtt.filter(a => new Date(a.checkInAt).getHours() >= 22).length;

  const valueFor = (key) => {
    switch (key) {
      case 'first_checkin': return totalVisits >= 1 ? 1 : 0;
      case 'streak_3':      return streak;
      case 'streak_7':      return streak;
      case 'streak_30':     return streak;
      case 'visits_10':     return totalVisits;
      case 'visits_50':     return totalVisits;
      case 'visits_100':    return totalVisits;
      case 'visits_500':    return totalVisits;
      case 'early_bird':    return earlyCount;
      case 'night_owl':     return nightCount;
    }
    return 0;
  };

  return achievements.map(ach => {
    const current = valueFor(ach.key);
    const target = ach.threshold || 1;
    const isUnlocked = unlocked.has(ach.key);
    return {
      ...ach,
      unlocked: isUnlocked,
      progress: Math.min(100, Math.round((current / target) * 100)),
      current,
      target,
    };
  });
}

module.exports = { evaluateAchievements, progressFor };
