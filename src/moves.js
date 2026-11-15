// ---------- Drillbook movement library: every exercise as timed key poses + contacts, solved on the real skeleton ----------
// Pose parameters (degrees, metres):
//   root [x,y,z] hip centre, ori [yaw, pitch(+ = lean forward / face down, -90 = lying on back), roll]
//   sp/nk/hd [flex(+ forward), side bend(+ to the left), twist(+ to the left)] for spine / neck / head
//   aL/aR arm {e elevation from hanging, p plane (0 front, 90 side), r turn, el elbow, pr forearm turn, wf wrist, g grip, cl [shrug, reach]}
//   lL/lR leg {f hip flex, a abduction, r turn out, k knee, an ankle (+ toes up), toe}
// Keys: {p: pose, t: seconds to arrive, h: seconds to hold, air: jump arc on the way in}
var Moves = (function () {
  const { add, sub, mul, dot, len, norm, mirV } = Body.v;
  const { qm, qi, qv, Ry, basis, slerp, mirQ } = Body.q;
  const clone = o => JSON.parse(JSON.stringify(o));
  function merge(a, b) {
    const r = clone(a || {});
    for (const k in b) {
      const x = b[k];
      if (x && typeof x === 'object' && !Array.isArray(x) && r[k] && typeof r[k] === 'object' && !Array.isArray(r[k])) r[k] = merge(r[k], x);
      else r[k] = clone(x);
    }
    return r;
  }
  function lerpP(a, b, t) {
    if (typeof a === 'number') return a + ((typeof b === 'number' ? b : a) - a) * t;
    if (Array.isArray(a)) return a.map((x, i) => lerpP(x, b ? b[i] : x, t));
    if (a && typeof a === 'object') { const r = {}; for (const k of new Set(Object.keys(a).concat(Object.keys(b || {})))) r[k] = k in a ? lerpP(a[k], b && k in b ? b[k] : a[k], t) : b[k]; return r; }
    return t < 0.5 ? a : (b === undefined ? a : b);
  }
  const mj = t => t * t * t * (10 - 15 * t + 6 * t * t);   // minimum-jerk: how people move between two positions
  const EASE = { mj, lin: t => t, sine: t => 0.5 - 0.5 * Math.cos(Math.PI * t), out: t => 1 - (1 - t) * (1 - t) * (1 - t), in: t => t * t * t };

  // ---------- base poses ----------
  const ARM0 = { e: 1, p: 80, r: 0, el: 12, pr: -70, wf: 0, wd: 0, g: 0.3, cl: [0, 0] };
  const LEG0 = { f: 0, a: 3, r: 6, k: 3, an: 0, toe: 0 };
  const STAND = { root: [0, 0.95, 0], ori: [0, 0, 0, 0], sp: [0, 0, 0], nk: [0, 0, 0], hd: [0, 0, 0], aL: ARM0, aR: ARM0, lL: LEG0, lR: LEG0, cw: {} };
  const P = over => merge(STAND, over || {});
  const sides = (o) => ({ aL: o, aR: o });
  const legs = (o) => ({ lL: o, lR: o });
  // lying on the back, knees bent, feet flat
  const SUP = P({ root: [0, 0.12, 0], ori: [0, -90, 0], hd: [6, 0, 0], aL: { e: 8, p: 60, el: 8, g: 0.2 }, aR: { e: 8, p: 60, el: 8, g: 0.2 }, lL: { f: 48, a: 5, k: 100, an: 0, r: 0 }, lR: { f: 48, a: 5, k: 100, an: 0, r: 0 } });
  const SUPFLAT = P({ root: [0, 0.12, 0], ori: [0, -90, 0], hd: [4, 0, 0], aL: { e: 10, p: 60, el: 6, g: 0.2 }, aR: { e: 10, p: 60, el: 6, g: 0.2 }, lL: { f: 0, a: 4, k: 4, an: -30, r: 10 }, lR: { f: 0, a: 4, k: 4, an: -30, r: 10 } });
  // hands and knees (thighs and arms vertical, tops of the feet on the floor)
  const QUAD = P({ root: [0, 0.6, 0], ori: [0, 84, 0], sp: [0, 0, 0], nk: [-10, 0, 0], hd: [-10, 0, 0],
    aL: { e: 84, p: 6, el: 0, g: 0 }, aR: { e: 84, p: 6, el: 0, g: 0 }, lL: { f: 84, a: 4, k: 90, an: -82, r: 0 }, lR: { f: 84, a: 4, k: 90, an: -82, r: 0 } });
  // face down plank line on straight arms (feet on toes)
  const PLANK = P({ root: [0, 0.7, 0], ori: [0, 76, 0], nk: [-10, 0, 0], hd: [-6, 0, 0], aL: { e: 76, p: 10, el: 0, g: 0 }, aR: { e: 76, p: 10, el: 0, g: 0 }, lL: { f: 0, a: 2, k: 0, an: -20, toe: 55 }, lR: { f: 0, a: 2, k: 0, an: -20, toe: 55 }, cw: { hL: 1, hR: 1 } });

  // ---------- the library ----------
  const L = {};
  function def(id, o) { L[id] = o; }
  const DB = (side) => ({ k: 'db' + side, at: 'hand' + side });

  // ---- breathing / mobility on the floor ----
  def('breathe', { label: 'Belly breathing', view: { yaw: 70, pitch: 22 }, anchor: 'ground', hold: true, breath: true,
    contacts: { fL: 'flat', fR: 'flat', hL: { to: 'spine03', at: [0.06, 0.0, 0.12] }, hR: { to: 'spine01', at: [-0.05, 0.05, 0.13] } },
    keys: [{ p: merge(SUP, { sp: [0, 0, 0] }), t: 6, h: 0 }, { p: merge(SUP, { sp: [-3, 0, 0], belly: 1 }), t: 4, h: 0 }] });
  def('catcow', { label: 'Cat-cow', view: { yaw: 80, pitch: 12 }, anchor: 'ground', pin: ['shin.L', 'shin.R'], contacts: { hL: 'palm', hR: 'palm' }, groundSkip: 'arms',
    keys: [
      { p: QUAD, t: 1.6, h: 0.3 },
      { p: merge(QUAD, { ori: [0, 72, 0], sp: [42, 0, 0], nk: [20, 0, 0], hd: [18, 0, 0], lL: { f: 72 }, lR: { f: 72 } }), t: 2.4, h: 1 },
      { p: QUAD, t: 2, h: 0.3 },
      { p: merge(QUAD, { ori: [0, 100, 0], sp: [-26, 0, 0], nk: [-24, 0, 0], hd: [-16, 0, 0], lL: { f: 100 }, lR: { f: 100 } }), t: 2.4, h: 1 }] });
  // child's pose: hips on heels, chest on thighs, arms long on the floor, forehead down
  const CHILD = P({ root: [0, 0.32, 0], ori: [0, 75, 0], sp: [42, 0, 0], nk: [12, 0, 0], hd: [8, 0, 0],
    aL: { e: 172, p: 12, el: 6, g: 0 }, aR: { e: 172, p: 12, el: 6, g: 0 }, lL: { f: 141, a: 24, r: -8, k: 158, an: -86 }, lR: { f: 141, a: 24, r: -8, k: 158, an: -86 } });
  def('childpose', { label: "Child's pose", view: { yaw: 70, pitch: 16 }, anchor: 'ground', hold: true, breath: true, contacts: { hL: 'palm', hR: 'palm' }, groundSkip: 'arms',
    keys: [{ p: CHILD, t: 4, h: 0 }, { p: merge(CHILD, { sp: [46, 0, 0] }), t: 4, h: 0 }] });

  // ---------- engine ----------
  const cache = {};
  function prepared(id) {
    if (cache[id]) return cache[id];
    const m = L[id] || L.stand;
    const keys = m.keys.map(k => ({ p: merge(STAND, k.p), t: k.t, h: k.h || 0, air: k.air, ease: k.ease }));
    let tot = 0; for (const k of keys) tot += k.t + k.h;
    return (cache[id] = { m, keys, cycle: tot, refs: {} });
  }
  function paramsAt(pr, time) {
    const ks = pr.keys, n = ks.length;
    let t = ((time % pr.cycle) + pr.cycle) % pr.cycle;
    for (let i = 0; i < n; i++) {
      const k = ks[i], a = ks[(i - 1 + n) % n];
      if (t < k.t) {
        const u = t / k.t, e = (EASE[k.ease] || mj)(u);
        const P1 = lerpP(a.p, k.p, e);
        if (k.air) { const T = k.t, tau = t; P1.lift = 4.905 * tau * (T - tau) * (k.air === true ? 1 : k.air); }
        return P1;
      }
      t -= k.t;
      if (t < k.h) return clone(k.p);
      t -= k.h;
    }
    return clone(ks[0].p);
  }
  function mirrorP(P) {
    const R = clone(P);
    R.root[0] = -R.root[0]; R.ori[0] = -R.ori[0]; R.ori[2] = -R.ori[2]; if (R.ori[3]) R.ori[3] = -R.ori[3];
    for (const k of ['sp', 'nk', 'hd']) { R[k][1] = -R[k][1]; R[k][2] = -R[k][2]; }
    [R.aL, R.aR] = [P.aR, P.aL].map(clone); [R.lL, R.lR] = [P.lR, P.lL].map(clone);
    const cw = {}; for (const k in P.cw || {}) cw[k.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R')] = P.cw[k]; R.cw = cw;
    return R;
  }
  function mirrorContacts(c) {
    const r = {};
    for (const k in c || {}) {
      const nk = k.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R');
      let v = clone(c[k]);
      if (v && typeof v === 'object') {
        if (v.under) v.under = v.under.replace(/\.L$/, '.#').replace(/\.R$/, '.L').replace(/\.#$/, '.R');
        if (v.to) v.to = v.to.replace(/\.L$/, '.#').replace(/\.R$/, '.L').replace(/\.#$/, '.R');
        for (const k of ['at', 'palm', 'fing']) if (v[k]) v[k] = mirV(v[k]);
        if (v.pole) v.pole = mirV(v.pole);
        if (v.pos) v.pos = mirV(v.pos);
      }
      r[nk] = v;
    }
    return r;
  }

  const IX = () => Body.ix();
  const ctype = v => typeof v === 'string' ? v : v ? (v.type || (v.to ? 'to' : null)) : null;
  const heading = (S) => { const f = qv(S.W[IX().hips], [0, 0, 1]); const g = qv(S.W[IX().hips], [0, 1, 0]); const h = [f[0] + g[0] * 0.0, 0, f[2]]; return len(h) > 0.2 ? norm(h) : norm([g[0], 0, g[2]]); };
  function armBones(s) { const ix = IX(); return ['upperarm', 'forearm', 'hand'].map(n => ix[n + '.' + s]); }
  function legBones(s) { const ix = IX(); return ['thigh', 'shin', 'foot', 'toes'].map(n => ix[n + '.' + s]); }
  function skipFn(m) {
    if (!m.groundSkip) return null;
    const ix = IX(); const set = new Set();
    for (const s of ['L', 'R']) { for (const n of ['upperarm', 'forearm', 'hand']) set.add(ix[n + '.' + s]); for (let f = 1; f <= 5; f++) for (let k = 1; k <= 3; k++) set.add(ix['finger' + f + '-' + k + '.' + s]); }
    return sp => set.has(sp.b[0]);
  }
  function footFlat(S, s, head) { // set the foot (and toes) flat on the floor, heading `head`
    const ix = IX(), fi = ix['foot.' + s], ti = ix['toes.' + s];
    const yaw = Math.atan2(head[0], head[2]) * 180 / Math.PI;
    const Wf = Ry(yaw + (s === 'L' ? 4 : -4));
    S.q[fi] = qm(qi(S.W[ix['shin.' + s]]), Wf); Body.fk(S);
    S.q[ti] = qm(qi(S.W[fi]), Wf); Body.fk(S);
  }
  function toesFlat(S, s, head) {
    const ix = IX(), ti = ix['toes.' + s];
    const yaw = Math.atan2(head[0], head[2]) * 180 / Math.PI;
    S.q[ti] = qm(qi(S.W[ix['foot.' + s]]), Ry(yaw)); Body.fk(S);
  }
  function handFlat(S, s, head, rot) { // palm down, fingers along heading turned by rot degrees (outward)
    const ix = IX(), hi = ix['hand.' + s];
    const yaw = Math.atan2(head[0], head[2]) + (s === 'L' ? 1 : -1) * (rot || 0) * Math.PI / 180;
    const f = [Math.sin(yaw), -0.08, Math.cos(yaw)];
    const Mh = Body.handBasis(s);
    const C = basis(f, s === 'L' ? [0, 1, 0] : [0, -1, 0]);
    return qm(C, qi(Mh));
  }
  function handFlatTarget(S, s, W) { // wrist position so that the palm rests at the floor height under it
    return W;
  }
  function anchorFeet(S, m, ref, cw) {
    const ix = IX(); let a = [0, 0, 0], n = 0;
    for (const s of ['L', 'R']) {
      const c = m.contacts && m.contacts['f' + s], t = ctype(c);
      if (!t || (c && c.noAnchor)) continue;
      const w = cw && cw['f' + s] != null ? cw['f' + s] : 1; if (w <= 0) continue;
      if (t === 'flat') { a = add(a, mul(sub(ref['f' + s], S.X[ix['foot.' + s]]), w)); n += w; }
      else if (t === 'ball' && !m.anchorFlatOnly) { a = add(a, mul(sub(ref['f' + s], S.X[ix['toes.' + s]]), w)); n += w; }
    }
    if (!n) return;
    a = mul(a, 1 / n); S.root = add(S.root, a); Body.fk(S);
  }
  function anchorGround(S, m) {
    const an = m.anchor;
    let y0 = 0, skip = skipFn(m);
    if (typeof an === 'object' && an.bones) { const ix = IX(); const set = new Set(an.bones.map(b => ix[b])); skip = sp => !set.has(sp.b[0]); y0 = an.y || 0; }
    const low = Body.lowest(S, skip);
    S.root = add(S.root, [0, y0 - low, 0]); Body.fk(S);
  }
  // evaluate a pose with anchoring but no contacts (used for reference positions)
  function base(S, m, P) {
    Body.pose(S, P);
    if (m.anchor === 'ground' || (m.anchor && m.anchor.bones)) anchorGround(S, m);
  }
  function refsFor(pr, side) {
    if (pr.refs[side]) return pr.refs[side];
    const m = side === 'R' ? Object.assign({}, pr.m, { contacts: mirrorContacts(pr.m.contacts) }) : pr.m;
    const S = Body.newState(); const k = pr.keys[pr.m.ref || 0];
    const kp = pr.m.refP || k.p;
    const P = side === 'R' ? mirrorP(kp) : kp;
    base(S, m, P);
    const ix = IX(), r = {}, hd = heading(S);
    for (const c in m.contacts || {}) {
      const v = m.contacts[c], s = c.slice(-1);
      const t = ctype(v), y0 = (v && v.y) || 0, pos = v && v.pos;
      if (t === 'flat') { const p = pos || S.X[ix['foot.' + s]]; r[c] = [p[0], y0 + Body.SEG.ankle, p[2]]; }
      else if (t === 'ball') { const p = pos || S.X[ix['toes.' + s]]; r[c] = [p[0], y0 + Body.SEG.toe, p[2]]; }
      else if (t === 'palm') {
        let p = pos || S.X[ix['hand.' + s]];
        if (v && v.under) { const u = S.X[ix[v.under.replace('#', s)]]; p = add(u, mul(hd, v.fwd || 0)); if (v.out) p = add(p, [(s === 'L' ? 1 : -1) * v.out, 0, 0]); }
        r[c] = [p[0], y0 + 0.03, p[2]];
      }
    }
    r.head = hd;
    if (m.pin) { const ps = [].concat(m.pin).map(b => S.X[ix[side === 'R' ? b.replace(/\.L$/, '.#').replace(/\.R$/, '.L').replace(/\.#$/, '.R') : b]]); r.pin = mul(ps.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / ps.length); r.pinB = [].concat(m.pin).map(b => side === 'R' ? b.replace(/\.L$/, '.#').replace(/\.R$/, '.L').replace(/\.#$/, '.R') : b); }
    return (pr.refs[side] = { r, m });
  }

  function sample(id, time, opts) {
    opts = opts || {};
    const pr = prepared(id), side = opts.side === 'R' ? 'R' : 'L';
    let P = paramsAt(pr, time);
    if (side === 'R') P = mirrorP(P);
    const { r: ref, m } = refsFor(pr, side);
    // breathing and a little life
    const bt = time / 4.2 * Math.PI * 2;
    const br = (pr.m.breath ? 0 : 0.5 + 0.5 * Math.sin(bt));
    P.sp[0] -= br * 1.2; for (const s of ['aL', 'aR']) { P[s].cl = P[s].cl || [0, 0]; P[s].cl[0] += br * 1.2; }
    if (pr.m.hold) { P.ori[2] += 0.4 * Math.sin(time * 0.9); P.hd[0] += 0.8 * Math.sin(time * 0.6); }
    const S = opts.state || Body.newState();
    Body.pose(S, P);
    const ix = IX();
    if (m.anchor === 'feet') {
      anchorFeet(S, m, ref, P.cw);
      if (m.balance) for (let it = 0; it < 3; it++) {
        const c = Body.com(S), hd = heading(S);
        let base = [0, 0, 0], n = 0; for (const s of ['L', 'R']) if (ctype(m.contacts['f' + s]) === 'flat') { base = add(base, ref['f' + s]); n++; }
        base = add(mul(base, 1 / n), mul(hd, 0.045));
        const err = dot(sub(c, base), hd); const hgt = c[1] - Body.SEG.ankle;
        P.ori[1] -= Math.atan2(err, hgt) * 180 / Math.PI;
        Body.pose(S, P); anchorFeet(S, m, ref, P.cw);
      }
    } else if (m.anchor === 'ground' || (m.anchor && m.anchor.bones)) anchorGround(S, m);
    if (P.lift) { S.root = add(S.root, [0, P.lift, 0]); Body.fk(S); }
    if (ref.pin) { const ps = ref.pinB.map(b => S.X[ix[b]]); const c = mul(ps.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / ps.length); S.root = add(S.root, [ref.pin[0] - c[0], 0, ref.pin[2] - c[2]]); Body.fk(S); }
    // contacts
    const hd = ref.head;
    const cw = P.cw || {};
    for (const c in m.contacts || {}) {
      const v = m.contacts[c], s = c.slice(-1), w = cw[c] == null ? 1 : cw[c];
      if (w <= 0.001) continue;
      const before = c[0] === 'h' ? armBones(s).map(i => S.q[i].slice()) : legBones(s).map(i => S.q[i].slice());
      if (c[0] === 'f') {
        const t = ctype(v);
        if (t === 'flat') { Body.legIK(S, s, ref[c], v.pole ? rotY(v.pole, hd) : kneePole(S, s, P)); footFlat(S, s, hd); }
        else if (t === 'ball') {
          for (let it = 0; it < 2; it++) { const off = sub(S.X[ix['toes.' + s]], S.X[ix['foot.' + s]]); Body.legIK(S, s, sub(ref[c], off), kneePole(S, s, P)); }
          toesFlat(S, s, hd);
        } else if (v && v.to) {
          const b = ix[v.to]; const T = add(S.X[b], qv(S.W[b], v.at || [0, 0, 0]));
          Body.legIK(S, s, T, v.pole ? rotY(v.pole, hd) : kneePole(S, s, P));
        }
      } else {
        let T = null, Wh = null, pole = v && v.pole ? rotY(v.pole, hd) : rotY(s === 'L' ? [0.5, -0.1, -1] : [-0.5, -0.1, -1], hd);
        if (ctype(v) === 'palm') { Wh = handFlat(S, s, hd, v && v.rot != null ? v.rot : 12); T = ref[c]; }
        else if (v && v.to) {
          const b = ix[v.to]; T = add(S.X[b], qv(S.W[b], v.at || [0, 0, 0]));
          if (v.palm) { const d = qv(S.W[b], v.palm), f = qv(S.W[b], v.fing || [0, 1, 0]); Wh = qm(basis(f, s === 'L' ? mul(d, -1) : d), qi(Body.handBasis(s))); }
        }
        if (T) Body.armIK(S, s, T, pole, Wh);
      }
      if (w < 0.999) {
        const ids = c[0] === 'h' ? armBones(s) : legBones(s);
        ids.forEach((i, k) => { S.q[i] = slerp(before[k], S.q[i], w); });
        Body.fk(S);
      }
    }
    // free feet never sink into the floor: lift the leg just enough (keeps the knee direction)
    if (!P.lift) for (const s of ['L', 'R']) {
      const c = 'f' + s, w = cw[c] == null ? 1 : cw[c];
      if (m.contacts && m.contacts[c] && w > 0.5) continue;
      const toe = Body.tail(S, ix['toes.' + s]), ft = S.X[ix['foot.' + s]];
      const low = Math.min(toe[1] - Body.SEG.toe, ft[1] - Body.SEG.ankle);
      if (low < 0) { Body.legIK(S, s, add(ft, [0, -low, 0]), kneePole(S, s, P)); }
    }
    S.P = P;
    return S;
  }
  const rotY = (v, hd) => { const c = hd[2], s = hd[0]; return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
  function kneePole(S, s, P) { // knees point where the thigh points, a little out
    const ix = IX(); const k = S.X[ix['shin.' + s]], h = S.X[ix['thigh.' + s]], a = S.X[ix['foot.' + s]];
    const mid = mul(add(h, a), 0.5); let d = sub(k, mid);
    if (len(d) < 0.02) { const hd = heading(S); d = add(hd, [0, 0, 0]); }
    return norm(d);
  }

  // camera framing: bounding box of the move over its cycle (cached)
  const frames = {};
  function frame(id, side) {
    const key = id + (side || '');
    if (frames[key]) return frames[key];
    const pr = prepared(id); let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    const S = Body.newState(); const n = 10;
    const ix = IX(); const pts = ['head', 'hand.L', 'hand.R', 'foot.L', 'foot.R', 'toes.L', 'toes.R', 'hips', 'spine01', 'shin.L', 'shin.R', 'forearm.L', 'forearm.R'].map(k => ix[k]);
    for (let i = 0; i < n; i++) {
      sample(id, pr.cycle * i / n, { side, state: S });
      for (const b of pts) { for (const p of [S.X[b], Body.tail(S, b)]) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
    }
    lo = add(lo, [-0.09, -0.02, -0.09]); hi = add(hi, [0.09, 0.14, 0.09]); lo[1] = Math.min(lo[1], 0);
    return (frames[key] = { lo, hi, c: mul(add(lo, hi), 0.5) });
  }
  function info(id) {
    const m = L[id] || L.stand, pr = prepared(id); let ta = 0; const tk = m.thumb != null ? m.thumb : (pr.keys.length > 1 ? 1 : 0);
    for (let i = 0; i <= tk; i++) ta += pr.keys[i].t; ta += Math.min(0.1, pr.keys[tk].h / 2);
    return { thumbAt: (ta % pr.cycle) / pr.cycle, id, label: m.label || id, hold: !!m.hold, breath: !!m.breath, view: m.view || { yaw: 55, pitch: 10 }, props: m.props || [], cycle: prepared(id).cycle, alt: !!m.alt, perSide: !!m.perSide }; }
  return { L, def, sample, frame, info, cycle: id => prepared(id).cycle, get ids() { return Object.keys(L); }, P, STAND, SUP, SUPFLAT, QUAD, PLANK, merge, mirrorP, _cache: cache };
})();
