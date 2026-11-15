// ---------- Drillbook 3D coach: skinned human (MakeHuman CC0 body) rendered with three.js ----------
var Coach3D = (function () {
  const SRC = window.DRILLBOOK_VENDOR ? window.DRILLBOOK_VENDOR + 'three.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  let T = null, renderer = null, scene = null, cam = null, mesh = null, bones3 = [], props = {}, ready = false, failed = false, loading = null, asset = null;
  let key = null, ground = null;
  const COL = { skin: 0xc08a68, shirt: 0x138a7c, shorts: 0x2a2f37, shoe: 0xf3f3f0, sole: 0x34383e, hair: 0x2b1e16, brow: 0x4a3426, sock: 0xe9e9e6 };

  async function decode() {
    const bin = atob(window.HUMAN_DATA);
    const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('gzip');
    const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    const dv = new DataView(buf); const hl = dv.getUint32(0, true);
    const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
    let o = 4 + hl; const n = hdr.n, nt = hdr.tri;
    const q = new Uint16Array(buf.slice(o, o + n * 6)); o += n * 6;
    const idx = new Uint16Array(buf.slice(o, o + nt * 6)); o += nt * 6;
    const si = new Uint8Array(buf.slice(o, o + n * 4)); o += n * 4;
    const sw = new Uint8Array(buf.slice(o, o + n * 4)); o += n * 4;
    const mw = new Uint8Array(buf.slice(o, o + n * 8)); o += n * 8;
    const ao = hdr.ao ? new Uint8Array(buf.slice(o, o + n)) : null;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) { const k = i % 3; pos[i] = hdr.lo[k] + (q[i] / 65535) * (hdr.hi[k] - hdr.lo[k]); }
    return Object.assign(hdr, { pos, idx, si, sw, mw, ao });
  }

  // decode the body (needed for poses, with or without WebGL)
  let bodyP = null;
  function loadBody() {
    if (!bodyP) bodyP = decode().then(a => { asset = a; Body.init(a); return a; });
    return bodyP;
  }
  function webgl() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
  }
  function load() {
    if (loading) return loading;
    loading = (async () => {
      try { await loadBody(); } catch (e) { console.warn(e); failed = true; return false; }
      if (!webgl()) { failed = true; return false; }
      if (!window.THREE) {
        const ok = await new Promise(res => { const s = document.createElement('script'); s.src = SRC; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
        if (!ok) { failed = true; return false; }
      }
      try { setup(); } catch (e) { console.warn(e); failed = true; return false; }
      return ready;
    })();
    return loading;
  }

  function mat(c, rough, extra) {
    const col = new T.Color(c); col.convertSRGBToLinear();
    return new T.MeshStandardMaterial(Object.assign({ color: col, roughness: rough, metalness: 0, skinning: true }, extra || {}));
  }
  // one material; each pixel picks skin / shirt / shorts / shoe / sole / hair / brow / sock from smooth per-vertex fields,
  // with anti-aliased edges, baked ambient occlusion, warm light bleeding through skin, fabric sheen and fine surface detail
  function bodyMaterial() {
    const m = mat(COL.skin, 0.55);
    m.extensions = { derivatives: true };
    const cols = ['skin', 'shirt', 'shorts', 'shoe', 'sole', 'hair', 'brow', 'sock'].map(k => { const c = new T.Color(COL[k]); c.convertSRGBToLinear(); return c; });
    const rough = [0.5, 0.9, 0.82, 0.5, 0.8, 0.78, 0.9, 0.92];
    const tintC = new T.Color(0xb4555a); tintC.convertSRGBToLinear();
    m.onBeforeCompile = sh => {
      sh.uniforms.uCols = { value: cols }; sh.uniforms.uRough = { value: rough }; sh.uniforms.uTint = { value: tintC };
      sh.vertexShader = 'attribute vec4 mw0;\nattribute vec4 mw1;\nattribute float aoA;\nvarying vec4 vW0;\nvarying vec4 vW1;\nvarying float vAO;\nvarying vec3 vBind;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvW0 = mw0; vW1 = mw1; vAO = aoA; vBind = position;');
      const head = `uniform vec3 uCols[8];
uniform float uRough[8];
uniform vec3 uTint;
varying vec4 vW0;
varying vec4 vW1;
varying float vAO;
varying vec3 vBind;
float hsh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }
float hairJit = 0.0;
float wOf(int i){ if(i==1) return vW0.y; if(i==2) return vW0.z; if(i==3) return vW0.w; if(i==4) return vW1.x; if(i==5) return vW1.y + hairJit; if(i==6) return vW1.z + hairJit * 0.6; if(i==7) return vW1.w; return clamp(1.0 - (vW0.y + vW0.z + vW0.w + vW1.x + vW1.y + vW1.z + vW1.w), 0.0, 1.0); }
`;
      sh.fragmentShader = head + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
  hairJit = (vnoise(vBind * 420.0) - 0.5) * 0.5 + (vnoise(vBind * 90.0) - 0.5) * 0.3;
  int mk = 0; float b1 = -1.0; int m2 = 0; float b2 = -1.0;
  for (int i = 0; i < 8; i++) { float w = wOf(i); if (w > b1) { b2 = b1; m2 = mk; b1 = w; mk = i; } else if (w > b2) { b2 = w; m2 = i; } }
  float edge = 1.0;
  vec3 cA = uCols[0], cB = uCols[0]; float rA = uRough[0], rB = uRough[0];
  for (int i = 0; i < 8; i++) { if (i == mk) { cA = uCols[i]; rA = uRough[i]; } if (i == m2) { cB = uCols[i]; rB = uRough[i]; } }
  // per-material surface detail
  float skinK = (mk == 0 ? 1.0 : 0.0);
  float n1 = vnoise(vBind * 900.0), n2 = vnoise(vBind * 120.0);
  if (mk == 0) { cA *= 0.95 + 0.07 * n2 + 0.03 * n1; cA = mix(cA, cA * uTint * 2.2, vW0.x * 0.45); }
  else if (mk == 5 || mk == 6) { float strand = vnoise(vec3(vBind.x * 380.0, vBind.y * 30.0, vBind.z * 380.0)) * 0.6 + vnoise(vBind * 900.0) * 0.4; cA *= 0.6 + 0.75 * strand;
    float thin = smoothstep(0.0, 0.25, b1 - max(b2, wOf(0))); cA = mix(uCols[0] * 0.8, cA, 0.55 + 0.45 * thin); }
  else if (mk == 1 || mk == 2 || mk == 7) { cA *= 0.96 + 0.06 * vnoise(vBind * 2600.0); cA *= 0.86 + 0.14 * smoothstep(0.02, 0.14, b1 - b2); }
  diffuseColor.rgb = mix(cB, cA, edge);
  float matRough = mix(rB, rA, edge);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = matRough + (mk == 0 ? (vW0.x * -0.15 + 0.08 * (n1 - 0.5)) : 0.0);`)
        .replace('#include <aomap_fragment>', `
  float ao = mix(1.0, vAO, 0.9);
  reflectedLight.indirectDiffuse *= ao; reflectedLight.indirectSpecular *= ao * ao;
  reflectedLight.directDiffuse *= mix(1.0, ao, 0.35);
  // light bleeding through skin: warm, strongest where light grazes
  float facing = clamp(dot(normal, normalize(-vViewPosition)), 0.0, 1.0);
  float edgeL = pow(1.0 - facing, 3.0);
  if (mk == 0) reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.55, 0.16, 0.08) * (0.18 + 0.25 * edgeL) * ao;
  else if (mk == 1 || mk == 2 || mk == 7) reflectedLight.indirectDiffuse += diffuseColor.rgb * edgeL * 0.35 * ao;`);
    };
    return m;
  }
  function envMap() {
    // soft studio environment for realistic reflections: bright sky dome, warm key panel, cool fill, darker floor
    const es = new T.Scene();
    const g = new T.SphereGeometry(10, 32, 16);
    const mt = new T.ShaderMaterial({ side: T.BackSide, uniforms: {}, vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float y = vP.y; vec3 sky = mix(vec3(0.82,0.86,0.88), vec3(1.05,1.05,1.02), smoothstep(-0.05, 0.7, y)); vec3 fl = vec3(0.32,0.34,0.33); vec3 c = y > 0.0 ? sky : mix(sky, fl, smoothstep(0.0, -0.15, y));' +
        ' c += vec3(2.6,2.3,2.0) * smoothstep(0.86, 0.95, dot(vP, normalize(vec3(0.5,0.75,0.6))));' +
        ' c += vec3(0.9,1.0,1.2) * smoothstep(0.8, 0.95, dot(vP, normalize(vec3(-0.7,0.4,-0.6))));' +
        ' gl_FragColor = vec4(c, 1.0); }' });
    es.add(new T.Mesh(g, mt));
    const pm = new T.PMREMGenerator(renderer);
    const rt = pm.fromScene(es, 0.02); pm.dispose();
    return rt.texture;
  }
  function setup() {
    T = window.THREE;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    PR = Math.min(1.5, window.devicePixelRatio || 1); renderer.setPixelRatio(PR);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(24, 1, 0.1, 40);
    try { if (window.DRILLBOOK_ENV) scene.environment = envMap(); } catch (e) { console.warn(e); }
    scene.add(new T.HemisphereLight(0xfdfcfa, 0xa9b6b0, scene.environment ? 0.25 : 0.75));
    key = new T.DirectionalLight(0xfff3e6, 1.35); key.position.set(1.6, 3.4, 2.4); key.castShadow = true;
    key.shadow.mapSize.set(768, 768); Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 9 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
    scene.add(key); scene.add(key.target);
    const rim = new T.DirectionalLight(0xdfeeff, 0.55); rim.position.set(-2.5, 2.2, -2.5); scene.add(rim);
    const fill = new T.DirectionalLight(0xffffff, 0.25); fill.position.set(-1, 0.6, 3); scene.add(fill);
    ground = new T.Mesh(new T.PlaneGeometry(14, 14), new T.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // body mesh
    const a = asset, g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(a.pos, 3));
    g.setIndex(new T.BufferAttribute(a.idx, 1));
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(Uint16Array.from(a.si), 4));
    g.setAttribute('skinWeight', new T.BufferAttribute(Float32Array.from(a.sw, x => x / 255), 4));
    g.computeVertexNormals();
    const mw = a.mw, w0 = new Uint8Array(a.n * 4), w1 = new Uint8Array(a.n * 4);
    for (let i = 0; i < a.n; i++) for (let k = 0; k < 4; k++) { w0[i * 4 + k] = mw[i * 8 + k]; w1[i * 4 + k] = mw[i * 8 + 4 + k]; }
    g.setAttribute('mw0', new T.BufferAttribute(w0, 4, true)); g.setAttribute('mw1', new T.BufferAttribute(w1, 4, true));
    g.setAttribute('aoA', new T.BufferAttribute(a.ao || new Uint8Array(a.n).fill(255), 1, true));
    const used = bodyMaterial();
    bones3 = a.bones.map(b => { const o = new T.Bone(); o.name = b.n; return o; });
    a.bones.forEach((b, i) => {
      const off = b.p < 0 ? b.h : [b.h[0] - a.bones[b.p].h[0], b.h[1] - a.bones[b.p].h[1], b.h[2] - a.bones[b.p].h[2]];
      bones3[i].position.set(off[0], off[1], off[2]);
      if (b.p >= 0) bones3[b.p].add(bones3[i]);
    });
    mesh = new T.SkinnedMesh(g, used);
    mesh.add(bones3[0]); mesh.updateMatrixWorld(true);
    mesh.bind(new T.Skeleton(bones3));
    mesh.castShadow = true; mesh.frustumCulled = false;
    scene.add(mesh);
    // eyes
    const head = bones3[Body.ix().head], hh = a.bones[Body.ix().head].h;
    const white = mat(0xdcd5cb, 0.3, { skinning: false }), iris = mat(0x2d2018, 0.3, { skinning: false });
    for (const e of a.eyes) {
      const ball = new T.Mesh(new T.SphereGeometry(0.0118, 18, 14), white);
      ball.position.set(e[0] - hh[0], e[1] - hh[1], e[2] - hh[2] - 0.002); head.add(ball);
      const ir = new T.Mesh(new T.SphereGeometry(0.0058, 14, 10), iris);
      ir.position.set(0, 0, 0.0096); ir.scale.set(1, 1, 0.45); ball.add(ir);
    }
    buildProps();
    ready = true;
  }

  // simple equipment
  function buildProps() {
    const steel = mat(0x50565d, 0.35, { skinning: false, metalness: 0.6 }), rubber = mat(0x24282d, 0.7, { skinning: false });
    const db = new T.Group();
    const bar = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.16, 16), steel); bar.rotation.z = Math.PI / 2; db.add(bar);
    for (const s of [-1, 1]) { const h = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.06, 6), rubber); h.rotation.z = Math.PI / 2; h.position.x = s * 0.1; db.add(h); }
    db.traverse(o => { o.castShadow = true; });
    props.dbL = db; props.dbR = db.clone();
    const kb = new T.Group();
    const ball = new T.Mesh(new T.SphereGeometry(0.1, 24, 18), rubber); ball.position.y = -0.11; kb.add(ball);
    const handle = new T.Mesh(new T.TorusGeometry(0.06, 0.012, 10, 24, Math.PI), steel); kb.add(handle);
    kb.traverse(o => { o.castShadow = true; }); props.kb = kb;
    const benchM = mat(0x2f353b, 0.6, { skinning: false }), legM = mat(0x6b737b, 0.4, { skinning: false, metalness: 0.5 });
    const bench = new T.Group();
    const top = new T.Mesh(new T.BoxGeometry(0.32, 0.07, 1.2), benchM); top.position.y = 0.42; bench.add(top);
    for (const z of [-0.5, 0.5]) { const l = new T.Mesh(new T.BoxGeometry(0.28, 0.4, 0.05), legM); l.position.set(0, 0.2, z); bench.add(l); }
    bench.traverse(o => { o.castShadow = true; o.receiveShadow = true; }); props.bench = bench;
    const matM = mat(0x9cc9bf, 0.9, { skinning: false });
    const pad = new T.Mesh(new T.BoxGeometry(0.62, 0.008, 1.8), matM); pad.position.y = 0.004; pad.receiveShadow = true; props.mat = pad;
    const wall = new T.Mesh(new T.BoxGeometry(1.6, 2.2, 0.06), mat(0xe9ecea, 0.9, { skinning: false })); wall.receiveShadow = true; props.wall = wall;
    for (const k in props) { props[k].visible = false; scene.add(props[k]); }
  }

  function apply(S) {
    for (let i = 0; i < bones3.length; i++) { const q = S.q[i]; bones3[i].quaternion.set(q[0], q[1], q[2], q[3]); }
    bones3[0].position.set(S.root[0], S.root[1], S.root[2]);
    const sc = S.scale || {};
    for (let i = 0; i < bones3.length; i++) { const s = sc[i] || 1; bones3[i].scale.set(s, s, s); }
  }
  function showProps(S, list) {
    for (const k in props) props[k].visible = false;
    const ix = Body.ix();
    for (const p of list || []) {
      const key = p.k === 'dbV' ? 'dbL' : p.k, o = props[key]; if (!o) continue; o.visible = true;
      if (p.at === 'handL' || p.at === 'handR') {
        const s = p.at.slice(-1), i = ix['hand.' + s];
        const c = Body.tail(S, i), h = S.X[i], W = S.W[i];
        const palm = Body.q.qv(W, Body.q.qv(Body.handBasis(s), [s === 'L' ? -1 : 1, 0, 0]));
        o.position.set(h[0] * 0.35 + c[0] * 0.65 + palm[0] * 0.035, h[1] * 0.35 + c[1] * 0.65 + palm[1] * 0.035, h[2] * 0.35 + c[2] * 0.65 + palm[2] * 0.035);
        // the handle runs across the palm (along the knuckle line)
        const ax = Body.q.qv(W, Body.q.qv(Body.handBasis(s), [0, 0, 1]));
        const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(ax[0], ax[1], ax[2]).normalize());
        o.quaternion.copy(q);
      } else if (p.at === 'hands') {
        const a = Body.tail(S, ix['hand.L']), b = Body.tail(S, ix['hand.R']), Wc = S.W[ix.spine01];
        const f = Body.q.qv(Wc, [0, 0, 1]);
        o.position.set((a[0] + b[0]) / 2 + f[0] * 0.02, (a[1] + b[1]) / 2 + f[1] * 0.02 - (p.k === 'kb' ? 0 : 0.0), (a[2] + b[2]) / 2 + f[2] * 0.02);
        const up = Body.q.qv(Wc, [0, 1, 0]);
        if (p.k === 'dbV') { o.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(up[0], up[1], up[2]).normalize()); o.position.x -= up[0] * 0.045; o.position.y -= up[1] * 0.045; o.position.z -= up[2] * 0.045; }
        else { const fa = Body.q.qv(S.W[ix['forearm.L']], [0, 0, 0]); void fa; o.quaternion.set(Wc[0], Wc[1], Wc[2], Wc[3]); }
      } else {
        const pos = p.pos || [0, 0, 0]; o.position.set(pos[0] + (p.k === 'wall' ? 0 : 0), pos[1], pos[2]);
        o.rotation.set(0, (p.yaw || 0) * Math.PI / 180, 0);
      }
    }
  }

  // frame: { S, props, view:{yaw,pitch,target:[x,y,z],dist} }
  function render(canvas, w, h, frame) {
    if (!ready) return false;
    if (renderer.domElement !== canvas) return false;
    apply(frame.S); showProps(frame.S, frame.props);
    const v = frame.view;
    // a mat without a fixed place lies under the person
    const mp = (frame.props || []).find(p => p.k === 'mat');
    if (mp && !mp.pos) { props.mat.position.x = v.target[0]; props.mat.position.z = v.target[2]; }
    cam.aspect = w / h; cam.fov = v.fov || 24; cam.updateProjectionMatrix();
    const yaw = v.yaw * Math.PI / 180, pit = v.pitch * Math.PI / 180;
    const t = v.target;
    cam.position.set(t[0] + v.dist * Math.cos(pit) * Math.sin(yaw), t[1] + v.dist * Math.sin(pit), t[2] + v.dist * Math.cos(pit) * Math.cos(yaw));
    cam.lookAt(t[0], t[1], t[2]);
    key.position.set(t[0] + 1.6, 3.6, t[2] + 2.0); key.target.position.set(t[0], 0, t[2]);
    const pr = frame.thumb ? 1 : PR;
    if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
    const sz = renderer.getSize(new T.Vector2());
    if (sz.x !== Math.round(w) || sz.y !== Math.round(h)) renderer.setSize(Math.round(w), Math.round(h), false);
    renderer.render(scene, cam);
    return true;
  }
  let PR = 1.5, Q = 2;
  function quality(d) {
    if (!ready || d >= 0 || Q <= 0) return;
    Q--;
    if (Q === 1) { PR = 1; }
    if (Q === 0) { renderer.shadowMap.enabled = false; key.castShadow = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  }
  return { quality, load, loadBody, render, get ready() { return ready; }, get failed() { return failed; }, get canvas() { return renderer && renderer.domElement; }, get renderer() { return renderer; } };
})();
