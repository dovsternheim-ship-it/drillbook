// ---------- Drillbook body engine: a real skeleton (MakeHuman CC0 rig) posed by joint angles, IK and contacts ----------
// World: y up, floor at y = 0, the person faces +z, their left is +x. Units are metres.
var Body = (function () {
  const D = Math.PI / 180;
  // ---- vector / quaternion helpers (quaternions are [x, y, z, w]) ----
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mirV = a => [-a[0], a[1], a[2]];
  function qm(a, b) {
    return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  }
  const qi = q => [-q[0], -q[1], -q[2], q[3]];
  const mirQ = q => [q[0], -q[1], -q[2], q[3]];
  function qv(q, v) {
    const [x, y, z, w] = q; const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  }
  function qa(ax, deg) { const h = deg * D / 2, s = Math.sin(h); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(h)]; }
  const Rx = d => qa([1, 0, 0], d), Ry = d => qa([0, 1, 0], d), Rz = d => qa([0, 0, 1], d);
  const I = [0, 0, 0, 1];
  function qMat(c0, c1, c2) { // rotation matrix columns -> quaternion
    const m00 = c0[0], m10 = c0[1], m20 = c0[2], m01 = c1[0], m11 = c1[1], m21 = c1[2], m02 = c2[0], m12 = c2[1], m22 = c2[2];
    const tr = m00 + m11 + m22; let x, y, z, w;
    if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s; }
    else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
    else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
    else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
    const l = Math.hypot(x, y, z, w); return [x / l, y / l, z / l, w / l];
  }
  // rotation taking the canonical limb frame (-y = along the limb, +x = hinge axis) to (d, n)
  function basis(d, n) {
    d = norm(d); n = norm(sub(n, mul(d, dot(d, n))));
    const y = mul(d, -1); return qMat(n, y, cross(n, y));
  }
  function slerp(a, b, t) {
    let c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; let bb = b;
    if (c < 0) { c = -c; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    let k0 = 1 - t, k1 = t;
    if (c < 0.9995) { const o = Math.acos(c), s = Math.sin(o); k0 = Math.sin((1 - t) * o) / s; k1 = Math.sin(t * o) / s; }
    const r = [a[0] * k0 + bb[0] * k1, a[1] * k0 + bb[1] * k1, a[2] * k0 + bb[2] * k1, a[3] * k0 + bb[3] * k1];
    const l = Math.hypot(...r); return r.map(x => x / l);
  }

  // ---- rig (filled by init from the decoded asset) ----
  let B = null, N = 0, ix = {}, SEG = {}, Mb = {}, samples = null, ready = false, MASS = null;
  const SIDES = ['L', 'R'];
  function init(asset) {
    B = asset.bones.map(b => ({ n: b.n, p: b.p, h: b.h, t: b.t }));
    N = B.length; ix = {}; B.forEach((b, i) => { ix[b.n] = i; b.off = b.p < 0 ? b.h : sub(b.h, B[b.p].h); });
    const H = n => B[ix[n]].h;
    for (const s of SIDES) {
      const ua = sub(H('forearm.' + s), H('upperarm.' + s)), fa = sub(H('hand.' + s), H('forearm.' + s));
      const ha = sub(B[ix['hand.' + s]].t, H('hand.' + s));
      const th = sub(H('shin.' + s), H('thigh.' + s)), sh = sub(H('foot.' + s), H('shin.' + s));
      SEG['ua' + s] = len(ua); SEG['fa' + s] = len(fa); SEG['th' + s] = len(th); SEG['sh' + s] = len(sh);
      const nArm = norm(cross(fa, ua));
      Mb['upperarm.' + s] = basis(ua, nArm); Mb['forearm.' + s] = basis(fa, nArm); Mb['hand.' + s] = basis(ha, nArm);
      Mb['thigh.' + s] = basis(th, [1, 0, 0]); Mb['shin.' + s] = basis(sh, [1, 0, 0]);
    }
    SEG.ankle = H('foot.L')[1]; SEG.toe = H('toes.L')[1];
    // mass fractions for the centre of mass (Dempster), spread over the bones
    MASS = new Float32Array(N);
    const m = { hips: .14, spine05: .07, spine04: .07, spine03: .07, spine02: .07, spine01: .07, neck: .02, head: .065 };
    for (const k in m) MASS[ix[k]] = m[k];
    for (const s of SIDES) { MASS[ix['upperarm.' + s]] = .028; MASS[ix['forearm.' + s]] = .016; MASS[ix['hand.' + s]] = .006; MASS[ix['thigh.' + s]] = .1; MASS[ix['shin.' + s]] = .0465; MASS[ix['foot.' + s]] = .0145; }
    // a sparse set of skin points for floor contact
    const step = 11, P = asset.pos, list = [];
    for (let v = 0; v < asset.n; v += step) {
      const bs = [], ws = [];
      for (let k = 0; k < 4; k++) { const w = asset.sw[v * 4 + k] / 255; if (w > 0.02) { bs.push(asset.si[v * 4 + k]); ws.push(w); } }
      list.push({ p: [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], b: bs, w: ws });
    }
    samples = list; ready = true;
  }

  // ---- pose state ----
  function newState() { return { q: Array.from({ length: N }, () => I.slice()), root: [0, 0.9, 0], W: new Array(N), X: new Array(N), scale: null }; }
  function fk(S) {
    for (let i = 0; i < N; i++) {
      const b = B[i];
      if (b.p < 0) { S.W[i] = S.q[i]; S.X[i] = S.root; }
      else { const pw = S.W[b.p]; S.W[i] = qm(pw, S.q[i]); S.X[i] = add(S.X[b.p], qv(pw, b.off)); }
    }
  }
  function tail(S, i) { const b = B[i]; return add(S.X[i], qv(S.W[i], sub(b.t, b.h))); }
  const setWorld = (S, i, Wd) => { S.q[i] = qm(qi(S.W[B[i].p]), Wd); };
  function skinPoint(S, sp) {
    let r = [0, 0, 0];
    for (let k = 0; k < sp.b.length; k++) { const i = sp.b[k]; r = add(r, mul(add(S.X[i], qv(S.W[i], sub(sp.p, B[i].h))), sp.w[k])); }
    return r;
  }
  function lowest(S, skip) {
    let m = 1e9;
    for (const sp of samples) { if (skip && skip(sp)) continue; const y = skinPoint(S, sp)[1]; if (y < m) m = y; }
    return m;
  }
  function com(S) {
    let c = [0, 0, 0], m = 0;
    for (let i = 0; i < N; i++) if (MASS[i]) { const mid = mul(add(S.X[i], tail(S, i)), 0.5); c = add(c, mul(mid, MASS[i])); m += MASS[i]; }
    return mul(c, 1 / m);
  }

  // ---- limb frames from angles (left-side convention; the right side is mirrored) ----
  // arm: e = elevation from hanging (deg), p = plane (0 forward, 90 out to the side), r = humeral rotation,
  //      el = elbow bend, pr = forearm turn, wf = wrist bend (+ = palm side), wd = wrist sideways
  function armFrames(a) {
    const A = qm(qm(Ry(a.p || 0), Rx(-(a.e || 0))), Ry(a.r || 0));
    const F = qm(qm(A, Rx(-(a.el || 0))), Ry(a.pr || 0));
    const Hh = qm(qm(F, Rx(a.wf || 0)), Rz(a.wd || 0));
    return [A, F, Hh];
  }
  // leg: f = hip flexion, a = abduction (out), r = rotation (out), k = knee bend, an = ankle (+ = toes up)
  function legFrames(l) {
    const L = qm(qm(Rx(-(l.f || 0)), Rz(l.a || 0)), Ry(l.r || 0));
    const Sx = qm(L, Rx(l.k || 0));
    return [L, Sx, qm(Sx, Rx(-(l.an || 0)))];
  }
  const sideQ = (q, s) => s === 'R' ? mirQ(q) : q;

  // full pose from parameters
  function pose(S, P) {
    for (let i = 0; i < N; i++) S.q[i] = I.slice();
    const ori = P.ori || [0, 0, 0];
    S.q[ix.hips] = qm(qm(qm(Ry(ori[0]), Rx(ori[1])), Rz(ori[2])), Ry(ori[3] || 0));
    S.root = (P.root || [0, 0.95, 0]).slice();
    const sp = P.sp || [0, 0, 0], wts = [0.24, 0.24, 0.2, 0.16, 0.16];
    ['spine05', 'spine04', 'spine03', 'spine02', 'spine01'].forEach((n, k) => { S.q[ix[n]] = qm(qm(Rx(sp[0] * wts[k]), Rz(-sp[1] * wts[k])), Ry(sp[2] * wts[k])); });
    const nk = P.nk || [0, 0, 0], hd = P.hd || [0, 0, 0];
    S.q[ix.neck] = qm(qm(Rx(nk[0]), Rz(-nk[1])), Ry(nk[2]));
    S.q[ix.head] = qm(qm(Rx(hd[0]), Rz(-hd[1])), Ry(hd[2]));
    for (const s of SIDES) {
      const a = P['a' + s] || {};
      const cl = a.cl || [0, 0];
      const qc = sideQ(qm(Rz(cl[0]), Ry(-cl[1])), s);
      S.q[ix['clavicle.' + s]] = qc;
      const [A, F, Hh] = armFrames(a);
      const Wu = qm(sideQ(A, s), qi(Mb['upperarm.' + s])), Wf = qm(sideQ(F, s), qi(Mb['forearm.' + s])), Wh = qm(sideQ(Hh, s), qi(Mb['hand.' + s]));
      S.q[ix['upperarm.' + s]] = qm(qi(qc), Wu); S.q[ix['forearm.' + s]] = qm(qi(Wu), Wf); S.q[ix['hand.' + s]] = qm(qi(Wf), Wh);
      fingers(S, s, a.g == null ? 0.25 : a.g, a.sp || 0);
      const l = P['l' + s] || {};
      const [L, Sx, Fo] = legFrames(l);
      const Wt = qm(sideQ(L, s), qi(Mb['thigh.' + s])), Ws = qm(sideQ(Sx, s), qi(Mb['shin.' + s])), Wft = qm(sideQ(Fo, s), qi(Mb['shin.' + s]));
      S.q[ix['thigh.' + s]] = Wt; S.q[ix['shin.' + s]] = qm(qi(Wt), Ws); S.q[ix['foot.' + s]] = qm(qi(Ws), Wft);
      S.q[ix['toes.' + s]] = Rx(-(l.toe || 0));
    }
    fk(S);
  }
  // finger curl: g 0 = open flat hand, 1 = fist
  function fingers(S, s, g, spread) {
    // natural cascade: the index stays straightest, the little finger curls most; a relaxed hand is never fully flat
    const fk = [0, 0, 0.82, 1.0, 1.1, 1.22], ax = handAxis(s);
    const rest = Math.max(0, Math.min(1, (g - 0.08) / 0.3)); // 0 for hands pressed flat
    for (let f = 2; f <= 5; f++) {
      const k = fk[f], gg = Math.min(1, g * k);
      S.q[ix['finger' + f + '-1.' + s]] = qa(ax, gg * 62 + rest * 4 * k);
      S.q[ix['finger' + f + '-2.' + s]] = qa(ax, gg * 86 + rest * 8 * k);
      S.q[ix['finger' + f + '-3.' + s]] = qa(ax, gg * 52 + rest * 6 * k);
    }
    S.q[ix['finger1-2.' + s]] = qa(ax, g * 22 + rest * 6);
    S.q[ix['finger1-3.' + s]] = qa(ax, g * 30 + rest * 10);
  }
  const hax = {};
  function handAxis(s) { // hinge axis of the knuckles in the bind pose
    if (hax[s]) return hax[s];
    const q = Mb['hand.' + s]; return (hax[s] = qv(q, [1, 0, 0]).map(v => -v));
  }

  // ---- two-bone IK (works in the limb's parent space, left-side convention) ----
  function twoBone(t, l1, l2, pole) {
    let d = len(t); const u = norm(t);
    d = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(l1 + l2 - 1e-4, d));
    const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), a = Math.acos(Math.max(-1, Math.min(1, ca)));
    let w = sub(pole, mul(u, dot(pole, u))); if (len(w) < 1e-6) w = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]; w = norm(w);
    const j = add(mul(u, l1 * Math.cos(a)), mul(w, l1 * Math.sin(a)));
    return { j, d1: norm(j), d2: norm(sub(mul(u, d), j)), reach: len(t) };
  }
  // put the ankle of leg s at world point T (knee toward world direction pole)
  function legIK(S, s, T, pole) {
    const hi = ix.hips, Wh = S.W[hi], th = ix['thigh.' + s];
    const toL = v => { const r = qv(qi(Wh), v); return s === 'R' ? mirV(r) : r; };
    const t = toL(sub(T, S.X[th])), pl = toL(pole);
    const r = twoBone(t, SEG['th' + s], SEG['sh' + s], pl);
    let n = cross(r.d1, r.d2); n = len(n) > 1e-3 ? norm(n) : norm(cross(pl, r.d1));
    const Wt = qm(Wh, qm(sideQ(basis(r.d1, n), s), qi(Mb['thigh.' + s])));
    const Ws = qm(Wh, qm(sideQ(basis(r.d2, n), s), qi(Mb['shin.' + s])));
    const footW = S.W[ix['foot.' + s]];
    S.q[th] = qm(qi(Wh), Wt); S.q[ix['shin.' + s]] = qm(qi(Wt), Ws); S.q[ix['foot.' + s]] = qm(qi(Ws), footW);
    fk(S);
  }
  // put the wrist of arm s at world point T (elbow toward world direction pole)
  function armIK(S, s, T, pole, Wh) {
    const ci = ix.spine01, Wc = S.W[ci], ua = ix['upperarm.' + s], hi = ix['hand.' + s], fi = ix['forearm.' + s];
    const toL = v => { const r = qv(qi(Wc), v); return s === 'R' ? mirV(r) : r; };
    const t = toL(sub(T, S.X[ua])), pl = toL(pole);
    const r = twoBone(t, SEG['ua' + s], SEG['fa' + s], pl);
    let n = cross(r.d2, r.d1); n = len(n) > 1e-3 ? norm(n) : norm(cross(r.d1, pl));
    const relH = qm(qi(S.W[fi]), S.W[hi]);
    const Wu = qm(Wc, qm(sideQ(basis(r.d1, n), s), qi(Mb['upperarm.' + s])));
    let Wf = qm(Wc, qm(sideQ(basis(r.d2, n), s), qi(Mb['forearm.' + s])));
    let handW;
    if (Wh) { handW = Wh; Wf = twistFollow(Wf, handW, Mb['forearm.' + s], Mb['hand.' + s]); }
    else handW = qm(Wf, relH);
    S.q[ua] = qm(qi(S.W[ix['clavicle.' + s]]), Wu); S.q[fi] = qm(qi(Wu), Wf); S.q[hi] = qm(qi(Wf), handW);
    fk(S);
  }
  function twistFollow(Wf, handW, Mf, Mh) {
    const along = norm(qv(Wf, qv(Mf, [0, -1, 0])));
    const refF = qv(Wf, qv(Mf, [1, 0, 0])), refH = qv(handW, qv(Mh, [1, 0, 0]));
    const pF = norm(sub(refF, mul(along, dot(refF, along)))), pH = sub(refH, mul(along, dot(refH, along)));
    if (len(pH) < 1e-3) return Wf;
    const ph = norm(pH);
    let ang = Math.atan2(dot(cross(pF, ph), along), dot(pF, ph)) / D;
    ang = Math.max(-80, Math.min(80, ang)) * 0.85;
    return qm(qa(along, ang), Wf);
  }

  return { handBasis: s => Mb['hand.' + s], init, get ready() { return ready; }, newState, pose, fk, legIK, armIK, tail, com, lowest, skinPoint, ix: () => ix, bones: () => B, SEG,
    v: { add, sub, mul, dot, cross, len, norm, mirV }, q: { qm, qi, qv, qa, Rx, Ry, Rz, basis, slerp, mirQ, I } };
})();
