// ---------- Drillbook animated coach figure ----------
// Side view, facing right (+x). Ground at y = 0, y up. Angles in degrees:
// 0 = pointing down, 90 = forward (+x), 180 = up, -90 = backward (-x).
var Figure = (function () {
  const L = { torso: 0.52, neck: 0.06, head: 0.105, ua: 0.29, fa: 0.27, th: 0.44, sh: 0.44, foot: 0.12 };
  const R = Math.PI / 180;
  const pt = (p, a, len) => [p[0] + len * Math.sin(a * R), p[1] - len * Math.cos(a * R)];
  const ang = (p, q) => Math.atan2(q[0] - p[0], -(q[1] - p[1])) / R;
  function ik(root, target, l1, l2, bend) {
    let dx = target[0] - root[0], dy = target[1] - root[1];
    let d = Math.hypot(dx, dy);
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
    const phi = ang(root, target);
    const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const a1 = phi + bend * Math.acos(Math.max(-1, Math.min(1, c))) / R;
    const j = pt(root, a1, l1);
    return [a1, ang(j, target)];
  }
  // body line helper for planks/push-ups: from toes, at angle (deg above horizontal)
  function line(toes, deg, dist) { const r = deg * R; return [toes[0] + dist * Math.cos(r), toes[1] + dist * Math.sin(r)]; }

  const STAND = { hip: [0, 0.93], torso: 180, arms: [{ a: [6, 14] }, { a: [-6, 4] }], legs: [{ t: [0.03, 0.05], b: 1 }, { t: [-0.03, 0.05], b: 1 }] };
  const clone = o => JSON.parse(JSON.stringify(o));
  const P = (base, over) => Object.assign(clone(base), over);

  // supine (on back, head to the left)
  const SUP = { hip: [0.05, 0.11], torso: -90, headA: -92, arms: [{ a: [88, 90] }, { a: [92, 92] }] };
  const KNEES_BENT = [{ t: [0.42, 0.05], b: 1 }, { t: [0.4, 0.05], b: 1 }];

  // quadruped (hands and knees)
  const QUAD = { hip: [-0.22, 0.5], torso: 91, headA: 95, arms: [{ t: [0.32, 0.02], b: 1 }, { t: [0.30, 0.02], b: 1 }], legs: [{ t: [-0.62, 0.05], b: 1, knee: [-0.22, 0.05] }, { t: [-0.6, 0.05], b: 1, knee: [-0.2, 0.05] }] };

  function plank(deg, handsX, opts) {
    const toes = [-0.95, 0.03];
    const hip = line(toes, deg, 0.86);
    const torso = 90 - deg;
    return Object.assign({ hip, torso: 90 + deg, headA: 90 + deg + 4, arms: [{ t: [handsX, 0.02], b: 1 }, { t: [handsX - 0.02, 0.02], b: 1 }], legs: [{ t: toes, b: -1, ft: -10 }, { t: [toes[0] + 0.02, toes[1]], b: -1, ft: -10 }] }, opts || {});
  }

  const PAT = {
    stand: { label: 'Stand tall', frames: [STAND, P(STAND, { hip: [0, 0.92] })], hold: true },
    squat: { frames: [P(STAND, { arms: [{ a: [70, 85] }, { a: [66, 82] }] }), P(STAND, { hip: [-0.3, 0.5], torso: 148, arms: [{ a: [85, 92] }, { a: [82, 90] }] })] },
    goblet: { prop: 'bell', frames: [P(STAND, { arms: [{ a: [18, 165], rel: 0 }, { a: [12, 160] }] }), P(STAND, { hip: [-0.3, 0.5], torso: 150, arms: [{ a: [40, 170] }, { a: [34, 168] }] })] },
    lunge: { frames: [STAND, P(STAND, { hip: [-0.04, 0.55], legs: [{ t: [0.42, 0.05], b: 1 }, { t: [-0.62, 0.05], b: 1, ft: -40, knee2: 1 }], arms: [{ a: [4, 10] }, { a: [-4, 4] }] })] },
    pushup: { frames: [plank(25, 0.36, { arms: [{ t: [0.36, 0.02], b: -1 }, { t: [0.34, 0.02], b: -1 }] }), plank(9, 0.36, { arms: [{ t: [0.36, 0.02], b: -1 }, { t: [0.34, 0.02], b: -1 }] })] },
    plank: { hold: true, frames: [P(plank(11, 0.36), { arms: [{ a: [2, 90] }, { a: [0, 90] }] }), P(plank(12, 0.36), { arms: [{ a: [2, 90] }, { a: [0, 90] }] })] },
    sideplank: { hold: true, frames: [
      { hip: [-0.12, 0.3], torso: 112, headA: 114, arms: [{ a: [0, 92] }, { a: [175, 180] }], legs: [{ t: [-0.6, 0.05], b: 1, knee: [-0.5, 0.03] }, { t: [-0.6, 0.06], b: 1 }] },
      { hip: [-0.12, 0.33], torso: 110, headA: 112, arms: [{ a: [0, 92] }, { a: [175, 180] }], legs: [{ t: [-0.6, 0.05], b: 1 }, { t: [-0.6, 0.06], b: 1 }] }] },
    bridge: { frames: [P(SUP, { legs: KNEES_BENT }), P(SUP, { hip: [0.0, 0.42], torso: -52, headA: -88, legs: KNEES_BENT })] },
    catcow: { frames: [P(QUAD, { curve: 0.13, headA: 30 }), P(QUAD, { curve: -0.1, headA: 128 })] },
    birddog: { frames: [QUAD, P(QUAD, { arms: [{ a: [92, 92] }, { t: [0.30, 0.02], b: 1 }], legs: [{ t: [-0.62, 0.05], b: 1 }, { a: [-86, -90], ft: 0 }] })] },
    deadbug: { frames: [P(SUP, { arms: [{ a: [178, 178] }, { a: [182, 182] }], legs: [{ a: [180, 90] }, { a: [178, 88] }] }), P(SUP, { arms: [{ a: [-110, -105] }, { a: [182, 182] }], legs: [{ a: [180, 90] }, { a: [100, 96] }] })] },
    childpose: { hold: true, frames: [
      { hip: [-0.36, 0.3], torso: 64, headA: 50, arms: [{ a: [84, 90] }, { a: [86, 90] }], legs: [{ t: [-0.5, 0.04], b: 1, knee: [0.06, 0.04] }, { t: [-0.5, 0.05], b: 1 }] },
      { hip: [-0.36, 0.31], torso: 66, headA: 52, curve: 0.04, arms: [{ a: [84, 90] }, { a: [86, 90] }], legs: [{ t: [-0.5, 0.04], b: 1 }, { t: [-0.5, 0.05], b: 1 }] }] },
    figure4: { hold: true, frames: [
      P(SUP, { legs: [{ k4: 1 }, { a: [150, 95] }], arms: [{ hold: 'farknee' }, { hold: 'farknee' }] }),
      P(SUP, { legs: [{ k4: 1 }, { a: [157, 100] }], arms: [{ hold: 'farknee' }, { hold: 'farknee' }] })] },
    hipflexor: { hold: true, frames: [
      { hip: [0, 0.47], torso: 180, arms: [{ a: [-25, 40] }, { a: [-28, 38] }], legs: [{ t: [0.42, 0.05], b: 1 }, { t: [-0.62, 0.06], b: 1, ft: -60 }] },
      { hip: [0.08, 0.45], torso: 183, arms: [{ a: [-25, 40] }, { a: [-28, 38] }], legs: [{ t: [0.42, 0.05], b: 1 }, { t: [-0.62, 0.06], b: 1, ft: -60 }] }] },
    happybaby: { hold: true, frames: [
      P(SUP, { legs: [{ a: [-150, 178] }, { a: [-146, 176] }], arms: [{ hold: 'nearfoot' }, { hold: 'farfoot' }] }),
      P(SUP, { legs: [{ a: [-142, 180] }, { a: [-140, 178] }], arms: [{ hold: 'nearfoot' }, { hold: 'farfoot' }] })] },
    kneeschest: { hold: true, frames: [
      P(SUP, { legs: [{ a: [-160, 100] }, { a: [-156, 98] }], arms: [{ hold: 'nearshin' }, { hold: 'farshin' }] }),
      P(SUP, { hip: [0.07, 0.12], legs: [{ a: [-148, 110] }, { a: [-145, 108] }], arms: [{ hold: 'nearshin' }, { hold: 'farshin' }] })] },
    breathe: { hold: true, breath: true, frames: [
      P(SUP, { curve: 0, legs: KNEES_BENT, arms: [{ hold: 'belly', b: 1 }, { a: [92, 92] }] }),
      P(SUP, { curve: -0.07, legs: KNEES_BENT, arms: [{ hold: 'belly', b: 1 }, { a: [92, 92] }] })] },
    row: { prop: 'bench', bell: 'near', frames: [
      { hip: [-0.18, 0.86], torso: 96, headA: 98, arms: [{ a: [2, 0] }, { t: [0.34, 0.47], b: 1 }], legs: [{ t: [-0.26, 0.05], b: 1 }, { t: [-0.55, 0.47], b: 1, knee: [-0.18, 0.46], ft: -90 }] },
      { hip: [-0.18, 0.86], torso: 96, headA: 98, arms: [{ a: [-128, -8] }, { t: [0.34, 0.47], b: 1 }], legs: [{ t: [-0.26, 0.05], b: 1 }, { t: [-0.55, 0.47], b: 1, ft: -90 }] }] },
    press: { prop: 'bells', frames: [P(STAND, { arms: [{ a: [12, 168] }, { a: [8, 165] }] }), P(STAND, { arms: [{ a: [176, 180] }, { a: [174, 178] }] })] },
    hinge: { prop: 'bells', frames: [P(STAND, { arms: [{ a: [2, 2] }, { a: [-2, -2] }] }), P(STAND, { hip: [-0.24, 0.84], torso: 102, headA: 104, arms: [{ a: [0, 0] }, { a: [-2, -2] }], legs: [{ t: [0.03, 0.05], b: 1 }, { t: [-0.03, 0.05], b: 1 }] })] },
    curl: { prop: 'bells', frames: [P(STAND, { arms: [{ a: [4, 6] }, { a: [-2, 2] }] }), P(STAND, { arms: [{ a: [8, 160] }, { a: [4, 156] }] })] },
    raise: { prop: 'bells', frames: [P(STAND, { arms: [{ a: [10, 12] }, { a: [4, 6] }] }), P(STAND, { arms: [{ a: [92, 94] }, { a: [88, 90] }] })] },
    jack: { frames: [P(STAND, { arms: [{ a: [8, 10] }, { a: [-8, -6] }] }), P(STAND, { lift: 0.1, arms: [{ a: [168, 172] }, { a: [-168, -172] }], legs: [{ a: [12, 8], ft: 40 }, { a: [-12, -8], ft: 40 }] })] },
    knees: { frames: [P(STAND, { arms: [{ a: [-40, 60] }, { a: [50, 140] }], legs: [{ a: [85, 0] }, { t: [-0.02, 0.05], b: 1 }] }), P(STAND, { arms: [{ a: [50, 140] }, { a: [-40, 60] }], legs: [{ t: [0.02, 0.05], b: 1 }, { a: [85, 0] }] })] },
    walk: { frames: [P(STAND, { arms: [{ a: [-25, -10] }, { a: [25, 40] }], legs: [{ a: [22, 8] }, { a: [-20, -26] }] }), P(STAND, { arms: [{ a: [25, 40] }, { a: [-25, -10] }], legs: [{ a: [-20, -26] }, { a: [22, 8] }] })] },
    climber: { frames: [P(plank(24, 0.36), { legs: [{ t: [-0.05, 0.16], b: -1 }, { t: [-0.93, 0.03], b: -1, ft: -10 }] }), P(plank(24, 0.36), { legs: [{ t: [-0.95, 0.03], b: -1, ft: -10 }, { t: [-0.07, 0.16], b: -1 }] })] },
    burpee: { seq: true, frames: [STAND, P(STAND, { hip: [-0.25, 0.42], torso: 125, arms: [{ t: [0.3, 0.02], b: 1 }, { t: [0.28, 0.02], b: 1 }] }), plank(24, 0.3), P(STAND, { hip: [-0.25, 0.42], torso: 125, arms: [{ t: [0.3, 0.02], b: 1 }, { t: [0.28, 0.02], b: 1 }] }), P(STAND, { lift: 0.18, arms: [{ a: [170, 175] }, { a: [166, 172] }] })] },
    jumpsquat: { frames: [P(STAND, { hip: [-0.3, 0.52], torso: 148, arms: [{ a: [-30, -20] }, { a: [-34, -24] }] }), P(STAND, { lift: 0.2, arms: [{ a: [160, 165] }, { a: [156, 162] }], legs: [{ a: [2, -4], ft: 30 }, { a: [-2, -6], ft: 30 }] })] },
    crunch: { frames: [P(SUP, { legs: KNEES_BENT, arms: [{ a: [-140, 40] }, { a: [-138, 42] }] }), P(SUP, { torso: -122, headA: -132, legs: KNEES_BENT, arms: [{ a: [-110, 70] }, { a: [-108, 72] }] })] },
    situp: { frames: [P(SUP, { legs: KNEES_BENT, arms: [{ a: [-160, -170] }, { a: [-158, -168] }] }), P(SUP, { torso: -190, headA: -200, legs: KNEES_BENT, arms: [{ a: [90, 92] }, { a: [88, 90] }] })] },
    bicycle: { frames: [P(SUP, { torso: -115, headA: -125, arms: [{ a: [-140, 40] }, { a: [-138, 42] }], legs: [{ a: [-150, 100] }, { a: [120, 100] }] }), P(SUP, { torso: -115, headA: -125, arms: [{ a: [-140, 40] }, { a: [-138, 42] }], legs: [{ a: [120, 100] }, { a: [-150, 100] }] })] },
    calf: { frames: [STAND, P(STAND, { lift: 0.07, legs: [{ a: [2, 2], ft: 20 }, { a: [-2, -2], ft: 20 }] })] },
    fold: { hold: true, frames: [
      { hip: [-0.1, 0.11], torso: 140, headA: 120, arms: [{ hold: 'nearfoot' }, { hold: 'farfoot' }], legs: [{ a: [90, 90], ft: 180 }, { a: [92, 92], ft: 180 }] },
      { hip: [-0.1, 0.11], torso: 128, headA: 112, arms: [{ hold: 'nearfoot' }, { hold: 'farfoot' }], legs: [{ a: [90, 90], ft: 180 }, { a: [92, 92], ft: 180 }] }] },
    reach: { hold: true, frames: [P(STAND, { arms: [{ a: [176, 178] }, { a: [172, 176] }] }), P(STAND, { torso: 176, arms: [{ a: [172, 175] }, { a: [168, 172] }] })] },
    cobra: { hold: true, frames: [
      { hip: [-0.2, 0.1], torso: 128, headA: 150, arms: [{ t: [0.12, 0.02], b: 1 }, { t: [0.1, 0.02], b: 1 }], legs: [{ a: [-90, -90], ft: 0 }, { a: [-88, -88], ft: 0 }] },
      { hip: [-0.2, 0.1], torso: 120, headA: 140, arms: [{ t: [0.12, 0.02], b: 1 }, { t: [0.1, 0.02], b: 1 }], legs: [{ a: [-90, -90], ft: 0 }, { a: [-88, -88], ft: 0 }] }] },
    superman: { frames: [
      { hip: [-0.1, 0.1], torso: 90, headA: 92, arms: [{ a: [90, 90] }, { a: [92, 92] }], legs: [{ a: [-90, -90], ft: 0 }, { a: [-88, -88], ft: 0 }] },
      { hip: [-0.1, 0.1], torso: 100, headA: 106, arms: [{ a: [100, 102] }, { a: [98, 100] }], legs: [{ a: [-100, -102], ft: 0 }, { a: [-98, -100], ft: 0 }] }] },
    wallsit: { hold: true, frames: [P(STAND, { hip: [-0.3, 0.47], torso: 178, arms: [{ a: [2, 2] }, { a: [0, 0] }], legs: [{ t: [0.15, 0.05], b: 1 }, { t: [0.13, 0.05], b: 1 }] }), P(STAND, { hip: [-0.3, 0.47], torso: 178, arms: [{ a: [2, 2] }, { a: [0, 0] }], legs: [{ t: [0.15, 0.05], b: 1 }, { t: [0.13, 0.05], b: 1 }] })] },
  };

  // keyword → pattern (first match wins; checked against the exercise name, then its instructions)
  const KEYS = [
    ['breathe', /breath|breathing|diaphragm/], ['catcow', /cat[\s-]?cow|cat\b|cow\b/], ['birddog', /bird[\s-]?dog/], ['deadbug', /dead[\s-]?bug/],
    ['childpose', /child'?s?\s*pose|balasana/], ['figure4', /figure[\s-]?(4|four)|pigeon|piriformis/], ['happybaby', /happy\s*baby/],
    ['kneeschest', /knees?[\s-]to[\s-]chest|knee hug/], ['hipflexor', /hip flexor|kneeling.*stretch|couch stretch/],
    ['sideplank', /side[\s-]?plank/], ['climber', /mountain\s*climb/], ['burpee', /burpee/], ['jumpsquat', /(jump|squat)\s*(squat|jump)s?/],
    ['bicycle', /bicycle/], ['situp', /sit[\s-]?ups?/], ['crunch', /crunch|curl[\s-]?up/], ['bridge', /bridge|hip thrust/],
    ['pushup', /push[\s-]?ups?|press[\s-]?ups?/], ['plank', /plank|hollow hold/], ['goblet', /goblet/], ['wallsit', /wall\s*sit/],
    ['lunge', /lunge|split squat|step[\s-]?up/], ['squat', /squat/], ['row', /\brows?\b/], ['press', /overhead|shoulder press|military|\bpress\b/],
    ['hinge', /deadlift|\brdl\b|good morning|hinge|swing/], ['curl', /\bcurls?\b/], ['raise', /lateral raise|front raise|\braises?\b/],
    ['jack', /jumping jack|star jump|\bjacks\b/], ['knees', /high knees|run|sprint|march|skip/], ['walk', /walk|step/],
    ['calf', /calf|heel raise/], ['fold', /hamstring|forward fold|toe touch|sit and reach/], ['cobra', /cobra|upward dog|sphinx|press[\s-]?up stretch/],
    ['superman', /superman|swimmer/], ['reach', /stretch|reach|mobility/],
  ];
  const CONTEXT = [
    ['breathe', /lie on your back[^.]*knees bent/], ['kneeschest', /lie on your back/], ['catcow', /hands and knees/], ['plank', /plank position/], ['stand', /stand/],
  ];
  function pick(name, steps) {
    const n = (name || '').toLowerCase();
    for (const [p, re] of KEYS) if (re.test(n)) return p;
    const s = (steps || '').toLowerCase();
    for (const [p, re] of CONTEXT) if (re.test(s)) return p;
    return 'stand';
  }

  // ----- kinematics -----
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(A, B, t) {
    if (typeof A === 'number') return lerp(A, B, t);
    if (Array.isArray(A)) return A.map((v, i) => mix(v, B[i], t));
    if (A && typeof A === 'object') { const o = {}; for (const k in A) o[k] = (B && k in B) ? mix(A[k], B[k], t) : A[k]; return o; }
    return t < 0.5 ? A : B;
  }
  // Resolve a keyframe (angles, IK targets, holds) into pure joint angles.
  const angCache = new WeakMap();
  function angles(pose) {
    if (angCache.has(pose)) return angCache.get(pose);
    const lift = pose.lift || 0;
    const hip = [pose.hip[0], pose.hip[1] + lift];
    const torso = pose.torso, headA = pose.headA != null ? pose.headA : torso, curve = pose.curve || 0;
    const legsIn = pose.legs || STAND.legs;
    const legs = legsIn.map(lg => {
      if (lg.k4) return null;
      const a = lg.a ? lg.a.slice() : ik(hip, [lg.t[0], lg.t[1] + lift], L.th, L.sh, lg.b || 1);
      return [a[0], a[1], lg.ft != null ? lg.ft : a[1] + 90];
    });
    legs.forEach((lg, i) => {
      if (lg) return;
      const o = legs[1 - i]; const knee = pt(hip, o[0], L.th);
      const a = ik(hip, [knee[0] + 0.03, knee[1] + 0.03], L.th, L.sh, -1);
      legs[i] = [a[0], a[1], a[1] + 90];
    });
    const A = { hip, torso, headA, curve, legs, arms: [] };
    const J0 = fk(A, true);
    const armsIn = pose.arms || STAND.arms;
    A.arms = armsIn.map(am => {
      const holdT = am.hold && target(am.hold, J0);
      if (holdT) return ik(J0.sh, holdT, L.ua, L.fa, am.b || -1);
      if (am.a) return am.a.slice();
      return ik(J0.sh, [am.t[0], am.t[1] + (am.t[1] < 0.1 ? 0 : lift)], L.ua, L.fa, am.b || 1);
    });
    angCache.set(pose, A);
    return A;
  }
  function fk(A, noArms) {
    const hip = A.hip, neck = pt(hip, A.torso, L.torso);
    const J = { hip, neck, sh: pt(neck, A.torso + 180, 0.05), headC: pt(neck, A.headA, L.neck + L.head), curve: A.curve, legs: [], arms: [] };
    A.legs.forEach(a => { const knee = pt(hip, a[0], L.th), ankle = pt(knee, a[1], L.sh); J.legs.push({ knee, ankle, toe: pt(ankle, a[2], L.foot) }); });
    if (!noArms) A.arms.forEach(a => { const elbow = pt(J.sh, a[0], L.ua); J.arms.push({ elbow, hand: pt(elbow, a[1], L.fa) }); });
    return J;
  }
  function solve(A) { return fk(A); }
  function target(name, J) {
    const n = J.legs[0], f = J.legs[1];
    switch (name) {
      case 'farknee': return f.knee && [lerp(J.hip[0], f.knee[0], 0.8), lerp(J.hip[1], f.knee[1], 0.8)];
      case 'nearfoot': return n.toe && n.ankle;
      case 'farfoot': return f.ankle;
      case 'nearshin': return n.knee && [lerp(n.knee[0], n.ankle[0], 0.35), lerp(n.knee[1], n.ankle[1], 0.35)];
      case 'farshin': return f.knee && [lerp(f.knee[0], f.ankle[0], 0.35), lerp(f.knee[1], f.ankle[1], 0.35)];
      case 'belly': { const m = [lerp(J.hip[0], J.neck[0], 0.35), lerp(J.hip[1], J.neck[1], 0.35)]; return [m[0], m[1] + 0.08 - J.curve * 0.4]; }
    }
    return null;
  }

  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const ease2 = x => { x = Math.min(1, Math.max(0, (x - 0.06) / 0.88)); return x * x * x * (x * (x * 6 - 15) + 10); };
  // phase: 0..1 over a rep (A→B→A), or a sequence
  function poseAt(p, phase) {
    const pat = PAT[p] || PAT.stand;
    const fr = pat.frames;
    if (pat.seq) {
      const n = fr.length, x = phase * n, i = Math.floor(x) % n, f = x - Math.floor(x);
      return mix(angles(fr[i]), angles(fr[(i + 1) % n]), ease(Math.min(1, f * 1.4)));
    }
    const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    return mix(angles(fr[0]), angles(fr[1]), ease2(tri));
  }

  // bounding box per pattern (world units)
  const bboxCache = {};
  function bbox(p) {
    if (bboxCache[p]) return bboxCache[p];
    let x0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let k = 0; k <= 20; k++) {
      const J = solve(poseAt(p, k / 20));
      const pts = [J.hip, J.neck, [J.headC[0] - L.head, J.headC[1]], [J.headC[0] + L.head, J.headC[1] + L.head]];
      J.legs.forEach(l => pts.push(l.knee, l.ankle, l.toe)); J.arms.forEach(a => pts.push(a.elbow, a.hand));
      for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    }
    return (bboxCache[p] = { x0, x1, y0: 0, y1 });
  }

  // ----- drawing -----
  function draw(ctx, w, h, p, phase, colors) {
    const pat = PAT[p] || PAT.stand;
    const J = solve(poseAt(p, phase));
    const bb = bbox(p);
    const pad = 0.18;
    const bw = bb.x1 - bb.x0 + pad * 2, bh = Math.max(bb.y1 + pad * 1.4, 1.0);
    const s = Math.min(w / Math.max(bw, 1.5), h / Math.max(bh, 1.5));
    const cx = (bb.x0 + bb.x1) / 2;
    const ox = w / 2 - cx * s, oy = h - h * 0.12;
    const X = q => [ox + q[0] * s, oy - q[1] * s];
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // floor
    ctx.strokeStyle = colors.floor; ctx.lineWidth = Math.max(2, s * 0.012);
    ctx.beginPath(); ctx.moveTo(w * 0.08, oy + s * 0.012); ctx.lineTo(w * 0.92, oy + s * 0.012); ctx.stroke();
    // props
    if (pat.prop === 'bench') {
      ctx.fillStyle = colors.prop;
      const a = X([-0.62, 0.45]), b = X([0.5, 0.39]);
      ctx.fillRect(a[0], a[1], b[0] - a[0], s * 0.06);
      ctx.fillRect(X([-0.5, 0])[0], a[1], s * 0.04, oy - a[1]); ctx.fillRect(X([0.38, 0])[0], a[1], s * 0.04, oy - a[1]);
    }
    const limb = (pts, width, color) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); const p0 = X(pts[0]); ctx.moveTo(p0[0], p0[1]); for (let i = 1; i < pts.length; i++) { const q = X(pts[i]); ctx.lineTo(q[0], q[1]); } ctx.stroke(); };
    const W = s * 0.075;
    // far side
    limb([J.hip, J.legs[1].knee, J.legs[1].ankle, J.legs[1].toe], W * 0.92, colors.far);
    limb([J.sh, J.arms[1].elbow, J.arms[1].hand], W * 0.8, colors.far);
    if (pat.prop === 'bells' || pat.prop === 'bell') bell(J.arms[1].hand, colors.propFar);
    // torso (curved)
    ctx.strokeStyle = colors.body; ctx.lineWidth = W * 1.65;
    const a = X(J.hip), b = X(J.neck);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const mx = (a[0] + b[0]) / 2 + (dy) * J.curve * 2.2, my = (a[1] + b[1]) / 2 - (dx) * J.curve * 2.2;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]); ctx.stroke();
    // head
    const hc = X(J.headC);
    ctx.fillStyle = colors.body; ctx.beginPath(); ctx.arc(hc[0], hc[1], L.head * s, 0, Math.PI * 2); ctx.fill();
    // near side
    limb([J.hip, J.legs[0].knee, J.legs[0].ankle, J.legs[0].toe], W, colors.near);
    limb([J.sh, J.arms[0].elbow, J.arms[0].hand], W * 0.86, colors.near);
    if (pat.prop === 'bells' || pat.prop === 'bell' || pat.bell === 'near') bell(J.arms[0].hand, colors.prop);
    function bell(q, c) {
      const p0 = X(q); ctx.fillStyle = c;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p0[0] - s * 0.07, p0[1] - s * 0.045, s * 0.14, s * 0.09, s * 0.025) : ctx.rect(p0[0] - s * 0.07, p0[1] - s * 0.045, s * 0.14, s * 0.09); ctx.fill();
    }
  }

  function pose(p, phase) { const A = poseAt(p, phase); return { A, J: fk(A) }; }
  return { draw, pick, pose, bbox, info: p => PAT[p] || PAT.stand, L, patterns: Object.keys(PAT), isHold: p => !!(PAT[p] && PAT[p].hold), hasBreath: p => !!(PAT[p] && PAT[p].breath), isSeq: p => !!(PAT[p] && PAT[p].seq) };
})();
if (typeof module !== 'undefined') module.exports = Figure;
