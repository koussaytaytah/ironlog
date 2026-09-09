const ICONS = {
  card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
  dumbbell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6v12M18 6v12M3 8v4M21 8v4M6 12h12M4 10h2M20 10h2M4 14h2M20 14h2"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/><circle cx="17" cy="8" r="2.6"/><path d="M23 20c0-3-2-5.6-5-6.5"/></svg>',
  clipboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2"/><path d="M9 11h6M9 15h6"/></svg>',
  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.1 8.6 22 9.6 17 14.6 18.2 21.5 12 18.2 5.8 21.5 7 14.6 2 9.6 8.9 8.6"/></svg>',
  building:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20"/><path d="M9 22v-4h6v4M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2v6M7 2v4a2 2 0 0 0 4 0V2M15 2v20M15 8c3 0 4-2 4-6"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg>',
  ban:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/></svg>',
  receipt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M9 7h6M9 11h6M9 15h6"/></svg>',
};

const EXERCISES = [
  // =================== CHEST ===================
  {id:'ex_bench_bb', name:'Barbell Bench Press', primary:'Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'bench', video:'bench-press.mp4',
    steps:['Lie flat on a bench, eyes under the bar, feet planted.','Grip slightly wider than shoulders, retract scapulae, slight arch.','Unrack, lower bar to lower chest with elbows at ~45°.','Press bar in slight arc back over eyes, lock out elbows.'],
    tips:['Keep shoulder blades pinned to bench.','Drive with glutes and legs.','Wrists neutral, bar over forearm.']},
  {id:'ex_bench_db', name:'Dumbbell Bench Press', primary:'Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner', anim:'bench', gif:'Dumbbell-Bench-Press.gif',
    steps:['Sit on bench with dumbbells on thighs, lie back kicking weights up.','Start with arms extended, palms forward.','Lower dumbbells to chest level with controlled tempo.','Press back up, squeezing chest at the top.'],
    tips:['Greater range of motion than barbell.','Keep wrists stacked over elbows.']},
  {id:'ex_incline_bb', name:'Incline Barbell Bench Press', primary:'Upper Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'bench', video:'incline-bench-press.mp4',
    steps:['Set bench to 30–45°.','Grip slightly wider than shoulders.','Lower bar to upper chest.','Press up and slightly back.'],
    tips:['Avoid going too steep — shifts load to shoulders.','Retract scapulae throughout.']},
  {id:'ex_incline_db', name:'Incline Dumbbell Bench Press', primary:'Upper Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner', anim:'bench', gif:'Incline-Dumbbell-Bench-Press.gif',
    steps:['Set bench to 30–45°, sit with dumbbells on thighs.','Lie back, bring dumbbells to shoulder level.','Press up and slightly inward.','Lower with control.'],
    tips:['Allows deeper stretch than barbell incline.']},
  {id:'ex_decline_bb', name:'Decline Barbell Bench Press', primary:'Lower Chest', secondary:['Triceps'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'bench', video:'decline-bench-press.mp4',
    steps:['Set bench to -15 to -30°.','Secure feet under pads.','Lower bar to lower chest.','Press up.'],
    tips:['Less shoulder stress than flat bench.']},
  {id:'ex_pushup', name:'Push-Up', primary:'Chest', secondary:['Triceps','Anterior Deltoid','Core'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Beginner', anim:'pushup', video:'pushup.mp4',
    steps:['Plank position, hands slightly wider than shoulders.','Brace core, lower chest to floor.','Push back to start.'],
    tips:['Keep body rigid — no sag.','Elbows ~45° from torso.']},
  {id:'ex_dip', name:'Chest Dip', primary:'Lower Chest', secondary:['Triceps','Anterior Deltoid'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'pushup', video:'tricep-dip.mp4',
    steps:['Grip parallel bars, start at lockout.','Lean torso slightly forward.','Lower until shoulders below elbows.','Press back up.'],
    tips:['Forward lean = chest focus; upright = triceps focus.']},
  {id:'ex_cable_fly', name:'Cable Chest Fly', primary:'Chest', secondary:['Anterior Deltoid'], equipment:'Cable', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'bench', video:'chest-fly.mp4',
    steps:['Set pulleys at upper position, grip handles.','Step forward, arms extended with slight bend.','Sweep hands together in wide arc.','Reverse with control.'],
    tips:['Keep slight elbow bend throughout.','Squeeze chest at midline.']},
  {id:'ex_pec_deck', name:'Pec Deck Machine', primary:'Chest', secondary:['Anterior Deltoid'], equipment:'Machine', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'bench', gif:'Pec-Deck-Machine.gif',
    steps:['Sit, back against pad, forearms on vertical pads.','Squeeze arms together in front.','Return slowly.'],
    tips:['Don\'t go too heavy — keep tension on chest.']},

  // =================== BACK ===================
  {id:'ex_row_bb', name:'Bent-Over Barbell Row', primary:'Back (Lats, Rhomboids)', secondary:['Biceps','Rear Deltoid'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Intermediate', anim:'bench', gif:'Bent-Over-Barbell-Row.gif',
    steps:['Stand, feet hip-width, hinge at hips to ~45°.','Grip bar just outside knees.','Pull bar to lower chest/upper abs.','Lower with control.'],
    tips:['Keep back flat — no rounding.','Drive elbows back, not hands.']},
  {id:'ex_pullup', name:'Pull-Up', primary:'Back (Lats)', secondary:['Biceps','Rear Deltoid'], equipment:'Bodyweight', mechanics:'Compound', force:'Pull', level:'Intermediate', anim:'pullup', video:'pullup.mp4',
    steps:['Hang from bar, hands slightly wider than shoulders.','Pull chest toward bar.','Lower with control to full extension.'],
    tips:['Avoid kipping — controlled reps only.','Dead hang at bottom.']},
  {id:'ex_chinup', name:'Chin-Up', primary:'Back (Lats)', secondary:['Biceps'], equipment:'Bodyweight', mechanics:'Compound', force:'Pull', level:'Intermediate', anim:'pullup', gif:'Chin-Up.gif',
    steps:['Hang from bar, supinated grip.','Pull chin above bar.','Lower slowly.'],
    tips:['Easier on biceps than pull-up.']},
  {id:'ex_lat_pulldown', name:'Lat Pulldown', primary:'Back (Lats)', secondary:['Biceps','Rear Deltoid'], equipment:'Cable', mechanics:'Compound', force:'Pull', level:'Beginner', anim:'pullup', video:'lat-pulldown.mp4',
    steps:['Sit at machine, thighs locked.','Grip bar wider than shoulders.','Pull bar to upper chest.','Return slowly.'],
    tips:['Don\'t lean back excessively.','Drive elbows down and back.']},
  {id:'ex_seated_row', name:'Seated Cable Row', primary:'Mid Back', secondary:['Biceps','Rear Deltoid'], equipment:'Cable', mechanics:'Compound', force:'Pull', level:'Beginner', anim:'bench', gif:'Seated-Cable-Row.gif',
    steps:['Sit at cable row, feet braced, slight knee bend.','Pull handle to lower abs.','Squeeze shoulder blades.','Return slowly.'],
    tips:['Keep torso upright.','Don\'t shrug shoulders.']},
  {id:'ex_tbar_row', name:'T-Bar Row', primary:'Mid Back', secondary:['Biceps','Rear Deltoid'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Intermediate', anim:'bench', video:'t-bar-row.mp4',
    steps:['Straddle bar, hinge at hips.','Pull handle to chest.','Lower with control.'],
    tips:['Keep back flat throughout.']},
  {id:'ex_dumbbell_row', name:'One-Arm Dumbbell Row', primary:'Back (Lats)', secondary:['Biceps','Rear Deltoid'], equipment:'Dumbbell', mechanics:'Compound', force:'Pull', level:'Beginner', anim:'bench', gif:'One-Arm-Dumbbell-Row.gif',
    steps:['Hand and knee on bench, other foot on floor.','Pull dumbbell to hip.','Lower with control.'],
    tips:['Keep torso parallel to floor.','Drive elbow back.']},
  {id:'ex_face_pull', name:'Face Pull', primary:'Rear Deltoid', secondary:['Upper Back','Trapezius'], equipment:'Cable', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'curl', gif:'Face-Pull.gif',
    steps:['Set cable at upper-chest height with rope.','Pull rope to forehead, elbows high.','Externally rotate at end range.'],
    tips:['Essential for shoulder health.']},
  {id:'ex_deadlift', name:'Conventional Deadlift', primary:'Back (Lower, Traps)', secondary:['Glutes','Hamstrings','Forearms'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Advanced', anim:'squat', video:'deadlift.mp4',
    steps:['Stand with bar over mid-foot, hip-width stance.','Hinge and grip bar just outside knees.','Brace, drive floor away, extend hips and knees together.','Lock out, then reverse with control.'],
    tips:['Bar stays in contact with legs.','Neutral spine throughout.','Hinge first, then grip if mobility is limited.']},
  {id:'ex_shrug', name:'Barbell Shrug', primary:'Trapezius', secondary:['Forearms'], equipment:'Barbell', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'curl', gif:'Barbell-Shrug.gif',
    steps:['Stand holding bar at sides.','Lift shoulders toward ears.','Hold briefly.','Lower with control.'],
    tips:['No rolling — just up and down.']},

  // =================== SHOULDERS ===================
  {id:'ex_ohp_bb', name:'Overhead Press (Barbell)', primary:'Anterior Deltoid', secondary:['Lateral Deltoid','Triceps','Upper Chest'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'curl', video:'shoulder-press.mp4',
    steps:['Stand with bar at clavicle, elbows just in front.','Brace core, press bar overhead.','Lock out arms, shrug shoulders briefly.','Lower to clavicle.'],
    tips:['Don\'t flare ribs.','Squeeze glutes to lock lumbar.']},
  {id:'ex_ohp_db', name:'Seated Dumbbell Shoulder Press', primary:'Anterior Deltoid', secondary:['Triceps','Lateral Deltoid'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner', anim:'curl', gif:'Seated-Dumbbell-Shoulder-Press.gif',
    steps:['Sit on upright bench, dumbbells at ear height.','Press up and slightly together.','Lower with control.'],
    tips:['Back support reduces lower-back strain.']},
  {id:'ex_lateral_raise', name:'Dumbbell Lateral Raise', primary:'Lateral Deltoid', secondary:['Trapezius'], equipment:'Dumbbells', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'curl', video:'lateral-raise.mp4',
    steps:['Stand with dumbbells at sides.','Raise arms out to sides until parallel to floor.','Lower with control.'],
    tips:['Slight forward lean, lead with elbows.']},
  {id:'ex_front_raise', name:'Dumbbell Front Raise', primary:'Anterior Deltoid', secondary:['Lateral Deltoid'], equipment:'Dumbbells', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'curl', gif:'Dumbbell-Front-Raise.gif',
    steps:['Stand holding dumbbells in front of thighs.','Raise one or both arms to shoulder height.','Lower slowly.'],
    tips:['Keep core braced, no swinging.']},
  {id:'ex_rear_delt_fly', name:'Reverse Pec Deck', primary:'Rear Deltoid', secondary:['Mid Back'], equipment:'Machine', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'curl', gif:'Reverse-Pec-Deck.gif',
    steps:['Sit facing pad, arms extended to sides.','Sweep arms back in arc.','Squeeze rear delts.','Return slowly.'],
    tips:['Keep slight elbow bend.']},
  {id:'ex_arnold_press', name:'Arnold Press', primary:'Anterior Deltoid', secondary:['Lateral Deltoid','Triceps'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'curl', gif:'Arnold-Press.gif',
    steps:['Start with palms facing you at chin height.','Rotate palms outward as you press.','Reverse rotation on descent.'],
    tips:['More rotation = more deltoid recruitment.']},

  // =================== LEGS ===================
  {id:'ex_squat_bb', name:'Barbell Back Squat', primary:'Quads', secondary:['Glutes','Hamstrings','Core'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'squat', video:'squat-archive.mp4',
    steps:['Bar on upper traps, feet shoulder-width.','Brace, descend by breaking at hips and knees.','Hit depth (hip crease below knee).','Drive up through mid-foot.'],
    tips:['Knees track over toes.','Neutral spine throughout.']},
  {id:'ex_squat_front', name:'Front Squat', primary:'Quads', secondary:['Glutes','Core'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Advanced', anim:'squat', gif:'Front-Squat.gif',
    steps:['Bar racked across front delts, elbows high.','Squat to depth with upright torso.','Drive up.'],
    tips:['Easier on lower back.','Requires wrist/shoulder mobility.']},
  {id:'ex_lunge', name:'Walking Lunge', primary:'Quads', secondary:['Glutes','Hamstrings'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner', anim:'squat', gif:'Walking-Lunge.gif',
    steps:['Step forward into lunge, back knee near floor.','Drive forward off front heel.','Alternate legs.'],
    tips:['Knee tracks over front foot.']},
  {id:'ex_leg_press', name:'Leg Press', primary:'Quads', secondary:['Glutes','Hamstrings'], equipment:'Machine', mechanics:'Compound', force:'Push', level:'Beginner', anim:'squat', gif:'Leg-Press.gif',
    steps:['Sit, feet shoulder-width on platform.','Release safety, lower weight to ~90° knee bend.','Press back without locking knees.'],
    tips:['Don\'t lock knees.','Lower foot placement = more glute.']},
  {id:'ex_leg_ext', name:'Leg Extension', primary:'Quads', secondary:[], equipment:'Machine', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'squat', video:'leg-extension.mp4',
    steps:['Sit, shins against pad.','Extend knees until legs straight.','Squeeze quads.','Lower with control.'],
    tips:['Avoid swinging momentum.']},
  {id:'ex_leg_curl', name:'Lying Leg Curl', primary:'Hamstrings', secondary:['Calves'], equipment:'Machine', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'squat', gif:'Lying-Leg-Curl.gif',
    steps:['Lie face down, ankles under pad.','Curl heels to glutes.','Lower slowly.'],
    tips:['Don\'t arch lower back.']},
  {id:'ex_rdl', name:'Romanian Deadlift', primary:'Hamstrings', secondary:['Glutes','Lower Back'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Intermediate', anim:'squat', video:'romanian-deadlift.mp4',
    steps:['Stand, bar at hips.','Hinge at hips, bar slides down legs.','Stop at end of hamstring flexibility.','Drive hips forward to stand.'],
    tips:['Slight knee bend, keep bar close.','Feel stretch in hamstrings.']},
  {id:'ex_hip_thrust', name:'Barbell Hip Thrust', primary:'Glutes', secondary:['Hamstrings'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'squat', video:'hip-thrust.mp4',
    steps:['Shoulders against bench, bar over hips.','Drive hips up, squeezing glutes.','Top position: hips level with knees.'],
    tips:['Pad the bar — it hurts without padding.']},
  {id:'ex_calf_raise', name:'Standing Calf Raise', primary:'Calves', secondary:[], equipment:'Machine', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'squat', gif:'Standing-Calf-Raise.gif',
    steps:['Shoulders under pads, balls of feet on platform.','Rise onto toes.','Lower heels below platform for stretch.'],
    tips:['Full stretch at bottom = growth.']},
  {id:'ex_stepup', name:'Dumbbell Step-Up', primary:'Quads', secondary:['Glutes'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner', anim:'squat', gif:'Dumbbell-Step-Up.gif',
    steps:['Step onto box with one leg.','Drive through heel to stand on top.','Step back down.'],
    tips:['Box height matches your mobility.']},

  // =================== ARMS ===================
  {id:'ex_curl_bb', name:'Barbell Bicep Curl', primary:'Biceps', secondary:['Forearms'], equipment:'Barbell', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'curl', video:'barbell-curl.mp4',
    steps:['Stand, bar at thighs, supinated grip.','Curl bar to upper chest.','Squeeze biceps.','Lower with control.'],
    tips:['Elbows pinned to sides.','No swinging.']},
  {id:'ex_curl_db', name:'Dumbbell Bicep Curl', primary:'Biceps', secondary:['Forearms'], equipment:'Dumbbells', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'curl', gif:'Dumbbell-Curl.gif',
    steps:['Sit or stand, dumbbells at sides, palms forward.','Curl to shoulders.','Lower slowly.'],
    tips:['Alternate or both together.']},
  {id:'ex_hammer_curl', name:'Hammer Curl', primary:'Brachialis / Biceps', secondary:['Forearms'], equipment:'Dumbbells', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'curl', video:'hammer-curl.mp4',
    steps:['Hold dumbbells neutral grip.','Curl to shoulders without rotating.','Lower slowly.'],
    tips:['Targets the brachialis — adds arm thickness.']},
  {id:'ex_preacher_curl', name:'Preacher Curl', primary:'Biceps', secondary:[], equipment:'Barbell', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'curl', gif:'Preacher-Curl.gif',
    steps:['Sit at preacher bench, arms on pad.','Curl bar to top.','Lower to full extension.'],
    tips:['Stretch at bottom is key.']},
  {id:'ex_tricep_pushdown', name:'Tricep Pushdown', primary:'Triceps', secondary:[], equipment:'Cable', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'curl', video:'tricep-pushdown.mp4',
    steps:['Cable at upper position, grip handle.','Push down until arms extended.','Squeeze triceps.','Return slowly.'],
    tips:['Elbows pinned to sides.']},
  {id:'ex_skullcrusher', name:'Skullcrusher', primary:'Triceps', secondary:[], equipment:'Barbell', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'curl', gif:'Skullcrusher.gif',
    steps:['Lie on bench, grip bar shoulder-width.','Lower bar to forehead by bending elbows.','Extend back up.'],
    tips:['Keep elbows stationary.']},
  {id:'ex_overhead_ext', name:'Overhead Tricep Extension', primary:'Triceps', secondary:[], equipment:'Dumbbell', mechanics:'Isolation', force:'Push', level:'Beginner', anim:'curl', gif:'Overhead-Tricep-Extension.gif',
    steps:['Hold dumbbell overhead, elbows close to head.','Lower behind head.','Extend back up.'],
    tips:['Long head stretch — keep elbows in.']},
  {id:'ex_close_grip_bench', name:'Close-Grip Bench Press', primary:'Triceps', secondary:['Chest','Anterior Deltoid'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'bench', gif:'Close-Grip-Bench-Press.gif',
    steps:['Bench with grip shoulder-width.','Lower bar to lower chest.','Press up keeping elbows tucked.'],
    tips:['Don\'t go too narrow — wrist strain.']},

  // =================== CORE ===================
  {id:'ex_plank', name:'Plank', primary:'Core (Rectus Abdominis, Transverse)', secondary:['Shoulders','Glutes'], equipment:'Bodyweight', mechanics:'Isolation', force:'Hold', level:'Beginner', anim:'plank', video:'plank-archive.mp4',
    steps:['Forearms on floor, elbows under shoulders.','Body in straight line.','Hold position.'],
    tips:['Don\'t sag hips or pike up.','Breathe steadily.']},
  {id:'ex_crunch', name:'Crunch', primary:'Rectus Abdominis', secondary:[], equipment:'Bodyweight', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'plank', gif:'Crunch.gif',
    steps:['Lie on back, knees bent, hands behind head.','Curl shoulders off floor.','Lower slowly.'],
    tips:['Don\'t pull on neck.']},
  {id:'ex_hanging_leg', name:'Hanging Leg Raise', primary:'Rectus Abdominis', secondary:['Hip Flexors'], equipment:'Bodyweight', mechanics:'Isolation', force:'Pull', level:'Intermediate', anim:'plank', video:'leg-raise.mp4',
    steps:['Hang from bar.','Raise legs to parallel (or higher).','Lower with control.'],
    tips:['No swinging — control the descent.']},
  {id:'ex_cable_crunch', name:'Cable Crunch', primary:'Rectus Abdominis', secondary:[], equipment:'Cable', mechanics:'Isolation', force:'Pull', level:'Beginner', anim:'plank', gif:'Cable-Crunch.gif',
    steps:['Kneel under cable, rope behind head.','Curl torso toward floor.','Return slowly.'],
    tips:['Crunch the abs, don\'t just bend at hips.']},
  {id:'ex_russian_twist', name:'Russian Twist', primary:'Obliques', secondary:['Rectus Abdominis'], equipment:'Bodyweight', mechanics:'Isolation', force:'Hold', level:'Beginner', anim:'plank', video:'russian-twist.mp4',
    steps:['Sit, knees bent, lean back ~45°.','Rotate torso side to side.'],
    tips:['Go slow, controlled rotation.']},
  {id:'ex_ab_wheel', name:'Ab Wheel Rollout', primary:'Core', secondary:['Shoulders','Lats'], equipment:'Wheel', mechanics:'Isolation', force:'Pull', level:'Advanced', anim:'plank', gif:'Ab-Wheel.gif',
    steps:['Kneel, grip wheel.','Roll forward keeping core braced.','Pull back to start.'],
    tips:['Don\'t let hips sag — stop before loss of form.']},
  {id:'ex_mountain_climber', name:'Mountain Climber', primary:'Core', secondary:['Shoulders','Hip Flexors'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Beginner', anim:'plank', gif:'Mountain-Climber.gif',
    steps:['Plank position.','Drive knees alternately toward chest.'],
    tips:['Keep hips down, pace steady.']},

  // =================== CONDITIONING ===================
  {id:'ex_burpee', name:'Burpee', primary:'Full Body', secondary:['Cardiovascular'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Beginner', anim:'pushup', gif:'Burpee.gif',
    steps:['Squat, hands on floor.','Jump feet back to plank.','Push-up (optional).','Jump feet forward, jump up with arms overhead.'],
    tips:['Pace yourself — quality reps first.']},
  {id:'ex_kb_swing', name:'Kettlebell Swing', primary:'Glutes', secondary:['Hamstrings','Core','Shoulders'], equipment:'Kettlebell', mechanics:'Compound', force:'Pull', level:'Intermediate', anim:'squat', gif:'Kettlebell-Swing.gif',
    steps:['Stand, bell between feet.','Hinge and hike bell back.','Drive hips forward, swing bell to chest height.'],
    tips:['Power comes from hips, not arms.']},
  {id:'ex_jump_rope', name:'Jump Rope', primary:'Calves', secondary:['Cardiovascular','Shoulders'], equipment:'Rope', mechanics:'Compound', force:'Push', level:'Beginner', anim:'squat', gif:'Jump-Rope.gif',
    steps:['Rope behind ankles.','Jump with both feet as rope passes under.'],
    tips:['Stay on balls of feet.']},
  {id:'ex_box_jump', name:'Box Jump', primary:'Quads', secondary:['Glutes','Calves'], equipment:'Box', mechanics:'Compound', force:'Push', level:'Intermediate', anim:'squat', gif:'Box-Jump.gif',
    steps:['Stand facing box.','Swing arms, jump with both feet to land softly on box.','Stand to full extension.'],
    tips:['Land soft — absorb with hips.']},
  {id:'ex_assault_bike', name:'Assault Bike (Sprints)', primary:'Cardiovascular', secondary:['Quads','Hamstrings','Shoulders'], equipment:'Machine', mechanics:'Compound', force:'Push', level:'Beginner', anim:'squat',
    steps:['Set seat height.','Alternate fast pedaling with arm pushes.','Sprint intervals as programmed.'],
    tips:['Don\'t grip the handles tight — keep loose.']},
];

function exerciseAnimSVG(animKey){
  if(animKey==='bench'){
    return `<svg viewBox="0 0 240 200" class="anim-bench">
      <rect x="40" y="150" width="160" height="14" rx="4" style="fill:#2b2f35"/>
      <ellipse cx="120" cy="140" rx="55" ry="16" class="rig-body"/>
      <circle cx="185" cy="128" r="14" class="rig-head"/>
      <g class="arm-r"><rect x="150" y="70" width="10" height="60" rx="5" class="muscle"/><circle cx="155" cy="65" r="9" fill="#2b2f35" stroke="#4d535c" stroke-width="1.5"/></g>
      <g class="arm-l"><rect x="185" y="70" width="10" height="60" rx="5" class="muscle"/><circle cx="190" cy="65" r="9" fill="#2b2f35" stroke="#4d535c" stroke-width="1.5"/></g>
      <rect x="60" y="60" width="140" height="8" rx="4" fill="#5a616b"/>
      <circle cx="60" cy="64" r="16" fill="#3a3f47" stroke="#5a616b" stroke-width="2"/>
      <circle cx="200" cy="64" r="16" fill="#3a3f47" stroke="#5a616b" stroke-width="2"/>
      <rect x="98" y="128" width="45" height="22" rx="6" class="muscle"/>
    </svg>`;
  }
  if(animKey==='squat'){
    return `<svg viewBox="0 0 240 220" class="anim-squat">
      <circle cx="120" cy="40" r="16" class="rig-head"/>
      <g class="torso"><rect x="98" y="58" width="44" height="60" rx="10" class="rig-body"/><rect x="82" y="66" width="76" height="9" rx="4" fill="#5a616b"/><circle cx="82" cy="70" r="13" fill="#3a3f47" stroke="#5a616b" stroke-width="2"/><circle cx="158" cy="70" r="13" fill="#3a3f47" stroke="#5a616b" stroke-width="2"/></g>
      <g class="legs"><rect x="98" y="118" width="16" height="70" rx="7" class="muscle"/><rect x="126" y="118" width="16" height="70" rx="7" class="muscle"/></g>
      <rect x="90" y="186" width="30" height="10" rx="4" class="rig-body"/>
      <rect x="120" y="186" width="30" height="10" rx="4" class="rig-body"/>
    </svg>`;
  }
  if(animKey==='curl'){
    return `<svg viewBox="0 0 200 240" class="anim-curl">
      <circle cx="100" cy="34" r="16" class="rig-head"/>
      <rect x="76" y="52" width="48" height="80" rx="12" class="rig-body"/>
      <rect x="60" y="132" width="18" height="80" rx="8" class="rig-body"/>
      <rect x="122" y="132" width="18" height="80" rx="8" class="rig-body"/>
      <rect x="52" y="60" width="14" height="55" rx="7" class="rig-body"/>
      <g class="forearm-r">
        <rect x="30" y="100" width="14" height="46" rx="7" class="muscle"/>
        <circle cx="37" cy="146" r="9" fill="#3a3f47" stroke="#5a616b" stroke-width="1.5"/>
      </g>
      <rect x="134" y="60" width="14" height="90" rx="7" class="rig-body"/>
    </svg>`;
  }
  if(animKey==='pushup'){
    return `<svg viewBox="0 0 260 160" class="anim-pushup">
      <g class="body-group">
        <ellipse cx="140" cy="90" rx="70" ry="14" class="rig-body"/>
        <circle cx="212" cy="85" r="13" class="rig-head"/>
        <rect x="60" y="88" width="12" height="45" rx="5" class="rig-body"/>
        <rect x="205" y="88" width="12" height="45" rx="5" class="rig-body"/>
        <rect x="95" y="82" width="55" height="18" rx="7" class="muscle"/>
      </g>
    </svg>`;
  }
  if(animKey==='pullup'){
    return `<svg viewBox="0 0 200 240" class="anim-pullup">
      <rect x="20" y="20" width="160" height="6" rx="3" fill="#5a616b"/>
      <rect x="20" y="14" width="6" height="18" fill="#3a3f47"/>
      <rect x="174" y="14" width="6" height="18" fill="#3a3f47"/>
      <g class="pullup-body">
        <circle cx="100" cy="60" r="13" class="rig-head"/>
        <rect x="85" y="74" width="30" height="50" rx="9" class="rig-body"/>
        <g class="arm-up"><rect x="68" y="32" width="9" height="50" rx="4" class="muscle"/><rect x="123" y="32" width="9" height="50" rx="4" class="muscle"/></g>
        <rect x="87" y="124" width="11" height="80" rx="5" class="rig-body"/>
        <rect x="102" y="124" width="11" height="80" rx="5" class="rig-body"/>
      </g>
    </svg>`;
  }
  return `<svg viewBox="0 0 260 150" class="anim-plank">
    <g class="body-group">
      <ellipse cx="140" cy="85" rx="72" ry="13" class="rig-body"/>
      <circle cx="212" cy="80" r="13" class="rig-head"/>
      <rect x="60" y="98" width="12" height="35" rx="5" class="rig-body"/>
      <rect x="205" y="98" width="12" height="35" rx="5" class="rig-body"/>
      <rect x="90" y="78" width="60" height="16" rx="7" class="muscle"/>
    </g>
  </svg>`;
}
