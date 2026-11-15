// ---------- Drillbook coach: picks the movement for an exercise and shows it (3D, or a simple 2D drawing without WebGL) ----------
var Coach = (function () {
  // exercise name -> movement (first match wins; more specific first)
  const KEYS = [
    ['breathe', /belly breath|diaphragm|breathing|box breath|crocodile breath/], ['catcow', /cat[\s-]?cow|cat[\s-]camel|\bcat\b|\bcow\b/],
    ['childpose', /child'?s?\s*pose|balasana|prayer stretch|extended child/], ['figure4', /figure[\s-]?(4|four)|piriformis|pigeon|glute stretch/],
    ['happybaby', /happy\s*baby/], ['kneestochest', /knees?[\s-]to[\s-]chest|knee hugs?|double knee/],
    ['hipflexor', /hip flexor|kneeling lunge stretch|couch stretch|psoas|half[\s-]kneeling/], ['supinetwist', /(supine|lying|knee|spinal|lower back) (twist|rotation)|windshield/],
    ['pelvictilt', /pelvic tilt|pelvic rock/], ['sideplankknee', /side[\s-]?plank.*(knee|modified)|(modified|kneeling) side[\s-]?plank/], ['sideplank', /side[\s-]?plank/],
    ['shouldertaps', /shoulder tap/], ['climber', /mountain\s*climb/], ['burpee', /burpee|squat thrust/], ['jumpsquat', /jump(ing)? squat|squat jump/],
    ['kneepushup', /(knee|kneeling|modified) push[\s-]?ups?/], ['inclinepushup', /(incline|wall|bench|counter|elevated) push[\s-]?ups?/],
    ['pushup', /push[\s-]?ups?|press[\s-]?ups?(?! stretch)/], ['highplank', /high plank|straight[\s-]arm plank|plank on (your )?hands/], ['plank', /plank|forearm hold/],
    ['hollowhold', /hollow/], ['birddog', /bird[\s-]?dog/], ['deadbug', /dead[\s-]?bug/], ['bicycle', /bicycle/], ['russiantwist', /russian twist|seated twist/],
    ['situp', /sit[\s-]?ups?|v[\s-]?ups?/], ['crunch', /crunch|curl[\s-]?ups?|ab curl/], ['flutter', /flutter|scissor/],
    ['sidelegraise', /side[\s-]?lying (leg|hip)|side leg (raise|lift)|lateral leg raise|hip abduction/], ['clamshell', /clam/],
    ['legraise', /leg raise|leg lift/], ['firehydrant', /fire hydrant/], ['donkeykick', /donkey|quadruped (hip )?extension|glute kick[\s-]?back/],
    ['singlelegbridge', /(single|one)[\s-]leg(ged)? (glute |hip )?bridge/], ['bridge', /bridge|hip thrust/],
    ['superman', /superman|swimmer|back extension|prone (y|t|w)\b|reverse snow angel/], ['cobra', /cobra|sphinx|upward dog|press[\s-]?up stretch|prone press/],
    ['floorpress', /floor press|chest press|bench press/], ['dips', /\bdips?\b/], ['stepup', /step[\s-]?ups?|box step/],
    ['row1arm', /(one|single|1)[\s-]arm.*row|bench.*row|supported row|kneeling row/], ['reversefly', /reverse fl(y|ies)|rear delt/], ['row', /\brows?\b/],
    ['press', /overhead press|shoulder press|military|arnold|\bpress\b/], ['lateralraise', /lateral raise|side raise|lat raise/], ['frontraise', /front raise/],
    ['hammercurl', /hammer/], ['curl', /curls?\b/], ['tricepext', /tricep|skull ?crusher|french press/], ['shrug', /shrug/],
    ['kbswing', /swing/], ['sldl', /single[\s-]leg (romanian )?(deadlift|rdl)|airplane|one[\s-]leg(ged)? deadlift/], ['goodmorning', /good ?morning/],
    ['rdl', /romanian|\brdl\b|stiff[\s-]leg|deadlift|hip hinge|\bhinge/], ['goblet', /goblet/], ['sumosquat', /sumo|pli[eé]/], ['wallsit', /wall sit|wall squat/],
    ['splitsquat', /split squat|bulgarian/], ['sidelunge', /side lunge|lateral lunge|cossack/], ['reverselunge', /reverse lunge|backward lunge|step[\s-]?back lunge/],
    ['lunge', /lunge/], ['squat', /squat|sit to stand|chair stand/], ['calfraise', /calf|heel raise|toe raise/], ['jack', /jumping jack|star jump|\bjacks\b/],
    ['skater', /skater/], ['highknees', /high knee/], ['buttkicks', /butt kick|heel flick/], ['jog', /\bjog|\brun|sprint/], ['march', /march|walk|step in place|steps?\b/],
    ['armcircles', /arm circle|shoulder circle|arm swing/], ['quadstretch', /quad(ricep)?s? stretch/], ['forwardfold', /seated (forward )?fold|sit and reach|seated hamstring|long sit/],
    ['toetouch', /toe touch|standing (forward )?fold|hamstring stretch|rag ?doll|forward fold|forward bend/], ['butterfly', /butterfly|bound angle|groin stretch|adductor stretch/],
    ['chestopener', /chest (opener|stretch)|doorway|pec(toral)? stretch/], ['crossbody', /cross[\s-]body|shoulder stretch|posterior shoulder/], ['neckstretch', /neck/],
    ['sidebend', /side bend|lateral bend|side stretch/], ['torsotwist', /torso twist|trunk rotation|standing twist|rotation/], ['reachup', /reach|overhead stretch|stretch/],
  ];
  const CONTEXT = [
    ['catcow', /hands and knees|all fours|quadruped|table ?top/], ['breathe', /lie on your back[^.]*knees bent/], ['kneestochest', /lie on your back|lying on your back|supine/],
    ['cobra', /lie on your (front|stomach|belly)|face down|prone/], ['plank', /plank position/], ['forwardfold', /sit (on the floor|tall)|seated/], ['stand', /stand/],
  ];
  function pick(name, text) {
    const n = (name || '').toLowerCase();
    for (const [p, re] of KEYS) if (re.test(n)) return p;
    const s = (text || '').toLowerCase();
    for (const [p, re] of CONTEXT) if (re.test(s)) return p;
    return 'stand';
  }
  const has = id => !!Moves.L[id];
  const LEGACY = { kneeschest: 'kneestochest', hinge: 'rdl', raise: 'lateralraise', knees: 'highknees', walk: 'march', calf: 'calfraise', fold: 'forwardfold', reach: 'reachup' };
  const norm = id => has(id) ? id : (LEGACY[id] && has(LEGACY[id]) ? LEGACY[id] : null);

  // ---- loading ----
  let p3d = null, bodyReady = false;
  function init() {
    if (!p3d) p3d = Coach3D.load().then(ok => { bodyReady = Body.ready; return ok; }, () => { bodyReady = Body.ready; return false; });
    return p3d;
  }
  // ---- camera ----
  function view(id, side, w, h, zoom) {
    const inf = Moves.info(id), fr = Moves.frame(id, side);
    const v = inf.view; const yaw = side === 'R' ? -v.yaw : v.yaw;
    const dx = fr.hi[0] - fr.lo[0], dy = fr.hi[1] - fr.lo[1], dz = fr.hi[2] - fr.lo[2];
    const r = Math.hypot(dx, dy, dz) / 2;
    const vf = 24 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (w / h));
    // the box seen from this side is flatter than its sphere: shrink a little
    const dist = r / Math.sin(Math.min(vf, hf) / 2) * (zoom || 0.9);
    return { yaw, pitch: v.pitch, target: [fr.c[0], fr.c[1] - dy * 0.04, fr.c[2]], dist, fov: 24 };
  }

  // ---- 2D fallback: the same skeleton, drawn flat ----
  function draw2d(ctx, w, h, S, vw, colors) {
    const c = colors || { body: '#173f39', far: '#8fb0a9', floor: '#d8e1dd' };
    const ix = Body.ix(), yaw = vw.yaw * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw), pit = vw.pitch * Math.PI / 180;
    const pr = p => { const x = p[0] - vw.target[0], y = p[1] - vw.target[1], z = p[2] - vw.target[2]; const X = x * cy - z * sy, Z = x * sy + z * cy; return [X, y * Math.cos(pit) - Z * Math.sin(pit), Z]; };
    const sc = Math.min(w, h) / (vw.dist * 0.42);
    const P2 = p => { const q = pr(p); return [w / 2 + q[0] * sc, h / 2 - q[1] * sc, q[2]]; };
    ctx.clearRect(0, 0, w, h);
    const g = P2([vw.target[0], 0, vw.target[2]]);
    ctx.fillStyle = c.floor; ctx.beginPath(); ctx.ellipse(g[0], g[1], w * 0.32, h * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    const J = n => P2(S.X[ix[n]]), T = n => P2(Body.tail(S, ix[n]));
    const segs = [];
    for (const s of ['L', 'R']) {
      segs.push([J('thigh.' + s), J('shin.' + s), 0.09, s], [J('shin.' + s), J('foot.' + s), 0.075, s], [J('foot.' + s), T('toes.' + s), 0.06, s],
        [J('upperarm.' + s), J('forearm.' + s), 0.07, s], [J('forearm.' + s), J('hand.' + s), 0.06, s], [J('hand.' + s), T('hand.' + s), 0.05, s]);
    }
    segs.push([J('hips'), J('spine01'), 0.2, 'C'], [J('spine01'), J('head'), 0.08, 'C']);
    const depth = { L: 0, R: 0, C: 0 };
    for (const s of ['L', 'R']) depth[s] = pr(S.X[ix['upperarm.' + s]])[2] + pr(S.X[ix['thigh.' + s]])[2];
    const far = depth.L < depth.R ? 'L' : 'R';
    segs.sort((a, b) => (a[3] === far ? -1 : a[3] === 'C' ? 0 : 1) - (b[3] === far ? -1 : b[3] === 'C' ? 0 : 1));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [a, b, t, s] of segs) { ctx.strokeStyle = s === far ? c.far : c.body; ctx.lineWidth = t * sc; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    const hd = P2(Body.tail(S, ix.head)), hb = J('head');
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.arc((hd[0] + hb[0]) / 2, (hd[1] + hb[1]) / 2, 0.1 * sc, 0, Math.PI * 2); ctx.fill();
  }

  // ---- mounted views ----
  const views = new Set();
  let primary = null;          // the one view that owns the WebGL canvas
  const thumbs = new Map(), thumbQ = [];
  let fps = { n: 0, t: 0, slow: 0 };
  function mount(el, id, opts) {
    const o = Object.assign({}, opts || {});
    const v = { el, id: norm(id) || 'stand', o, t0: performance.now(), canvas: null, S: null, alive: true };
    v.stop = () => { v.alive = false; views.delete(v); if (primary === v) primary = null; };
    v.set = (nid, no) => { v.id = norm(nid) || 'stand'; if (no) Object.assign(v.o, no); v.t0 = performance.now(); };
    views.add(v);
    if (!o.flat) { if (primary) primary.stop2d = true; primary = v; }
    init().then(() => { if (v.alive) start(); });
    return v;
  }
  function attachCanvas(v) {
    const ok = Coach3D.ready && primary === v && !v.o.flat;
    if (ok) {
      const c = Coach3D.canvas;
      if (c.parentNode !== v.el) { v.el.innerHTML = ''; c.style.width = '100%'; c.style.height = '100%'; c.style.display = 'block'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', v.o.label || 'Moving figure'); v.el.appendChild(c); }
      return c;
    }
    if (!v.canvas || v.canvas.parentNode !== v.el) { v.el.innerHTML = '<canvas role="img" style="width:100%;height:100%;display:block"></canvas>'; v.canvas = v.el.firstChild; if (v.o.label) v.canvas.setAttribute('aria-label', v.o.label); }
    return v.canvas;
  }
  let running = false;
  function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
  function loop(now) {
    if (!views.size && !thumbQ.length) { running = false; return; }
    requestAnimationFrame(loop);
    if (document.hidden || !Body.ready) return;
    // thumbnails first (at most one per frame) so the live view is drawn last
    if (thumbQ.length && Coach3D.ready) { const job = thumbQ.shift(); try { job.res(renderThumb(job.id, job.size)); } catch (e) { job.res(null); } }
    const t1 = performance.now();
    for (const v of views) {
      if (!v.el.isConnected) { v.stop(); continue; }
      const r = v.el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const c = attachCanvas(v);
      const side = v.o.side || null;
      const t = v.o.timeFn ? v.o.timeFn(now) : (now - v.t0) / 1000;
      v.S = Moves.sample(v.id, t, { side, state: v.S || undefined });
      const vw = view(v.id, side, r.width, r.height);
      if (c === Coach3D.canvas) {
        Coach3D.render(c, r.width, r.height, { S: v.S, view: vw, props: Moves.info(v.id).props, side });
      } else {
        const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        draw2d(c.getContext('2d'), W, H, v.S, vw, v.o.colors);
      }
    }
    // adapt quality on slow phones
    const dt = performance.now() - t1; fps.n++; fps.t += dt;
    if (fps.n >= 60) { if (fps.t / fps.n > 22) Coach3D.quality(-1); fps = { n: 0, t: 0 }; }
  }
  function renderThumb(id, size) {
    const S = Moves.sample(id, Moves.info(id).thumbAt * Moves.cycle(id), {});
    const vw = view(id, null, size, size, 0.7);
    Coach3D.render(Coach3D.canvas, size, size, { S, view: vw, props: Moves.info(id).props, thumb: true });
    return Coach3D.canvas.toDataURL('image/webp', 0.85);
  }
  // a still picture of the move (data URL), or null without WebGL
  function thumb(id, size) {
    id = norm(id) || 'stand'; size = size || 200;
    const k = id + ':' + size;
    if (thumbs.has(k)) return thumbs.get(k);
    const p = init().then(ok => ok ? new Promise(res => { thumbQ.push({ id, size, res }); start(); }) : null);
    thumbs.set(k, p); return p;
  }
  // draw a still 2D figure into a canvas (no WebGL)
  async function still2d(canvas, id) {
    await Coach3D.loadBody().catch(() => null); if (!Body.ready) return;
    id = norm(id) || 'stand';
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round((r.width || 120) * dpr); canvas.height = Math.round((r.height || 120) * dpr);
    const S = Moves.sample(id, Moves.info(id).thumbAt * Moves.cycle(id), {});
    draw2d(canvas.getContext('2d'), canvas.width, canvas.height, S, view(id, null, canvas.width, canvas.height));
  }
  return { pick, init, mount, thumb, still2d, norm, get ids() { return Moves.ids; }, label: id => Moves.info(norm(id) || 'stand').label, info: id => Moves.info(norm(id) || 'stand'), cycle: id => Moves.cycle(norm(id) || 'stand'), get has3d() { return Coach3D.ready; } };
})();
