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
    samples = list;
    buildVolumes(asset);
    ready = true;
  }

  // ---- body volumes for collision: each torso/limb bone gets an elliptical capsule fitted to its skin ----
  let VOL = [];
  const TORSO = ['hips', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck', 'head'];
  function pct(a, q) { if (!a.length) return 0; const b = Float64Array.from(a).sort(); return b[Math.min(b.length - 1, Math.floor(q * (b.length - 1)))]; }
  function buildVolumes(asset) {
    const names = TORSO.slice();
    for (const s of SIDES) names.push('upperarm.' + s, 'forearm.' + s, 'thigh.' + s, 'shin.' + s);
    const P = asset.pos, byB = {};
    names.forEach(n => byB[ix[n]] = []);
    // limbs: vertices mostly driven by the bone; torso and head: every trunk vertex, split by height (the bind pose stands upright)
    const limbSet = new Set(); for (const s of SIDES) for (const n of ['upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'toes', 'clavicle']) limbSet.add(ix[n + '.' + s]);
    for (const s of SIDES) for (let f = 1; f <= 5; f++) for (let k = 1; k <= 3; k++) limbSet.add(ix['finger' + f + '-' + k + '.' + s]);
    const tb = TORSO.map(n => ix[n]), crotch = B[ix['thigh.L']].h[1] - 0.08;
    for (let v = 0; v < asset.n; v++) {
      let lw = 0, dom = -1, dw = 0;
      for (let k = 0; k < 4; k++) { const b = asset.si[v * 4 + k], w = asset.sw[v * 4 + k] / 255; if (limbSet.has(b)) lw += w; if (w > dw) { dw = w; dom = b; } }
      if (lw < 0.35) {
        const y = P[v * 3 + 1]; if (y < crotch) continue;
        let bi = tb[tb.length - 1];
        for (const i of tb) { const b = B[i], lo = i === ix.hips ? crotch : b.h[1], hi = Math.max(b.h[1], b.t[1]); if (y >= lo && y < hi) { bi = i; break; } }
        byB[bi].push(v);
      } else for (let k = 0; k < 4; k++) { const b = asset.si[v * 4 + k], w = asset.sw[v * 4 + k] / 255; if (w > 0.55 && byB[b] && limbSet.has(b)) byB[b].push(v); }
    }
    VOL = names.map(n => {
      const i = ix[n], b = B[i], a = sub(b.t, b.h), L2 = dot(a, a), xs = [], zs = [], rs = [], ss = [];
      for (const v of byB[i]) {
        const d = sub([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], b.h), t = Math.max(0, Math.min(1, dot(d, a) / L2));
        const r = sub(d, mul(a, t)); xs.push(r[0]); zs.push(r[2]); rs.push(len(r)); ss.push(dot(d, a) / L2);
      }
      const torso = TORSO.includes(n);
      if (torso) {
        const x0 = pct(xs, 0.03), x1 = pct(xs, 0.97), z0 = pct(zs, 0.03), z1 = pct(zs, 0.97);
        return { i, n, torso, a, L2, c: [(x0 + x1) / 2, 0, (z0 + z1) / 2], rx: (x1 - x0) / 2, rz: (z1 - z0) / 2, s0: Math.min(0, pct(ss, 0.02)), s1: Math.max(1, pct(ss, 0.98)) };
      }
      const r = pct(rs, 0.7);
      return { i, n, torso, a, L2, c: [0, 0, 0], rx: r, rz: r, s0: 0, s1: 1 };
    });
    // the pelvis bone is short and its sides belong to the thighs: give it the lower trunk's girth
    const hv = VOL.find(v => v.n === 'hips'), s5 = VOL.find(v => v.n === 'spine05');
    hv.rx = Math.max(hv.rx, s5.rx); hv.rz = Math.max(hv.rz, s5.rz); hv.c = [0, 0, s5.c[2]]; hv.s0 = Math.max(hv.s0, -0.3); hv.s1 = Math.min(hv.s1, 1.5);
  }
  // how deep world point p (with its own radius pr) sits inside volume V; returns {d: depth (m), n: push direction}
  function inside(S, V, p, pr) {
    const v = qv(qi(S.W[V.i]), sub(p, S.X[V.i]));
    const t = dot(v, V.a) / V.L2, tc = Math.max(V.s0, Math.min(V.s1, t));
    const r = sub(sub(v, mul(V.a, tc)), V.c);
    // radial (elliptical) part
    const rx = V.rx + pr, rz = V.rz + pr;
    const e = Math.sqrt((r[0] / rx) ** 2 + (r[2] / rz) ** 2 + (V.torso ? 0 : (r[1] / rx) ** 2));
    const over = (t - tc) * Math.sqrt(V.L2) / rx; // past the end caps
    const q = Math.sqrt(e * e + over * over);
    if (q >= 1) return null;
    // push direction: out radially (and along the axis past the caps), in world space
    let dirL = q > 1e-4 ? [r[0] / (rx * rx), V.torso ? 0 : r[1] / (rx * rx), r[2] / (rz * rz)] : [V.c[0] >= 0 ? 1 : -1, 0, 0];
    if (over) dirL = add(dirL, mul(norm(V.a), over / rx));
    const dl = norm(dirL);
    const depth = (1 - q) * Math.min(rx, rz);
    return { d: depth, n: qv(S.W[V.i], dl) };
  }
  // a point on the skin of bone n: u degrees around (0 front, 90 left, 180 back), t along the bone (0 head .. 1 tail)
  function surface(S, n, u, t) {
    const V = VOL.find(v => v.n === n); if (!V) return null;
    const a = u * D, ex = Math.sin(a), ez = Math.cos(a);
    const local = add(add(mul(V.a, t), V.c), [ex * V.rx, 0, ez * V.rz]);
    const nl = norm([ex / V.rx, 0, ez / V.rz]);
    return { p: add(S.X[V.i], qv(S.W[V.i], local)), n: qv(S.W[V.i], nl) };
  }
  // the deepest penetration of point p into any body volume, skipping volumes listed in skip
  function probe(S, p, pr, skip) {
    let best = null;
    for (const V of VOL) { if (skip && skip.has(V.i)) continue; const h = inside(S, V, p, pr); if (h && (!best || h.d > best.d)) best = h; }
    return best;
  }
  // points along an arm / leg that must stay outside the rest of the body
  function limbPoints(S, s, arm) {
    const pts = [];
    if (arm) {
      const e = S.X[ix['forearm.' + s]], w = S.X[ix['hand.' + s]], h = tail(S, ix['hand.' + s]);
      pts.push({ p: e, r: 0.04, k: 'elbow' });
      for (const t of [0.33, 0.66]) pts.push({ p: add(e, mul(sub(w, e), t)), r: 0.035, k: 'fore', t });
      pts.push({ p: w, r: 0.03, k: 'wrist' }, { p: h, r: 0.028, k: 'hand' });
      pts.push({ p: tail(S, ix['finger3-3.' + s]), r: 0.012, k: 'finger' }, { p: tail(S, ix['finger1-3.' + s]), r: 0.012, k: 'finger' });
    } else {
      const k = S.X[ix['shin.' + s]], a = S.X[ix['foot.' + s]], t = tail(S, ix['toes.' + s]);
      pts.push({ p: k, r: 0.05, k: 'knee' }, { p: add(k, mul(sub(a, k), 0.5)), r: 0.045, k: 'shin' }, { p: a, r: 0.045, k: 'ankle' }, { p: t, r: 0.035, k: 'toe' });
    }
    return pts;
  }
  function skipFor(s, arm) {
    const o = s === 'L' ? 'R' : 'L', sk = new Set();
    if (arm) { sk.add(ix['upperarm.' + s]); sk.add(ix['forearm.' + s]); }
    else { sk.add(ix['thigh.' + s]); sk.add(ix['shin.' + s]); sk.add(ix.hips); }
    return sk;
  }
  // measure: deepest penetration of each limb (used by tests)
  function penetration(S) {
    const out = {};
    for (const s of SIDES) for (const arm of [true, false]) {
      const sk = skipFor(s, arm); let worst = null;
      for (const pt of limbPoints(S, s, arm)) { const h = probe(S, pt.p, pt.r, sk); if (h && (!worst || h.d > worst.d)) worst = Object.assign({ k: pt.k }, h); }
      out[(arm ? 'a' : 'l') + s] = worst;
    }
    return out;
  }
  // resolve: move a free hand / foot (and the elbow / knee) out of the body, keeping the limb's own IK
  function resolve(S, lock) {
    for (const s of SIDES) {
      if (!(lock && lock['h' + s])) resolveArm(S, s);
      if (!(lock && lock['f' + s])) resolveLeg(S, s);
    }
  }
  function resolveArm(S, s) {
    const sk = skipFor(s, true), ua = ix['upperarm.' + s], fi = ix['forearm.' + s], hi = ix['hand.' + s];
    for (let it = 0; it < 4; it++) {
      let worst = null;
      for (const pt of limbPoints(S, s, true)) { const h = probe(S, pt.p, pt.r, sk); if (h && (!worst || h.d > worst.d)) worst = Object.assign({ pt }, h); }
      if (!worst || worst.d < 0.004) return;
      const sh = S.X[ua], el = S.X[fi], wr = S.X[hi], handW = S.W[hi];
      const push = mul(worst.n, worst.d + 0.008);
      let T = wr, pole = norm(sub(el, add(sh, mul(sub(wr, sh), 0.5))));
      if (worst.pt.k === 'elbow') pole = norm(add(pole, mul(worst.n, 2)));
      else if (worst.pt.k === 'fore') { T = add(wr, mul(push, worst.pt.t)); pole = norm(add(pole, mul(worst.n, 1 - worst.pt.t))); }
      else T = add(wr, push);
      armIK(S, s, T, pole, handW);
    }
  }
  function resolveLeg(S, s) {
    const sk = skipFor(s, false), fi = ix['foot.' + s], th = ix['thigh.' + s], sn = ix['shin.' + s];
    for (let it = 0; it < 3; it++) {
      let worst = null;
      for (const pt of limbPoints(S, s, false)) { const h = probe(S, pt.p, pt.r, sk); if (h && (!worst || h.d > worst.d)) worst = Object.assign({ pt }, h); }
      if (!worst || worst.d < 0.005) return;
      const hp = S.X[th], kn = S.X[sn], an = S.X[fi], footW = S.W[fi];
      let pole = norm(sub(kn, add(hp, mul(sub(an, hp), 0.5))));
      let T = an;
      if (worst.pt.k === 'knee') pole = norm(add(pole, mul(worst.n, 2)));
      else T = add(an, mul(worst.n, worst.d + 0.01));
      legIK(S, s, T, pole);
      // keep the foot's world orientation
      S.q[fi] = qm(qi(S.W[sn]), footW); fk(S);
    }
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
    // a flat hand tucks the thumb up into the palm's plane (otherwise it would hang below the palm)
    const hb = B[ix['hand.' + s]], along = norm(sub(hb.t, hb.h));
    S.q[ix['finger1-1.' + s]] = qa(along, -36 * (1 - rest));
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

  return { surface, _samples: () => samples, penetration, resolve, volumes: () => VOL, handBasis: s => Mb['hand.' + s], init, get ready() { return ready; }, newState, pose, fk, legIK, armIK, tail, com, lowest, skinPoint, ix: () => ix, bones: () => B, SEG,
    v: { add, sub, mul, dot, cross, len, norm, mirV }, q: { qm, qi, qv, qa, Rx, Ry, Rz, basis, slerp, mirQ, I } };
})();
