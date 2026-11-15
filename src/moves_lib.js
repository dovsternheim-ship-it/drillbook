// ---------- Drillbook movement library ----------
// World angles help: a segment's direction measured from straight down toward the front (+z): 0 down, 90 forward, 180 up, -90 back.
(function () {
  const { def, merge, P, SUP, SUPFLAT, QUAD, PLANK, STAND } = Moves;
  const M = merge;
  // legs/arms from world angles (sagittal plane)
  const LW = (pitch, thighW, shinW, footW, x) => Object.assign({ f: thighW + pitch, k: thighW - shinW, an: footW - shinW - 90 }, x || {});
  const AW = (chest, upperW, foreW, x) => Object.assign({ e: upperW + chest, el: foreW - upperW }, x || {});
  const both = (o) => ({ aL: o, aR: o });
  const legs = (o) => ({ lL: o, lR: o });
  const FEET = { fL: 'flat', fR: 'flat' };
  const SIDE = { yaw: 62, pitch: 10 }, FRONT = { yaw: 18, pitch: 8 }, FLOOR = { yaw: 72, pitch: 18 };
  const DBS = [{ k: 'dbL', at: 'handL' }, { k: 'dbR', at: 'handR' }];
  const stand = (name, o) => def(name, Object.assign({ view: SIDE, anchor: 'feet', balance: true, contacts: FEET }, o));

  // ======================= STANDING =======================
  stand('stand', { label: 'Stand tall', hold: true, breath: false, keys: [{ p: P(), t: 3 }, { p: P({ sp: [-1, 0, 0] }), t: 3 }] });

  // squat: thighs to about parallel, chest up, knees track over the toes, arms reach forward to balance
  const SQ_STANCE = { a: 10, r: 16 };
  const sqTop = P(M(legs(Object.assign({ f: 2, k: 3 }, SQ_STANCE)), both({ e: 8, p: 60, el: 14 })));
  const sqBot = P(M({ ori: [0, 34, 0], sp: [6, 0, 0], nk: [-14, 0, 0], hd: [-8, 0, 0] }, M(legs(Object.assign(LW(34, 84, -34, 90), SQ_STANCE)), both(AW(40, 88, 92, { p: 10, g: 0.2 })))));
  stand('squat', { label: 'Squat', keys: [{ p: sqTop, t: 1.3, h: 0.6 }, { p: sqBot, t: 2.2, h: 0.3 }] });
  stand('sumosquat', { label: 'Sumo squat', view: { yaw: 28, pitch: 8 }, keys: [
    { p: P(M(legs({ f: 2, k: 4, a: 24, r: 38 }), both({ e: 20, p: 15, el: 110, g: 0.6 }))), t: 1.3, h: 0.5 },
    { p: P(M({ ori: [0, 16, 0], sp: [2, 0, 0] }, M(legs({ f: 92, k: 100, a: 32, r: 42 }), both({ e: 26, p: 12, el: 112, g: 0.6 })))), t: 2.2, h: 0.3 }] });
  // goblet squat: one dumbbell held upright against the chest, elbows down, upright torso
  const GOB_ARMS = { hL: { to: 'spine01', at: [0.075, -0.02, 0.21], pole: [0.25, -1, 0.1], palm: [-0.25, 0.95, 0.15], fing: [-1, 0.05, 0.25] }, hR: { to: 'spine01', at: [-0.075, -0.02, 0.21], pole: [-0.25, -1, 0.1], palm: [0.25, 0.95, 0.15], fing: [1, 0.05, 0.25] } };
  stand('goblet', { label: 'Goblet squat', props: [{ k: 'dbV', at: 'hands' }], contacts: Object.assign({}, FEET, GOB_ARMS), keys: [
    { p: P(M(legs(Object.assign({ f: 2, k: 3 }, SQ_STANCE)), both({ e: 25, p: 10, el: 120, g: 0.8 }))), t: 1.3, h: 0.6 },
    { p: P(M({ ori: [0, 22, 0], sp: [4, 0, 0], nk: [-12, 0, 0] }, M(legs(Object.assign(LW(22, 86, -36, 90), { a: 13, r: 18 })), both({ e: 25, p: 10, el: 120, g: 0.8 })))), t: 2.6, h: 0.3 }] });
  stand('jumpsquat', { label: 'Jump squat', keys: [
    { p: sqTop, t: 0.5, h: 0.2 },
    { p: M(sqBot, both({ e: -20, p: 10, el: 20 })), t: 0.9, h: 0.05 },
    { p: P(M(legs({ f: 0, k: 0, an: -30, a: 8, r: 10 }), M(both({ e: 150, p: 20, el: 10 }), { cw: { fL: 0, fR: 0 } }))), t: 0.22, ease: 'out' },
    { p: P(M(legs({ f: 6, k: 8, an: -20, a: 9, r: 12 }), M(both({ e: 120, p: 20, el: 14 }), { cw: { fL: 0, fR: 0 } }))), t: 0.32, air: 1.0 },
    { p: M(sqBot, { ori: [0, 24, 0], ...both(AW(30, 70, 80, { p: 10 })) }), t: 0.35 }] });
  // split squat / lunges (left leg in front; the app mirrors for the other side)
  const SPLIT_TOP = P(M({ lL: { f: 22, k: 6, a: 4, r: 4 }, lR: { f: -18, k: 8, an: -10, a: 2 } }, both({ e: 8, p: 70, el: 14 })));
  const SPLIT_BOT = P(M({ ori: [0, 6, 0], lL: Object.assign(LW(6, 86, -12, 90), { a: 4, r: 4 }), lR: Object.assign(LW(6, -8, -92, -40), { a: 2 }) }, both({ e: 8, p: 70, el: 18 })));
  stand('splitsquat', { label: 'Split squat', perSide: true, balance: false, contacts: { fL: 'flat', fR: 'ball' }, keys: [{ p: SPLIT_TOP, t: 1.2, h: 0.5 }, { p: SPLIT_BOT, t: 2.2, h: 0.3 }] });
  stand('reverselunge', { label: 'Reverse lunge', perSide: true, balance: false, contacts: { fL: 'flat', fR: 'ball' }, keys: [
    { p: P(M(both({ e: 8, p: 70, el: 14 }), { cw: { fR: 0 } })), t: 1.1, h: 0.5 },
    { p: SPLIT_BOT, t: 1.6, h: 0.3 }], ref: 1 });
  Moves.L.lunge = Object.assign({}, Moves.L.reverselunge, { label: 'Lunge' });
  stand('sidelunge', { label: 'Side lunge', perSide: true, view: { yaw: 10, pitch: 8 }, balance: false, keys: [
    { p: P(M(legs({ a: 22, r: 14, f: 2, k: 2 }), both({ e: 20, p: 10, el: 100, g: 0.6 }))), t: 1.2, h: 0.4 },
    { p: P(M({ ori: [0, 28, 0], root: [0.25, 0.7, 0] }, M({ lL: { f: 96, a: 26, r: 22, k: 104 }, lR: { f: 26, a: 30, r: 8, k: 2, an: 10 } }, both({ e: 60, p: 10, el: 80, g: 0.6 })))), t: 2, h: 0.3 }] });
  stand('wallsit', { label: 'Wall sit', hold: true, breath: true, balance: false, props: [{ k: 'wall', pos: [0, 1.1, -0.33] }], keys: [
    { p: P(M({ ori: [0, -2, 0] }, M(legs(Object.assign(LW(-2, 90, 0, 90), { a: 8, r: 10 })), both({ e: 6, p: 70, el: 10 })))), t: 3 },
    { p: P(M({ ori: [0, -2, 0], sp: [-1, 0, 0] }, M(legs(Object.assign(LW(-2, 90, 0, 90), { a: 8, r: 10 })), both({ e: 6, p: 70, el: 10 })))), t: 3 }] });
  stand('calfraise', { label: 'Calf raise', contacts: { fL: 'ball', fR: 'ball' }, balance: false, keys: [
    { p: P(M(legs({ an: 0, a: 4, r: 6 }), both({ e: 6, p: 70, el: 10 }))), t: 1.6, h: 0.3 },
    { p: P(M(legs({ an: -38, a: 4, r: 6 }), both({ e: 6, p: 70, el: 10 }))), t: 1, h: 1 }] });

  // hip hinge family
  const rdlTop = P(M(legs({ f: 4, k: 10, a: 4, r: 6 }), both({ e: 4, p: 15, el: 4, g: 1, pr: -70 })));
  const rdlBot = P(M({ ori: [0, 68, 0], nk: [-18, 0, 0], hd: [-12, 0, 0] }, M(legs(Object.assign(LW(68, 20, -6, 90), { a: 4, r: 6 })), both({ e: 66, p: 12, el: 2, g: 1, pr: -70 }))));
  stand('rdl', { label: 'Romanian deadlift', props: DBS, keys: [{ p: rdlTop, t: 1.6, h: 0.5 }, { p: rdlBot, t: 3, h: 0.3 }] });
  stand('goodmorning', { label: 'Good morning', contacts: Object.assign({}, FEET, { hL: { to: 'head', at: [0.06, 0.06, -0.08], pole: [1, 0.2, -0.2] }, hR: { to: 'head', at: [-0.06, 0.06, -0.08], pole: [-1, 0.2, -0.2] } }), keys: [
    { p: P(M(legs({ f: 3, k: 8 }), both({ e: 120, p: 80, el: 140, g: 0.2 }))), t: 1.5, h: 0.4 },
    { p: P(M({ ori: [0, 70, 0], nk: [-15, 0, 0] }, M(legs(LW(70, 18, -4, 90)), both({ e: 120, p: 80, el: 140, g: 0.2 })))), t: 2.5, h: 0.3 }] });
  stand('kbswing', { label: 'Kettlebell swing', props: [{ k: 'kb', at: 'hands' }], contacts: Object.assign({}, FEET, { hR: { to: 'hand.L', at: [-0.03, 0.0, 0.0] } }), keys: [
    { p: P(M({ ori: [0, 58, 0], nk: [-16, 0, 0] }, M(legs(Object.assign(LW(58, 26, -10, 90), { a: 12, r: 14 })), both({ e: 40, p: -6, el: 0, g: 1 })))), t: 0.55, ease: 'sine' },
    { p: P(M({ ori: [0, -4, 0] }, M(legs({ f: -2, k: 2, a: 12, r: 14 }), both({ e: 92, p: -6, el: 0, g: 1 })))), t: 0.65, ease: 'out' }] });
  stand('sldl', { label: 'Single-leg deadlift', perSide: true, contacts: { fL: 'flat' }, props: [{ k: 'dbR', at: 'handR' }], keys: [
    { p: P(M({ lL: { f: 2, k: 8 }, lR: { f: 0, k: 10, an: -10 } }, M(both({ e: 6, p: 40, el: 6 }), { aR: { g: 1, pr: -70 } }))), t: 1.6, h: 0.4 },
    { p: P(M({ ori: [0, 78, 0], nk: [-14, 0, 0] }, M({ lL: LW(78, 14, -2, 90), lR: { f: 2, k: 4, an: -30 } }, M(both({ e: 76, p: 20, el: 4 }), { aR: { g: 1, pr: -70 } })))), t: 2.4, h: 0.4 }] });

  // upper body standing with dumbbells
  stand('press', { label: 'Overhead press', view: { yaw: 35, pitch: 6 }, props: DBS, keys: [
    { p: P(both({ e: 80, p: 72, el: 98, pr: 0, g: 1, r: 0 })), t: 2.4, h: 0.3 },
    { p: P(M({ nk: [-4, 0, 0] }, both({ e: 168, p: 30, el: 4, g: 1 }))), t: 1.3, h: 0.4 }] });
  stand('lateralraise', { label: 'Lateral raise', view: FRONT, props: DBS, keys: [
    { p: P(both({ e: 8, p: 84, el: 10, g: 1 })), t: 2.2, h: 0.3 },
    { p: P(both({ e: 86, p: 86, el: 14, g: 1 })), t: 1.3, h: 0.4 }] });
  stand('frontraise', { label: 'Front raise', props: DBS, keys: [
    { p: P(both({ e: 6, p: 10, el: 6, g: 1, pr: -70 })), t: 2.2, h: 0.3 },
    { p: P(both({ e: 88, p: 8, el: 6, g: 1, pr: -70 })), t: 1.3, h: 0.4 }] });
  stand('curl', { label: 'Biceps curl', props: DBS, keys: [
    { p: P(both({ e: 4, p: 20, el: 6, g: 1, pr: 60 })), t: 2.4, h: 0.2 },
    { p: P(both({ e: 14, p: 20, el: 138, g: 1, pr: 60 })), t: 1.2, h: 0.4 }] });
  stand('hammercurl', { label: 'Hammer curl', props: DBS, keys: [
    { p: P(both({ e: 4, p: 30, el: 6, g: 1 })), t: 2.4, h: 0.2 },
    { p: P(both({ e: 14, p: 30, el: 136, g: 1 })), t: 1.2, h: 0.4 }] });
  stand('tricepext', { label: 'Overhead triceps extension', props: [{ k: 'dbV', at: 'hands' }], contacts: Object.assign({}, FEET, { hR: { to: 'hand.L', at: [-0.035, 0, 0] } }), keys: [
    { p: P(both({ e: 165, p: 18, el: 145, g: 1 })), t: 2.4, h: 0.2 },
    { p: P(both({ e: 170, p: 14, el: 8, g: 1 })), t: 1.2, h: 0.4 }] });
  stand('row', { label: 'Bent-over row', props: DBS, keys: [
    { p: P(M({ ori: [0, 52, 0], nk: [-14, 0, 0] }, M(legs(LW(52, 30, -8, 90)), both({ e: 52, p: 14, el: 4, g: 1, pr: -10 })))), t: 2.2, h: 0.2 },
    { p: P(M({ ori: [0, 52, 0], nk: [-14, 0, 0] }, M(legs(LW(52, 30, -8, 90)), both(AW(52, -80, 4, { p: 18, g: 1, pr: -10 }))))), t: 1.1, h: 0.5 }] });
  stand('reversefly', { label: 'Reverse fly', view: { yaw: 40, pitch: 16 }, props: DBS, keys: [
    { p: P(M({ ori: [0, 62, 0], nk: [-14, 0, 0] }, M(legs(LW(62, 26, -6, 90)), both({ e: 62, p: 4, el: 14, g: 1 })))), t: 2.2, h: 0.2 },
    { p: P(M({ ori: [0, 62, 0], nk: [-16, 0, 0] }, M(legs(LW(62, 26, -6, 90)), both({ e: 88, p: 92, el: 16, g: 1, cl: [0, -10] })))), t: 1.2, h: 0.5 }] });
  stand('shrug', { label: 'Shrug', view: FRONT, props: DBS, keys: [
    { p: P(both({ e: 4, p: 60, el: 4, g: 1 })), t: 1.6, h: 0.2 }, { p: P(both({ e: 4, p: 60, el: 4, g: 1, cl: [14, 0] })), t: 1, h: 1 }] });
  stand('armcircles', { label: 'Arm circles', view: FRONT, keys: [
    { p: P(both({ e: 82, p: 80, el: 4, g: 0.1 })), t: 0.45, ease: 'lin' }, { p: P(both({ e: 92, p: 90, el: 4, g: 0.1 })), t: 0.45, ease: 'lin' },
    { p: P(both({ e: 82, p: 100, el: 4, g: 0.1 })), t: 0.45, ease: 'lin' }, { p: P(both({ e: 72, p: 90, el: 4, g: 0.1 })), t: 0.45, ease: 'lin' }] });

  // cardio
  const RUN = (s) => P(M({ ori: [0, 6, 0] }, s));
  def('highknees', { label: 'High knees', view: { yaw: 58, pitch: 8 }, anchor: 'ground', pin: 'hips', keys: [
    { p: RUN({ lL: { f: 88, k: 95, an: -20 }, lR: { f: -2, k: 6, an: -20 }, aL: { e: -30, p: 10, el: 90 }, aR: { e: 45, p: 10, el: 90 } }), t: 0.3, ease: 'sine' },
    { p: RUN({ lL: { f: -2, k: 6, an: -20 }, lR: { f: 88, k: 95, an: -20 }, aL: { e: 45, p: 10, el: 90 }, aR: { e: -30, p: 10, el: 90 } }), t: 0.3, ease: 'sine' }] });
  def('buttkicks', { label: 'Butt kicks', view: { yaw: 70, pitch: 8 }, anchor: 'ground', pin: 'hips', keys: [
    { p: RUN({ lL: { f: 8, k: 135, an: -40 }, lR: { f: -4, k: 8, an: -15 }, aL: { e: -25, p: 10, el: 90 }, aR: { e: 35, p: 10, el: 90 } }), t: 0.32, ease: 'sine' },
    { p: RUN({ lL: { f: -4, k: 8, an: -15 }, lR: { f: 8, k: 135, an: -40 }, aL: { e: 35, p: 10, el: 90 }, aR: { e: -25, p: 10, el: 90 } }), t: 0.32, ease: 'sine' }] });
  def('jog', { label: 'Jog in place', view: { yaw: 60, pitch: 8 }, anchor: 'ground', pin: 'hips', keys: [
    { p: RUN({ lL: { f: 40, k: 70, an: -10 }, lR: { f: -6, k: 30, an: -25 }, aL: { e: -25, p: 10, el: 85 }, aR: { e: 35, p: 10, el: 85 } }), t: 0.34, ease: 'sine', air: 0.25 },
    { p: RUN({ lL: { f: -6, k: 30, an: -25 }, lR: { f: 40, k: 70, an: -10 }, aL: { e: 35, p: 10, el: 85 }, aR: { e: -25, p: 10, el: 85 } }), t: 0.34, ease: 'sine', air: 0.25 }] });
  def('march', { label: 'March in place', view: { yaw: 55, pitch: 8 }, anchor: 'ground', pin: 'hips', keys: [
    { p: P({ lL: { f: 60, k: 70, an: 5 }, lR: { f: 0, k: 4 }, aL: { e: -15, p: 10, el: 40 }, aR: { e: 30, p: 10, el: 50 } }), t: 0.55, ease: 'sine' },
    { p: P({ lL: { f: 0, k: 4 }, lR: { f: 60, k: 70, an: 5 }, aL: { e: 30, p: 10, el: 50 }, aR: { e: -15, p: 10, el: 40 } }), t: 0.55, ease: 'sine' }] });
  def('jack', { label: 'Jumping jack', view: FRONT, anchor: 'ground', pin: 'hips', keys: [
    { p: P(M(legs({ a: 3, r: 8, an: -6 }), both({ e: 8, p: 88, el: 8, g: 0.2 }))), t: 0.36, air: 0.35 },
    { p: P(M(legs({ a: 17, r: 18, an: -6, k: 6 }), both({ e: 172, p: 86, el: 10, g: 0.2 }))), t: 0.36, air: 0.35 }] });
  def('skater', { label: 'Skater hops', view: { yaw: 10, pitch: 10 }, anchor: 'ground', pin: 'hips', keys: [
    { p: P(M({ ori: [0, 30, 0], root: [0.32, 0.8, 0] }, { lL: { f: 50, k: 60, a: 4 }, lR: { f: 10, a: -20, k: 30, an: -20 }, aL: { e: 30, p: -40, el: 20 }, aR: { e: 50, p: 50, el: 20 } })), t: 0.55, air: 0.5 },
    { p: P(M({ ori: [0, 30, 0], root: [-0.32, 0.8, 0] }, { lR: { f: 50, k: 60, a: 4 }, lL: { f: 10, a: -20, k: 30, an: -20 }, aR: { e: 30, p: -40, el: 20 }, aL: { e: 50, p: 50, el: 20 } })), t: 0.55, air: 0.5 }] });

  // ======================= FLOOR: hands and knees =======================
  const floor = (name, o) => def(name, Object.assign({ view: FLOOR, anchor: 'ground', groundSkip: 'arms', props: [{ k: 'mat' }] }, o));
  // bird-dog: opposite arm and leg long, hold 2 s, hips square
  const BD_A = M(QUAD, { aL: { e: 174, p: 4, el: 2, g: 0.1, wf: -10 }, lR: { f: -6, a: 2, k: 2, an: -40 }, cw: { hL: 0, hR: 1 } });
  const BD_B = M(QUAD, { aR: { e: 174, p: 4, el: 2, g: 0.1, wf: -10 }, lL: { f: -6, a: 2, k: 2, an: -40 }, cw: { hL: 1, hR: 0 } });
  const Q0 = M(QUAD, { cw: { hL: 1, hR: 1 } });
  floor('birddog', { label: 'Bird-dog', pin: 'hips', contacts: { hL: 'palm', hR: 'palm' }, alt: true, keys: [
    { p: Q0, t: 1.4, h: 0.4 }, { p: BD_A, t: 1.6, h: 2 }, { p: Q0, t: 1.6, h: 0.4 }, { p: BD_B, t: 1.6, h: 2 }] });
  floor('firehydrant', { label: 'Fire hydrant', perSide: true, view: { yaw: 150, pitch: 22 }, pin: 'hips', contacts: { hL: 'palm', hR: 'palm' }, keys: [
    { p: QUAD, t: 1.2, h: 0.3 }, { p: M(QUAD, { lL: { a: 58, r: 10 }, ori: [0, 84, -4] }), t: 1.2, h: 0.6 }] });
  floor('donkeykick', { label: 'Donkey kick', perSide: true, view: { yaw: 90, pitch: 14 }, pin: 'hips', contacts: { hL: 'palm', hR: 'palm' }, keys: [
    { p: QUAD, t: 1.3, h: 0.2 }, { p: M(QUAD, { lL: { f: -2, k: 90, an: 10 } }), t: 1.1, h: 0.6 }] });

  // ======================= FLOOR: on the back =======================
  const sup = (name, o) => floor(name, Object.assign({ view: { yaw: 66, pitch: 20 }, groundSkip: null, pin: 'spine02' }, o));
  // dead bug: arms to the ceiling, knees over hips at 90 degrees; lower one arm overhead and the opposite leg long
  const DB0 = M(SUP, { sp: [4, 0, 0], hd: [6, 0, 0], ...both({ e: 92, p: 6, el: 2, g: 0.1 }), ...legs({ f: 90, k: 90, an: 0, a: 4, r: 0 }) });
  sup('deadbug', { label: 'Dead bug', alt: true, keys: [
    { p: DB0, t: 1.3, h: 0.4 },
    { p: M(DB0, { aR: { e: 172, p: 8, el: 4 }, lL: { f: 14, k: 2, an: -10 } }), t: 2.2, h: 0.4 },
    { p: DB0, t: 1.5, h: 0.4 },
    { p: M(DB0, { aL: { e: 172, p: 8, el: 4 }, lR: { f: 14, k: 2, an: -10 } }), t: 2.2, h: 0.4 }] });
  // glute bridge: feet flat hip-width, lift until knees, hips and shoulders line up, hold 2 s, lower slowly
  const BR0 = M(SUP, { ...legs({ f: 58, k: 112, a: 4, r: 0 }), ...both({ e: 10, p: 40, el: 4, g: 0.1, pr: -60 }) });
  sup('bridge', { label: 'Glute bridge', contacts: FEET, keys: [
    { p: BR0, t: 3, h: 0.4 },
    { p: M(BR0, { root: [0, 0.4, 0.2], ori: [0, -122, 0], sp: [-2, 0, 0], hd: [24, 0, 0], ...both({ e: -28, p: 34 }) }), t: 1.4, h: 2 }], anchorY: 'shoulders' });
  sup('singlelegbridge', { label: 'Single-leg bridge', perSide: true, contacts: { fR: 'flat' }, keys: [
    { p: M(BR0, { lL: { f: 90, k: 20, an: 0 } }), t: 2.5, h: 0.3 },
    { p: M(BR0, { root: [0, 0.4, 0.2], ori: [0, -120, 0], hd: [24, 0, 0], lL: { f: 30, k: 4, an: -10 }, ...both({ e: -28, p: 34 }) }), t: 1.3, h: 1 }] });
  const BELLY = { hL: { to: 'spine03', at: [0.07, 0.02, 0.13], palm: [0, 0, 1] }, hR: { to: 'spine01', at: [-0.06, 0.06, 0.14], palm: [0, 0, 1] } };
  // breathing: in for 4 s (belly rises), out for 6 s
  sup('breathe', { label: 'Belly breathing', hold: true, breath: true, contacts: Object.assign({}, FEET, BELLY), keys: [
    { p: M(SUP, { sp: [-4, 0, 0], ori: [0, -92, 0] }), t: 4, ease: 'sine' }, { p: M(SUP, { sp: [1, 0, 0] }), t: 6, ease: 'sine' }] });
  sup('pelvictilt', { label: 'Pelvic tilt', contacts: FEET, keys: [
    { p: M(SUP, { ori: [0, -84, 0], sp: [-6, 0, 0] }), t: 1.6, h: 0.3 }, { p: M(SUP, { ori: [0, -96, 0], sp: [6, 0, 0] }), t: 1.6, h: 0.8 }] });
  sup('crunch', { label: 'Crunch', contacts: Object.assign({}, FEET, { hL: { to: 'head', at: [0.07, 0.04, -0.07], pole: [1, 0.5, 0] }, hR: { to: 'head', at: [-0.07, 0.04, -0.07], pole: [-1, 0.5, 0] } }), pin: 'hips', keys: [
    { p: M(SUP, both({ e: 150, p: 80, el: 140 })), t: 1.8, h: 0.3 },
    { p: M(SUP, M({ sp: [36, 0, 0], nk: [10, 0, 0] }, both({ e: 150, p: 80, el: 140 }))), t: 1.2, h: 0.6 }] });
  sup('situp', { label: 'Sit-up', contacts: FEET, pin: 'hips', keys: [
    { p: M(SUP, both({ e: 30, p: 10, el: 140, g: 0.6 })), t: 2, h: 0.2 },
    { p: M(SUP, M({ ori: [0, -22, 0], sp: [26, 0, 0], ...legs({ f: 112, k: 100 }) }, both({ e: 30, p: 10, el: 140, g: 0.6 }))), t: 1.5, h: 0.3 }] });
  const BIKE_ARMS = { hL: { to: 'head', at: [0.07, 0.04, -0.07], pole: [1, 0.5, 0] }, hR: { to: 'head', at: [-0.07, 0.04, -0.07], pole: [-1, 0.5, 0] } };
  sup('bicycle', { label: 'Bicycle crunch', pin: 'hips', contacts: BIKE_ARMS, alt: true, keys: [
    { p: M(SUP, M({ sp: [30, 0, 30], nk: [10, 0, 0], lL: { f: 105, k: 110, an: 0 }, lR: { f: 25, k: 6, an: -10 } }, both({ e: 150, p: 80, el: 140 }))), t: 0.9, h: 0.25 },
    { p: M(SUP, M({ sp: [30, 0, -30], nk: [10, 0, 0], lR: { f: 105, k: 110, an: 0 }, lL: { f: 25, k: 6, an: -10 } }, both({ e: 150, p: 80, el: 140 }))), t: 0.9, h: 0.25 }] });
  sup('legraise', { label: 'Lying leg raise', keys: [
    { p: M(SUPFLAT, M(legs({ f: 6, k: 2, an: -20 }), both({ e: 14, p: 80, pr: -60 }))), t: 2.4, h: 0.2 },
    { p: M(SUPFLAT, M(legs({ f: 88, k: 4, an: -10 }), both({ e: 14, p: 80, pr: -60 }))), t: 1.5, h: 0.4 }] });
  sup('flutter', { label: 'Flutter kicks', keys: [
    { p: M(SUPFLAT, M({ sp: [8, 0, 0], hd: [14, 0, 0], lL: { f: 30, k: 2, an: -20 }, lR: { f: 12, k: 2, an: -20 } }, both({ e: 14, p: 80, pr: -60 }))), t: 0.4, ease: 'sine' },
    { p: M(SUPFLAT, M({ sp: [8, 0, 0], hd: [14, 0, 0], lL: { f: 12, k: 2, an: -20 }, lR: { f: 30, k: 2, an: -20 } }, both({ e: 14, p: 80, pr: -60 }))), t: 0.4, ease: 'sine' }] });
  sup('hollowhold', { label: 'Hollow hold', hold: true, keys: [
    { p: M(SUPFLAT, M({ sp: [16, 0, 0], hd: [16, 0, 0], ...legs({ f: 28, k: 2, an: -20, a: 2 }) }, both({ e: 170, p: 6, el: 4 }))), t: 3 },
    { p: M(SUPFLAT, M({ sp: [17, 0, 0], hd: [16, 0, 0], ...legs({ f: 29, k: 2, an: -20, a: 2 }) }, both({ e: 170, p: 6, el: 4 }))), t: 3 }] });
  // knees to chest: hug both shins, hold, then rock gently side to side
  const KTC = M(SUP, { hd: [10, 0, 0], sp: [6, 0, 0], ...legs({ f: 122, k: 128, a: 8, an: -10 }) });
  const HUG = { hL: { to: 'shin.L', at: [0.02, -0.09, 0.06], pole: [1, 0.3, 0] }, hR: { to: 'shin.R', at: [-0.02, -0.09, 0.06], pole: [-1, 0.3, 0] } };
  sup('kneestochest', { label: 'Knees to chest', hold: true, breath: true, contacts: HUG, keys: [
    { p: KTC, t: 2, h: 3 }, { p: M(KTC, { ori: [0, -90, 0, 18], sp: [6, 0, -12] }), t: 1.4 }, { p: KTC, t: 1.2 },
    { p: M(KTC, { ori: [0, -90, 0, -18], sp: [6, 0, 12] }), t: 1.4 }, { p: KTC, t: 1.2 }] });
  // figure-4: one ankle on the other knee, pull the bottom thigh in (left ankle crossing = left glute stretch)
  const F4 = M(SUP, { hd: [12, 0, 0], lR: { f: 98, k: 92, a: 4, an: 0 }, lL: { f: 62, a: 34, r: 62, k: 100, an: 0 } });
  sup('figure4', { label: 'Figure-4 glute stretch', perSide: true, hold: true, breath: true, contacts: { fL: { to: 'shin.R', at: [0.05, 0.06, 0.0], pole: [1, 0.6, 0.6] }, hL: { to: 'thigh.R', at: [0.06, -0.3, -0.07], pole: [1, 0, 0] }, hR: { to: 'thigh.R', at: [-0.06, -0.3, -0.07], pole: [-1, 0, 0] } }, keys: [
    { p: F4, t: 3 }, { p: M(F4, { lR: { f: 106 } }), t: 3 }] });
  // happy baby: knees toward the armpits, hands on the outsides of the feet
  const HB = M(SUP, { hd: [6, 0, 0], ...legs({ f: 132, a: 42, r: 6, k: 46, an: 10 }) });
  sup('happybaby', { label: 'Happy baby', hold: true, breath: true, contacts: { hL: { to: 'foot.L', at: [0.05, 0.01, 0.07], pole: [1, -0.2, 0.3] }, hR: { to: 'foot.R', at: [-0.05, 0.01, 0.07], pole: [-1, -0.2, 0.3] } }, keys: [
    { p: HB, t: 2.5 }, { p: M(HB, { ori: [0, -90, 0, 8], sp: [0, 0, -6] }), t: 2.5 }, { p: HB, t: 2.5 }, { p: M(HB, { ori: [0, -90, 0, -8], sp: [0, 0, 6] }), t: 2.5 }] });
  sup('supinetwist', { label: 'Lying knee twist', perSide: true, hold: true, breath: true, keys: [
    { p: M(SUP, { ori: [0, -90, 0], ...legs({ f: 90, k: 95, a: 0 }), ...both({ e: 90, p: 90, el: 4, g: 0 }) }), t: 2, h: 0.5 },
    { p: M(SUP, { ori: [0, -90, 0, -75], sp: [0, 0, 55], hd: [0, 0, 20], ...legs({ f: 90, k: 95, a: 0 }), ...both({ e: 90, p: 90, el: 4, g: 0 }) }), t: 2.5, h: 4 }] });
  sup('floorpress', { label: 'Floor press', props: DBS, contacts: FEET, keys: [
    { p: M(SUP, both({ e: 30, p: 70, el: 80, g: 1 })), t: 2.4, h: 0.3 },
    { p: M(SUP, both({ e: 88, p: 10, el: 2, g: 1 })), t: 1.2, h: 0.3 }] });

  // ======================= FLOOR: face down =======================
  // push-up: hands a little wider than the shoulders, elbows about 45 degrees, straight line from head to heels
  const pushPole = { pole: [0.75, 0.2, -0.65] };
  const PU = { hL: Object.assign({ type: 'palm', rot: 10 }, pushPole), hR: Object.assign({ type: 'palm', rot: 10 }, { pole: [-0.75, 0.2, -0.65] }), fL: 'ball', fR: 'ball' };
  const puTop = M(PLANK, { root: [0, 0.62, 0], ori: [0, 74.5, 0], ...both({ e: 75, p: 14, el: 0, g: 0 }), ...legs({ f: 0, k: 0, an: -18, toe: 50, a: 3 }) });
  const puBot = M(PLANK, { root: [0, 0.25, 0.3], ori: [0, 87.5, 0], ...both({ e: 30, p: 30, el: 100, g: 0 }), ...legs({ f: 0, k: 0, an: -4, toe: 60, a: 3 }) });
  def('pushup', { label: 'Push-up', view: { yaw: 66, pitch: 14 }, anchor: 'feet', balance: false, contacts: PU, props: [{ k: 'mat' }], keys: [{ p: puTop, t: 1.2, h: 0.4 }, { p: puBot, t: 2.6, h: 0.15 }] });
  const kpTop = M(puTop, { root: [0, 0.6, -0.1], ori: [0, 64, 0], ...legs({ f: 0, k: 95, an: -30, toe: 0 }) });
  const kpBot = M(puBot, { root: [0, 0.24, 0.22], ori: [0, 80, 0], ...legs({ f: 0, k: 85, an: -30, toe: 0 }) });
  def('kneepushup', { label: 'Knee push-up', view: { yaw: 66, pitch: 14 }, anchor: 'ground', groundSkip: 'arms', pin: ['shin.L', 'shin.R'], contacts: { hL: PU.hL, hR: PU.hR }, props: [{ k: 'mat' }], keys: [{ p: kpTop, t: 1.2, h: 0.4 }, { p: kpBot, t: 2.4, h: 0.15 }] });
  def('inclinepushup', { label: 'Incline push-up', view: { yaw: 66, pitch: 12 }, anchor: 'none', props: [{ k: 'bench', pos: [0, 0, 0.55], yaw: 90 }], contacts: { hL: Object.assign({}, PU.hL, { y: 0.455, pos: [0.21, 0, 0.5] }), hR: Object.assign({}, PU.hR, { y: 0.455, pos: [-0.21, 0, 0.5] }), fL: 'ball', fR: 'ball' }, keys: [
    { p: M(PLANK, { root: [0, 0.82, -0.35], ori: [0, 52, 0], ...both({ e: 56, p: 14, el: 0 }), ...legs({ f: 0, k: 0, an: -30, toe: 45, a: 3 }) }), t: 1.2, h: 0.4 },
    { p: M(PLANK, { root: [0, 0.6, -0.12], ori: [0, 64, 0], ...both({ e: 20, p: 30, el: 100 }), ...legs({ f: 0, k: 0, an: -20, toe: 50, a: 3 }) }), t: 2.4, h: 0.2 }] });
  // forearm plank (elbows under shoulders) and straight-arm plank
  const FPL = M(PLANK, { root: [0, 0.42, 0], ori: [0, 80, 0], nk: [-6, 0, 0], ...both({ e: 80, p: 10, el: 90, g: 0.4, pr: 0 }), ...legs({ f: 0, k: 0, an: -12, toe: 55, a: 3 }) });
  def('plank', { label: 'Plank', view: { yaw: 64, pitch: 14 }, anchor: 'ground', hold: true, breath: true, contacts: { fL: 'ball', fR: 'ball' }, props: [{ k: 'mat' }], keys: [{ p: FPL, t: 3 }, { p: M(FPL, { sp: [-1, 0, 0] }), t: 3 }] });
  def('highplank', { label: 'High plank', view: { yaw: 64, pitch: 14 }, anchor: 'feet', balance: false, hold: true, breath: true, contacts: PU, props: [{ k: 'mat' }], keys: [{ p: puTop, t: 3 }, { p: M(puTop, { sp: [-1, 0, 0] }), t: 3 }] });
  def('shouldertaps', { label: 'Plank shoulder taps', view: { yaw: 40, pitch: 18 }, anchor: 'feet', balance: false, contacts: Object.assign({}, PU), props: [{ k: 'mat' }], keys: [
    { p: M(puTop, { cw: { hL: 1, hR: 1 } }), t: 0.5, h: 0.1 }, { p: M(puTop, { aL: { e: 120, p: -60, el: 120 }, cw: { hL: 0, hR: 1 }, ori: [0, 74.5, -3] }), t: 0.5, h: 0.15 },
    { p: M(puTop, { cw: { hL: 1, hR: 1 } }), t: 0.5, h: 0.1 }, { p: M(puTop, { aR: { e: 120, p: -60, el: 120 }, cw: { hL: 1, hR: 0 }, ori: [0, 74.5, 3] }), t: 0.5, h: 0.15 }] });
  def('climber', { label: 'Mountain climber', view: { yaw: 66, pitch: 14 }, anchor: 'feet', balance: false, contacts: PU, props: [{ k: 'mat' }], refP: puTop, keys: [
    { p: M(puTop, { lL: { f: 146, k: 140, an: -30, toe: 10 }, cw: { fL: 0, fR: 1 } }), t: 0.32, ease: 'sine' },
    { p: M(puTop, { lR: { f: 146, k: 140, an: -30, toe: 10 }, cw: { fL: 1, fR: 0 } }), t: 0.32, ease: 'sine' }] });
  // burpee: squat, hands down, jump back to plank, jump in, jump up
  const BU_SQ = P(M({ root: [0, 0.6, 0.05], ori: [0, 48, 0], ...legs({ f: 125, k: 120, an: 30, a: 8, r: 10 }) }, M(both({ e: 60, p: 12, el: 4, g: 0 }), { cw: { hL: 1, hR: 1 } })));
  def('burpee', { label: 'Burpee', view: { yaw: 66, pitch: 10 }, anchor: 'ground', groundSkip: 'arms', contacts: { hL: { type: 'palm', rot: 10 }, hR: { type: 'palm', rot: 10 } }, ref: 1, keys: [
    { p: P(M(both({ e: 150, p: 20, el: 6 }), { cw: { hL: 0, hR: 0 } })), t: 0.5 },
    { p: BU_SQ, t: 0.55 },
    { p: M(puTop, { root: [0, 0.62, -0.62], cw: { hL: 1, hR: 1 } }), t: 0.4 , h: 0.25 },
    { p: BU_SQ, t: 0.4 },
    { p: P(M(legs({ an: -30, k: 2 }), M(both({ e: 165, p: 20, el: 6 }), { cw: { hL: 0, hR: 0 } }))), t: 0.6, air: 0.7 }] });
  // cobra: hips stay down, press the chest up with the back muscles first
  const PRONE = M(STAND, { root: [0, 0.12, 0], ori: [0, 90, 0], nk: [-6, 0, 0], hd: [-6, 0, 0], ...legs({ f: 0, k: 2, an: -80, a: 4 }) });
  def('cobra', { label: 'Cobra', view: { yaw: 70, pitch: 14 }, anchor: 'ground', groundSkip: 'arms', pin: 'hips', contacts: { hL: { type: 'palm', rot: 8, pole: [0.3, 0.1, -1] }, hR: { type: 'palm', rot: 8, pole: [-0.3, 0.1, -1] } }, props: [{ k: 'mat' }], keys: [
    { p: M(PRONE, both({ e: 30, p: 40, el: 110, g: 0 })), t: 2, h: 0.4 },
    { p: M(PRONE, M({ sp: [-52, 0, 0], nk: [-12, 0, 0], hd: [-8, 0, 0] }, both({ e: 30, p: 40, el: 110, g: 0 }))), t: 2.2, h: 1.2 }], ref: 0 });
  def('superman', { label: 'Superman', view: { yaw: 70, pitch: 14 }, anchor: 'ground', pin: 'hips', props: [{ k: 'mat' }], keys: [
    { p: M(PRONE, both({ e: 172, p: 10, el: 4, g: 0.1 })), t: 1.4, h: 0.3 },
    { p: M(PRONE, M({ sp: [-16, 0, 0], nk: [-8, 0, 0], ...legs({ f: -14, k: 2, an: -70, a: 5 }) }, both({ e: 186, p: 12, el: 4, g: 0.1 }))), t: 1.4, h: 1.2 }] });

  // ======================= FLOOR: on the side =======================
  // side plank from the knees: forearm under the shoulder, knees bent, lift until head-hips-knees line up (left side down)
  const SIDEBASE = M(STAND, { root: [0, 0.3, 0], ori: [0, 0, -74], sp: [0, 2, 0], hd: [0, -12, 0], aL: { e: 90, p: 90, el: 90, r: -90, g: 0.3 }, aR: { e: 8, p: 60, el: 70, g: 0.3 } });
  def('sideplankknee', { label: 'Side plank from knees', perSide: true, hold: true, breath: true, view: { yaw: 2, pitch: 10 }, anchor: 'ground', groundSkip: 'arms', pin: 'shin.L',
    contacts: { hL: { type: 'palm', rot: 0, under: 'upperarm.L', fwd: 0.27, pole: [0, -1, -0.3] }, hR: { to: 'hips', at: [-0.15, 0.04, 0.0], pole: [-0.3, 0.5, -1] } }, props: [{ k: 'mat', yaw: 90 }], keys: [
      { p: M(SIDEBASE, legs({ f: 18, k: 92, a: 0, an: -20 })), t: 3 }, { p: M(SIDEBASE, M({ ori: [0, 0, -75] }, legs({ f: 18, k: 92, a: 0, an: -20 }))), t: 3 }] });
  def('sideplank', { label: 'Side plank', perSide: true, hold: true, breath: true, view: { yaw: 2, pitch: 10 }, anchor: 'ground', groundSkip: 'arms', pin: 'foot.L',
    contacts: { hL: { type: 'palm', rot: 0, under: 'upperarm.L', fwd: 0.27, pole: [0, -1, -0.3] } }, props: [{ k: 'mat', yaw: 90 }], keys: [
      { p: M(SIDEBASE, M({ ori: [0, 0, -72], aR: { e: 175, p: 90, el: 4, g: 0.1 } }, { lL: { f: 0, k: 2, a: 0, an: -10 }, lR: { f: 6, k: 2, a: -4, an: -10 } })), t: 3 },
      { p: M(SIDEBASE, M({ ori: [0, 0, -73], aR: { e: 175, p: 90, el: 4, g: 0.1 } }, { lL: { f: 0, k: 2, a: 0, an: -10 }, lR: { f: 6, k: 2, a: -4, an: -10 } })), t: 3 }] });
  const SIDELY = M(STAND, { root: [0, 0.18, 0], ori: [0, 0, -90], hd: [0, -40, 0], aL: { e: 170, p: 90, el: 120, g: 0.2 }, aR: { e: 30, p: 10, el: 60, g: 0.2 } });
  def('clamshell', { label: 'Clamshell', perSide: true, view: { yaw: 8, pitch: 22 }, anchor: 'ground', pin: 'hips', props: [{ k: 'mat', yaw: 90 }], keys: [
    { p: M(SIDELY, legs({ f: 45, k: 90, a: 0, an: 0 })), t: 1.4, h: 0.2 }, { p: M(SIDELY, { lL: { f: 45, k: 90, a: 0 }, lR: { f: 45, k: 90, a: 18, r: 58 } }), t: 1.2, h: 0.6 }] });
  def('sidelegraise', { label: 'Side-lying leg raise', perSide: true, view: { yaw: 8, pitch: 20 }, anchor: 'ground', pin: 'hips', props: [{ k: 'mat', yaw: 90 }], keys: [
    { p: M(SIDELY, { lL: { f: 10, k: 30, a: 0 }, lR: { f: 0, k: 2, a: 0, an: -10 } }), t: 1.8, h: 0.2 }, { p: M(SIDELY, { lL: { f: 10, k: 30, a: 0 }, lR: { f: 0, k: 2, a: 40, an: -10 } }), t: 1.2, h: 0.6 }] });

  // ======================= KNEELING / SEATED STRETCHES =======================
  // half-kneeling hip flexor stretch (left knee down): tuck the tailbone, shift the hips forward
  const HK = M(STAND, { root: [0, 0.6, 0], ori: [0, -4, 0], sp: [2, 0, 0], lR: { f: 86, k: 92, a: 4, an: 6 }, lL: { f: -10, k: 90, a: 4, an: -80 }, ...both({ e: 20, p: 30, el: 60, g: 0.3 }) });
  def('hipflexor', { label: 'Half-kneeling hip flexor stretch', perSide: true, hold: true, breath: true, view: { yaw: 80, pitch: 8 }, anchor: { bones: ['shin.L'], y: 0 }, contacts: { fR: 'flat', hL: { to: 'thigh.R', at: [0.06, -0.38, 0.03], pole: [0.6, -0.2, -1] }, hR: { to: 'thigh.R', at: [-0.06, -0.38, 0.03], pole: [-0.6, -0.2, -1] } }, props: [{ k: 'mat' }], keys: [
    { p: HK, t: 2.4, h: 0.6 }, { p: M(HK, { root: [0, 0.6, 0.1], ori: [0, -10, 0], lR: { f: 70, k: 100 }, lL: { f: -26, k: 92 } }), t: 2.6, h: 2.6 }] });
  const SIT = M(STAND, { root: [0, 0.14, 0], ori: [0, -6, 0], ...legs({ f: 84, k: 4, an: -10, a: 6 }), ...both({ e: 20, p: 50, el: 10, g: 0 }) });
  def('forwardfold', { label: 'Seated forward fold', hold: true, breath: true, view: { yaw: 75, pitch: 12 }, anchor: 'ground', groundSkip: 'arms', pin: 'hips', props: [{ k: 'mat' }],
    contacts: { hL: { to: 'shin.L', at: [0.02, 0.36, 0.04], pole: [1, 1, 0] }, hR: { to: 'shin.R', at: [-0.02, 0.36, 0.04], pole: [-1, 1, 0] } }, keys: [
      { p: M(SIT, { ori: [0, 26, 0], sp: [38, 0, 0], nk: [10, 0, 0], ...legs({ f: 112, k: 4, an: -2, a: 6 }) }), t: 3 }, { p: M(SIT, { ori: [0, 30, 0], sp: [42, 0, 0], nk: [12, 0, 0], ...legs({ f: 116, k: 4, an: 0, a: 6 }) }), t: 3 }] });
  def('butterfly', { label: 'Butterfly stretch', hold: true, breath: true, view: { yaw: 22, pitch: 16 }, anchor: 'ground', groundSkip: 'arms', pin: 'hips', props: [{ k: 'mat' }],
    contacts: { hL: { to: 'foot.L', at: [0, 0.02, 0.06], pole: [1, 0, 0] }, hR: { to: 'foot.R', at: [0, 0.02, 0.06], pole: [-1, 0, 0] } }, keys: [
      { p: M(SIT, { ori: [0, 8, 0], sp: [10, 0, 0], ...legs({ f: 70, k: 135, a: 52, r: 30, an: 0 }) }), t: 3 }, { p: M(SIT, { ori: [0, 14, 0], sp: [14, 0, 0], ...legs({ f: 72, k: 135, a: 56, r: 30, an: 0 }) }), t: 3 }] });
  def('russiantwist', { label: 'Russian twist', view: { yaw: 30, pitch: 14 }, anchor: 'ground', groundSkip: 'arms', pin: 'hips', alt: true, props: [{ k: 'mat' }], contacts: { hR: { to: 'hand.L', at: [-0.03, 0, 0] } }, keys: [
    { p: M(SIT, { ori: [0, -38, 0], sp: [14, 0, 36], ...legs({ f: 120, k: 95, an: 0, a: 4 }), ...both({ e: 60, p: -20, el: 40, g: 0.7 }) }), t: 0.7, h: 0.15 },
    { p: M(SIT, { ori: [0, -38, 0], sp: [14, 0, -36], ...legs({ f: 120, k: 95, an: 0, a: 4 }), ...both({ e: 60, p: -20, el: 40, g: 0.7 }) }), t: 0.7, h: 0.15 }] });

  // ======================= STANDING STRETCHES =======================
  stand('quadstretch', { label: 'Standing quad stretch', perSide: true, hold: true, breath: true, contacts: { fR: 'flat', hL: { to: 'foot.L', at: [0, 0.02, 0.02], pole: [0.4, 0.3, -1] } }, keys: [
    { p: P({ lL: { f: -6, k: 150, an: -40 }, aR: { e: 30, p: 80, el: 10 } }), t: 3 }, { p: P({ lL: { f: -8, k: 152, an: -40 }, aR: { e: 32, p: 80, el: 10 } }), t: 3 }] });
  stand('toetouch', { label: 'Standing forward fold', hold: true, breath: true, keys: [
    { p: P(M({ ori: [0, 70, 0], sp: [48, 0, 0], nk: [14, 0, 0] }, M(legs({ f: 72, k: 6 }), both({ e: 112, p: 8, el: 4, g: 0 })))), t: 3 },
    { p: P(M({ ori: [0, 74, 0], sp: [50, 0, 0], nk: [16, 0, 0] }, M(legs({ f: 76, k: 6 }), both({ e: 118, p: 8, el: 4, g: 0 })))), t: 3 }] });
  stand('chestopener', { label: 'Chest opener', hold: true, breath: true, contacts: Object.assign({}, FEET, { hR: { to: 'hand.L', at: [-0.03, 0, -0.01] } }), keys: [
    { p: P(M({ sp: [-10, 0, 0], hd: [-8, 0, 0] }, both({ e: -40, p: 14, el: 6, g: 0.6, cl: [0, -14] }))), t: 3 }, { p: P(M({ sp: [-12, 0, 0], hd: [-10, 0, 0] }, both({ e: -44, p: 14, el: 6, g: 0.6, cl: [0, -16] }))), t: 3 }] });
  stand('sidebend', { label: 'Standing side bend', perSide: true, view: FRONT, hold: true, breath: true, keys: [
    { p: P(M({ sp: [0, -26, 0], nk: [0, -8, 0] }, { aL: { e: 172, p: 70, el: 12 }, aR: { e: 6, p: 80, el: 10 } })), t: 3 },
    { p: P(M({ sp: [0, -30, 0], nk: [0, -9, 0] }, { aL: { e: 174, p: 70, el: 12 }, aR: { e: 6, p: 80, el: 10 } })), t: 3 }] });
  stand('torsotwist', { label: 'Standing torso twist', view: FRONT, keys: [
    { p: P(M({ sp: [0, 0, 40], nk: [0, 0, 10], ori: [12, 0, 0] }, both({ e: 80, p: 30, el: 110, g: 0.4 }))), t: 1.1, h: 0.2 },
    { p: P(M({ sp: [0, 0, -40], nk: [0, 0, -10], ori: [-12, 0, 0] }, both({ e: 80, p: 30, el: 110, g: 0.4 }))), t: 1.1, h: 0.2 }] });
  stand('reachup', { label: 'Overhead reach', view: FRONT, hold: true, breath: true, keys: [
    { p: P(M({ sp: [-4, 0, 0] }, M(legs({ an: 0 }), both({ e: 176, p: 30, el: 4, g: 0 })))), t: 3 }, { p: P(M({ sp: [-5, 0, 0] }, both({ e: 178, p: 28, el: 4, g: 0 }))), t: 3 }] });
  stand('neckstretch', { label: 'Neck stretch', perSide: true, view: FRONT, hold: true, breath: true, contacts: Object.assign({}, FEET, { hL: { to: 'head', at: [-0.07, 0.1, 0.0], pole: [1, 1, 0] } }), keys: [
    { p: P({ nk: [0, 18, 0], hd: [0, 20, 0], aL: { e: 150, p: 70, el: 130 } }), t: 3 }, { p: P({ nk: [0, 20, 0], hd: [0, 22, 0], aL: { e: 150, p: 70, el: 130 } }), t: 3 }] });
  stand('crossbody', { label: 'Cross-body shoulder stretch', perSide: true, view: { yaw: 25, pitch: 8 }, hold: true, breath: true, contacts: Object.assign({}, FEET, { hR: { to: 'forearm.L', at: [0, 0.05, 0.02], pole: [-1, -1, 0] } }), keys: [
    { p: P({ aL: { e: 92, p: -38, el: 6, g: 0.2 }, aR: { e: 40, p: 20, el: 100 } }), t: 3 }, { p: P({ aL: { e: 92, p: -42, el: 6, g: 0.2 }, aR: { e: 40, p: 20, el: 100 } }), t: 3 }] });

  // ======================= BENCH / BOX =======================
  // one-arm dumbbell row: same-side hand and knee on the bench, back flat, pull the elbow toward the hip
  const ROWB = M(STAND, { root: [0, 0.95, 0], ori: [0, 84, 0], nk: [-14, 0, 0], hd: [-6, 0, 0],
    aL: { e: 84, p: 4, el: 2, g: 0 }, aR: { e: 84, p: 6, el: 4, g: 1, pr: -10 }, lL: { f: 84, k: 92, a: 0, an: -80 }, lR: { f: 90, k: 18, a: 10, r: 8 } });
  def('row1arm', { label: 'One-arm dumbbell row', perSide: true, view: { yaw: -60, pitch: 12 }, anchor: { bones: ['shin.L'], y: 0.455 }, contacts: { hL: { type: 'palm', y: 0.425, rot: 6 }, fR: 'flat' },
    props: [{ k: 'bench', pos: [0.14, 0, 0.15] }, { k: 'dbR', at: 'handR' }], keys: [
      { p: ROWB, t: 2.2, h: 0.2 },
      { p: M(ROWB, { aR: AW(84, -60, 6, { p: 14, g: 1, pr: -10 }), sp: [0, 0, -4] }), t: 1.1, h: 0.8 }] });
  def('stepup', { label: 'Step-up', perSide: true, view: { yaw: 70, pitch: 8 }, anchor: 'feet', contacts: { fL: { type: 'flat', y: 0.455, pos: [0.1, 0, 0.3] }, fR: { type: 'flat', pos: [-0.1, 0, -0.06], noAnchor: true } }, props: [{ k: 'bench', pos: [0, 0, 0.32], yaw: 90 }], keys: [
    { p: P({ ori: [0, 22, 0], lL: { f: 104, k: 126, an: 16 }, lR: { f: 4, k: 4 }, ...both({ e: 10, p: 70, el: 14 }) }), t: 1.6, h: 0.3 },
    { p: P({ ori: [0, 4, 0], lL: { f: 2, k: 3 }, lR: { f: 40, k: 70, an: -5 }, ...both({ e: 10, p: 70, el: 14 }), cw: { fR: 0 } }), t: 1.3, h: 0.4 }] });
  def('dips', { label: 'Bench dips', view: { yaw: 70, pitch: 10 }, anchor: 'none', props: [{ k: 'bench', pos: [0, 0, -0.18], yaw: 90 }], contacts: { hL: { type: 'palm', y: 0.425, rot: 180, pole: [0, 0.3, -1] }, hR: { type: 'palm', y: 0.425, rot: 180, pole: [0, 0.3, -1] }, fL: 'flat', fR: 'flat' }, keys: [
    { p: P(M({ root: [0, 0.62, 0], ori: [0, 0, 0] }, M(legs({ f: 80, k: 80, an: 0 }), both({ e: -20, p: 20, el: 4, g: 0.6 })))), t: 1.2, h: 0.3 },
    { p: P(M({ root: [0, 0.38, 0], ori: [0, 4, 0] }, M(legs({ f: 70, k: 60, an: 0 }), both({ e: -60, p: 20, el: 90, g: 0.6 })))), t: 2.2, h: 0.2 }] });
})();
