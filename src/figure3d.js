// ---------- Drillbook 3D coach (procedural human, driven by Figure poses) ----------
var Figure3D = (function () {
  const SRC = window.DRILLBOOK_VENDOR ? window.DRILLBOOK_VENDOR + 'three.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  let T = null, renderer = null, scene = null, cam = null, rig = null, ready = false, failed = false, loading = null;
  const C = { skin: 0xb98260, skinDark: 0xa36f50, shirt: 0x1f7d70, shorts: 0x283039, shoe: 0xf2f2ee, sole: 0x3a3f45, hair: 0x2a1f1a, bell: 0x3b4148, bellPlate: 0x23272c, bench: 0x5a646e, benchTop: 0x2f353b, mat: 0x9fd0c6 };
  const DEG = Math.PI / 180;

  function load() {
    if (loading) return loading;
    loading = new Promise((res) => {
      try {
        const c = document.createElement('canvas');
        if (!(c.getContext('webgl') || c.getContext('experimental-webgl'))) { failed = true; return res(false); }
      } catch (e) { failed = true; return res(false); }
      if (window.THREE) { setup(); return res(ready); }
      const s = document.createElement('script'); s.src = SRC;
      s.onload = () => { try { setup(); } catch (e) { console.warn(e); failed = true; } res(ready); };
      s.onerror = () => { failed = true; res(false); };
      document.head.appendChild(s);
    });
    return loading;
  }

  // ---- geometry helpers ----
  function lathe(len, radii, segs) {
    // radii: array of [fraction along length, radius]; rounded caps at both ends
    const pts = [];
    const r0 = radii[0][1], r1 = radii[radii.length - 1][1];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new T.Vector2(Math.sin(a) * r0, Math.cos(a) * r0 * 0.9)); }
    for (let i = 1; i < 24; i++) {
      const f = i / 24; let r = r0;
      for (let k = 0; k < radii.length - 1; k++) {
        const [f0, a0] = radii[k], [f1, a1] = radii[k + 1];
        if (f >= f0 && f <= f1) { const t = (f - f0) / (f1 - f0 || 1); const sm = t * t * (3 - 2 * t); r = a0 + (a1 - a0) * sm; break; }
      }
      pts.push(new T.Vector2(r, -f * len));
    }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new T.Vector2(Math.cos(a) * r1, -len - Math.sin(a) * r1 * 0.9)); }
    pts.reverse();
    const g = new T.LatheGeometry(pts, segs || 22);
    g.computeVertexNormals();
    return g;
  }
  const mats = {};
  function mat(color, rough) {
    const k = color + ':' + (rough || 0.7);
    if (!mats[k]) {
      const c = new T.Color(color); c.convertSRGBToLinear();
      const isSkin = color === C.skin || color === C.skinDark;
      mats[k] = isSkin ? new T.MeshPhysicalMaterial({ color: c, roughness: 0.5, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.6, sheen: new T.Color(0x5a2a1a) })
                       : new T.MeshStandardMaterial({ color: c, roughness: rough || 0.7, metalness: 0 });
    }
    return mats[k];
  }
  function mesh(geo, color, rough, sx, sz) {
    const m = new T.Mesh(geo, mat(color, rough));
    if (sx || sz) m.scale.set(sx || 1, 1, sz || 1);
    return m;
  }
  function ellipsoid(rx, ry, rz, color, rough) {
    const m = new T.Mesh(new T.SphereGeometry(1, 28, 20), mat(color, rough));
    m.scale.set(rx, ry, rz); return m;
  }
  // a bone: group placed at the joint, rotated about z by the 2D angle; geometry hangs down -Y
  function bone(parts) { const g = new T.Group(); parts.forEach(p => g.add(p)); scene.add(g); return g; }
  function at(m, x, y, z) { m.position.set(x, y, z || 0); return m; }

  function setup() {
    T = window.THREE;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(26, 1, 0.1, 50);
    scene.add(new T.HemisphereLight(0xffffff, 0xb9c6c1, 0.85));
    const key = new T.DirectionalLight(0xfff6ec, 1.25); key.position.set(1.2, 3.2, 2.2); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -1.8; key.shadow.camera.right = 1.8; key.shadow.camera.top = 1.8; key.shadow.camera.bottom = -1.8; key.shadow.camera.near = 0.5; key.shadow.camera.far = 8; key.shadow.radius = 4; key.shadow.bias = -0.0008;
    scene.add(key); scene.add(key.target);
    const fill = new T.DirectionalLight(0xe8f0ff, 0.35); fill.position.set(2.5, 0.8, -0.5); scene.add(fill);
    const rim = new T.DirectionalLight(0xdff3ee, 0.45); rim.position.set(-2, 1.5, -1.5); scene.add(rim);
    const L = Figure.L;
    const R = {};
    // legs (near = 0 at +z, far = 1 at -z)
    R.legs = [0, 1].map(i => {
      const thighG = lathe(L.th, [[0, 0.09], [0.3, 0.084], [0.75, 0.066], [1, 0.05]]);
      const shortsG = lathe(L.th * 0.52, [[0, 0.1], [0.8, 0.09], [1, 0.088]]);
      const shinG = lathe(L.sh, [[0, 0.05], [0.22, 0.058], [0.55, 0.045], [1, 0.032]]);
      const thigh = bone([mesh(thighG, C.skin, 0.55), mesh(shortsG, C.shorts, 0.85)]);
      const knee = ellipsoid(0.052, 0.052, 0.052, C.skin, 0.55); scene.add(knee);
      const calf = ellipsoid(0.045, 0.1, 0.042, C.skin, 0.55); calf.position.set(-0.018, -0.14, 0);
      const shin = bone([mesh(shinG, C.skin, 0.55), calf]);
      const shoe = new T.Group();
      const heel = at(ellipsoid(0.045, 0.045, 0.043, C.shoe, 0.6), -0.005, -0.005);
      const upper = at(ellipsoid(0.08, 0.038, 0.046, C.shoe, 0.6), 0.055, -0.01);
      const toe = at(ellipsoid(0.04, 0.03, 0.044, C.shoe, 0.6), 0.115, -0.02);
      const sole = at(ellipsoid(0.095, 0.014, 0.05, C.sole, 0.9), 0.05, -0.042);
      const stripe = at(ellipsoid(0.045, 0.012, 0.047, 0xf2c230, 0.6), 0.04, 0.0);
      const sock = at(new T.Mesh(lathe(0.05, [[0, 0.036], [1, 0.04]]), mat(0xf4f4f0, 0.9)), 0, 0.06);
      shoe.add(heel, upper, toe, sole, stripe, sock); scene.add(shoe);
      return { thigh, knee, shin, shoe };
    });
    R.arms = [0, 1].map(i => {
      const uaG = lathe(L.ua, [[0, 0.06], [0.35, 0.056], [0.75, 0.047], [1, 0.04]]);
      const sleeveG = lathe(L.ua * 0.4, [[0, 0.07], [1, 0.064]]);
      const faG = lathe(L.fa, [[0, 0.042], [0.25, 0.048], [1, 0.03]]);
      const ua = bone([mesh(uaG, C.skin, 0.55), mesh(sleeveG, C.shirt, 0.8)]);
      const elbow = ellipsoid(0.041, 0.041, 0.041, C.skin, 0.55); scene.add(elbow);
      const fa = bone([mesh(faG, C.skin, 0.55)]);
      const hand = new T.Group();
      const palm = at(ellipsoid(0.024, 0.042, 0.036, C.skin, 0.55), 0, -0.04);
      hand.add(palm);
      [-0.024, -0.008, 0.008, 0.024].forEach((fz, k) => {
        const f = new T.Mesh(lathe(0.05 - Math.abs(k - 1.5) * 0.006, [[0, 0.0105], [1, 0.0085]], 10), mat(C.skin, 0.55));
        f.position.set(0.004, -0.072, fz); f.rotation.z = 0.25; hand.add(f);
      });
      const thumb = new T.Mesh(lathe(0.04, [[0, 0.012], [1, 0.0095]], 10), mat(C.skin, 0.55)); thumb.position.set(0.018, -0.03, 0.03); thumb.rotation.set(-0.5, 0, 0.6); hand.add(thumb);
      scene.add(hand);
      const shoulder = ellipsoid(0.066, 0.07, 0.066, C.shirt, 0.8); scene.add(shoulder);
      const bell = new T.Group();
      const bar = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 12), mat(C.bell, 0.4)); bar.rotation.x = Math.PI / 2;
      const p1 = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.04, 20), mat(C.bellPlate, 0.5)); p1.rotation.x = Math.PI / 2; p1.position.z = 0.07;
      const p2 = p1.clone(); p2.position.z = -0.07;
      bell.add(bar, p1, p2); scene.add(bell);
      return { ua, elbow, fa, hand, shoulder, bell };
    });
    // torso: abdomen (hip → mid) + chest (mid → neck), elliptical cross-section (wide side to side)
    R.abs = bone([mesh(lathe(0.27, [[0, 0.118], [0.5, 0.108], [1, 0.12]]), C.shirt, 0.8, 0.82, 1.3), mesh(lathe(0.07, [[0, 0.124], [1, 0.122]]), C.shorts, 0.85, 0.84, 1.3)]);
    // chest bone: local -Y runs up toward the neck; local -X is the front of the body
    const pecs = at(ellipsoid(0.06, 0.07, 0.15, C.shirt, 0.8), -0.045, -0.17);
    const lats = at(ellipsoid(0.07, 0.12, 0.17, C.shirt, 0.8), 0.03, -0.12);
    const traps = at(ellipsoid(0.06, 0.05, 0.13, C.shirt, 0.8), 0.015, -0.25);
    R.chestCore = mesh(lathe(0.27, [[0, 0.118], [0.55, 0.135], [0.85, 0.13], [1, 0.085]]), C.shirt, 0.8, 0.8, 1.42);
    R.chest = bone([R.chestCore, pecs, lats, traps]);
    R.pelvis = new T.Group();
    R.pelvis.add(ellipsoid(0.098, 0.085, 0.145, C.shorts, 0.85));
    // pelvis local +X is the front; glutes sit behind
    R.pelvis.add(at(ellipsoid(0.07, 0.075, 0.075, C.shorts, 0.85), -0.04, -0.035, 0.06), at(ellipsoid(0.07, 0.075, 0.075, C.shorts, 0.85), -0.04, -0.035, -0.06));
    scene.add(R.pelvis);
    R.neck = bone([mesh(lathe(0.1, [[0, 0.05], [1, 0.046]]), C.skin, 0.55)]);
    // head: built with up = +Y, face = +X
    const head = new T.Group();
    const skull = ellipsoid(0.09, 0.1, 0.082, C.skin, 0.55); skull.position.set(-0.005, 0.01, 0);
    const face = at(ellipsoid(0.07, 0.085, 0.07, C.skin, 0.55), 0.028, -0.02);
    const jaw = at(ellipsoid(0.06, 0.04, 0.062, C.skin, 0.55), 0.03, -0.068);
    const chin = at(ellipsoid(0.03, 0.025, 0.035, C.skin, 0.55), 0.068, -0.082);
    const hair = new T.Mesh(new T.SphereGeometry(1, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(C.hair, 0.95));
    hair.scale.set(0.098, 0.1, 0.09); hair.position.set(-0.008, 0.024, 0); hair.rotation.z = 0.28;
    const nape = at(ellipsoid(0.06, 0.07, 0.083, C.hair, 0.95), -0.035, 0.0);
    const nose = at(ellipsoid(0.02, 0.03, 0.014, C.skin, 0.55), 0.095, -0.015);
    const earL = at(ellipsoid(0.012, 0.024, 0.008, C.skinDark, 0.55), -0.008, -0.01, 0.083);
    const earR = at(earL.clone(), -0.008, -0.01, -0.083);
    const browL = at(ellipsoid(0.008, 0.006, 0.022, C.hair, 0.9), 0.085, 0.03, 0.028); const browR = at(browL.clone(), 0.085, 0.03, -0.028);
    const eyeW = (z) => at(ellipsoid(0.008, 0.009, 0.013, 0xf4efe8, 0.3), 0.083, 0.008, z);
    const iris = (z) => at(ellipsoid(0.006, 0.008, 0.008, 0x241811, 0.25), 0.086, 0.008, z);
    const lips = at(ellipsoid(0.008, 0.008, 0.026, 0x9a5a48, 0.5), 0.088, -0.05);
    head.add(skull, face, jaw, chin, hair, nape, nose, earL, earR, browL, browR, iris(0.03), iris(-0.03), lips); scene.add(head);
    R.head = head;
    // floor bits
    const sh = document.createElement('canvas'); sh.width = sh.height = 128;
    const sx = sh.getContext('2d'); const gr = sx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(16,35,32,0.32)'); gr.addColorStop(1, 'rgba(16,35,32,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
    const shTex = new T.CanvasTexture(sh);
    R.shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
    R.shadow.rotation.x = -Math.PI / 2; scene.add(R.shadow);
    R.mat = new T.Mesh(new T.BoxGeometry(1, 0.012, 0.62), mat(C.mat, 0.95)); R.mat.receiveShadow = true; scene.add(R.mat);
    R.ground = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ opacity: 0.16 })); R.ground.rotation.x = -Math.PI / 2; R.ground.position.y = 0.001; R.ground.receiveShadow = true; scene.add(R.ground);
    R.bench = new T.Group();
    const top = new T.Mesh(new T.BoxGeometry(1.1, 0.06, 0.32), mat(C.benchTop, 0.8)); top.position.set(-0.06, 0.42, 0);
    const l1 = new T.Mesh(new T.BoxGeometry(0.05, 0.4, 0.26), mat(C.bench, 0.6)); l1.position.set(-0.5, 0.2, 0);
    const l2 = l1.clone(); l2.position.x = 0.38;
    R.bench.add(top, l1, l2); scene.add(R.bench);
    scene.traverse(o => { if (o.isMesh && o !== R.ground && o !== R.shadow) { o.castShadow = true; } });
    R.bench.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    rig = R; ready = true;
  }

  const Z_LEG = 0.09, Z_ARM = 0.2;
  function place(g, p, a, z, len, base) {
    g.position.set(p[0], p[1], z);
    g.rotation.set(0, 0, a * DEG);
    if (len && base) g.scale.set(1, len / base, 1);
  }
  function v(p, z) { return new T.Vector3(p[0], p[1], z); }

  function pose(pattern, phase) {
    const { A, J } = Figure.pose(pattern, phase);
    const info = Figure.info(pattern);
    const L = Figure.L;
    // torso with spine curve
    const dx = J.neck[0] - J.hip[0], dy = J.neck[1] - J.hip[1];
    const mid = [(J.hip[0] + J.neck[0]) / 2 - dy * J.curve * 1.1, (J.hip[1] + J.neck[1]) / 2 + dx * J.curve * 1.1];
    const ang = (p, q) => Math.atan2(q[0] - p[0], -(q[1] - p[1])) / DEG;
    const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
    // lathe hangs down -Y; a bone pointing "up" needs angle 180 etc — same convention as 2D
    place(rig.abs, J.hip, ang(J.hip, mid), 0, dist(J.hip, mid), 0.27);
    place(rig.chest, mid, ang(mid, J.neck), 0, dist(mid, J.neck), 0.27);
    rig.pelvis.position.set(J.hip[0], J.hip[1], 0); rig.pelvis.rotation.set(0, 0, (A.torso - 180) * DEG);
    place(rig.neck, J.neck, A.headA, 0);
    const hp = [J.neck[0] + Math.sin(A.headA * DEG) * 0.15, J.neck[1] - Math.cos(A.headA * DEG) * 0.15];
    rig.head.position.set(hp[0], hp[1], 0); rig.head.rotation.set(0, 0, (A.headA - 180) * DEG);
    A.legs.forEach((a, i) => {
      const z = i ? -Z_LEG : Z_LEG, lg = rig.legs[i], j = J.legs[i];
      place(lg.thigh, J.hip, a[0], z);
      lg.knee.position.copy(v(j.knee, z));
      place(lg.shin, j.knee, a[1], z);
      lg.shoe.position.copy(v(j.ankle, z)); lg.shoe.rotation.set(0, 0, (a[2] - 90) * DEG);
    });
    const shoulderC = J.sh;
    A.arms.forEach((a, i) => {
      const z = i ? -Z_ARM : Z_ARM, am = rig.arms[i], j = J.arms[i];
      am.shoulder.position.copy(v(shoulderC, z * 0.92));
      place(am.ua, shoulderC, a[0], z);
      am.elbow.position.copy(v(j.elbow, z));
      place(am.fa, j.elbow, a[1], z);
      am.hand.position.copy(v(j.hand, z));
      const flat = j.hand[1] < 0.09 && Math.abs(Math.sin(a[1] * DEG)) < 0.6;
      am.hand.rotation.set(0, 0, (flat ? 90 : a[1]) * DEG);
      if (flat) am.hand.position.y += 0.012;
      const showBell = info.prop === 'bells' || info.prop === 'bell' || (info.bell === 'near' && i === 0);
      am.bell.visible = showBell;
      if (showBell) { const hx = j.hand[0] + Math.sin(a[1] * DEG) * 0.04, hy = j.hand[1] - Math.cos(a[1] * DEG) * 0.04; am.bell.position.set(hx, hy, info.prop === 'bell' ? 0 : z); am.bell.visible = info.prop === 'bell' ? i === 0 : true; }
    });
    rig.bench.visible = info.prop === 'bench';
    return { A, J };
  }

  const fitCache = {};
  function fit(pattern) {
    if (fitCache[pattern]) return fitCache[pattern];
    const bb = Figure.bbox(pattern);
    const floorish = bb.y1 < 1.15;
    return (fitCache[pattern] = { bb, floorish });
  }

  // same signature as Figure.draw
  function draw(ctx, w, h, pattern, phase) {
    if (!ready) return false;
    pose(pattern, phase);
    const { bb, floorish } = fit(pattern);
    const cx = (bb.x0 + bb.x1) / 2, bw = bb.x1 - bb.x0, bh = bb.y1;
    rig.mat.visible = floorish && Figure.info(pattern).prop !== 'bench';
    rig.mat.scale.set(Math.max(1.2, bw + 0.5), 1, 1); rig.mat.position.set(cx, 0.006, 0);
    rig.shadow.scale.set(bw + 0.7, 0.75, 1); rig.shadow.position.set(cx, 0.014, 0);
    // camera: three-quarter view from the front-right, slightly above, perspective like a photo
    const yaw = 30 * DEG, pitch = 10 * DEG;
    const target = new T.Vector3(cx, bh * 0.47, 0);
    const viewW = bw * Math.cos(yaw) + 0.6, viewH = bh + 0.4;
    const aspect = w / h;
    let hh = viewH / 2; if ((viewW / 2) / hh > aspect) hh = (viewW / 2) / aspect;
    const D = hh / Math.tan(cam.fov * DEG / 2) + 0.4;
    cam.aspect = aspect; cam.updateProjectionMatrix();
    cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * D, target.y + Math.sin(pitch) * D, Math.cos(yaw) * Math.cos(pitch) * D);
    cam.lookAt(target);
    // gentle breathing so the body never looks frozen
    const br = 1 + 0.018 * Math.sin(performance.now() / 1000 * 1.4);
    rig.chestCore.scale.set(0.8 * br, 1, 1.42 * (1 + (br - 1) * 0.5));
    if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false);
    renderer.render(scene, cam);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(renderer.domElement, 0, 0, w, h);
    return true;
  }
  return { load, draw, get ready() { return ready; }, get failed() { return failed; } };
})();
