const { v4: uuidv4 } = require('uuid');
const { pushNotification } = require('./notifications');

async function evaluatePRs(supabase, member, { exerciseId, exerciseName, weight, reps }) {
  const newPRs = [];

  if (typeof weight === 'number' && weight > 0) {
    const { data: prevHeaviest } = await supabase
      .from('personalRecords')
      .select('*')
      .eq('memberId', member.id)
      .eq('exerciseId', exerciseId)
      .eq('kind', 'heaviest_weight')
      .order('value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prevHeaviest || weight > prevHeaviest.value) {
      const pr = {
        id: 'pr_' + uuidv4().slice(0, 8),
        memberId: member.id,
        exerciseId,
        exerciseName,
        kind: 'heaviest_weight',
        value: weight,
        repsAtValue: reps || null,
        achievedAt: new Date().toISOString(),
      };
      const { error: insErr } = await supabase.from('personalRecords').insert(pr);
      if (!insErr) {
        newPRs.push(pr);
        await pushNotification(supabase, {
          gymId: member.gymId,
          userId: member.id,
          kind: 'pr',
          title: `🔥 New PR: ${exerciseName}`,
          body: `You hit ${weight}kg${reps ? ` × ${reps}` : ''} — your heaviest yet.`,
          link: '/progress',
        });
      }
    }
  }

  if (typeof weight === 'number' && weight > 0 && typeof reps === 'number' && reps > 0) {
    const { data: prevSameWeight } = await supabase
      .from('personalRecords')
      .select('*')
      .eq('memberId', member.id)
      .eq('exerciseId', exerciseId)
      .eq('kind', 'max_reps_at_weight')
      .eq('value', weight)
      .order('repsAtValue', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prevSameWeight || reps > (prevSameWeight.repsAtValue || 0)) {
      const pr = {
        id: 'pr_' + uuidv4().slice(0, 8),
        memberId: member.id,
        exerciseId,
        exerciseName,
        kind: 'max_reps_at_weight',
        value: weight,
        repsAtValue: reps,
        achievedAt: new Date().toISOString(),
      };
      const { error: insErr } = await supabase.from('personalRecords').insert(pr);
      if (!insErr) {
        if (!newPRs.find(p => p.kind === 'heaviest_weight' && p.value === weight)) {
          await pushNotification(supabase, {
            gymId: member.gymId,
            userId: member.id,
            kind: 'pr',
            title: `💪 Rep PR: ${exerciseName}`,
            body: `${reps} reps at ${weight}kg — a new high.`,
            link: '/progress',
          });
        }
        newPRs.push(pr);
      }
    }
  }

  return newPRs;
}

async function listFor(supabase, memberId) {
  const { data: all, error } = await supabase
    .from('personalRecords')
    .select('*')
    .eq('memberId', memberId)
    .order('achievedAt', { ascending: false });

  if (error) return [];

  const byExercise = {};
  for (const p of all) {
    if (!byExercise[p.exerciseId]) {
      byExercise[p.exerciseId] = {
        exerciseId: p.exerciseId,
        exerciseName: p.exerciseName,
        records: [],
      };
    }
    byExercise[p.exerciseId].records.push(p);
  }

  return Object.values(byExercise).sort((a, b) =>
    new Date(b.records[0].achievedAt) - new Date(a.records[0].achievedAt)
  );
}

module.exports = { evaluatePRs, listFor };
