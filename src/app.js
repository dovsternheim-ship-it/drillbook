// ---------- Drillbook app ----------
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h2v14H7zM20 5v14L10 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 5h2v14h-2zM4 5v14l10-7z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  };
  const MARK = '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#f2c230" stroke-width="3" stroke-dasharray="40 60" stroke-linecap="round" transform="rotate(-90 12 12)"/><circle cx="12" cy="12" r="3" fill="#f4f7f5"/></svg>';

  // ---------- settings (per device) ----------
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('drillbook:prefs') || '{}'); } catch (e) { return {}; } })();
  if (prefs.sound == null) prefs.sound = true;
  if (prefs.voice == null) prefs.voice = true;
  if (!prefs.pace) prefs.pace = 3;
  const savePrefs = () => { try { localStorage.setItem('drillbook:prefs', JSON.stringify(prefs)); } catch (e) {} };

  // ---------- IndexedDB for pictures (localStorage is too small for many plans) ----------
  const IDB = {
    p: null,
    open() {
      if (!this.p) this.p = new Promise((res) => {
        try { const r = indexedDB.open('drillbook', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
      });
      return this.p;
    },
    async op(mode, fn) { const db = await this.open(); if (!db) return null; return new Promise(res => { try { const tx = db.transaction('kv', mode); const q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => res(null); } catch (e) { res(null); } }); },
    get(k) { return this.op('readonly', s => s.get(k)); },
    set(k, v) { return this.op('readwrite', s => s.put(v, k)); },
    del(k) { return this.op('readwrite', s => s.delete(k)); },
  };
  try { if (!window.claude && navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  // ---------- storage: claude db when available, this browser otherwise ----------
  const Store = {
    db: null, uid: null, mode: 'local', routines: [], imgCache: {},
    async init() {
      const local = this.localList();
      this.routines = local;
      let db = null, user = null;
      try {
        if (window.claude && window.claude.use) {
          [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        }
      } catch (e) { db = null; }
      if (db && user) {
        try {
          const me = await user.id();
          if (me) { this.db = db; this.uid = me; this.mode = 'cloud'; }
        } catch (e) {}
      }
      if (this.mode === 'cloud') {
        try {
          const snap = await Promise.race([this.col().where('kind', '==', 'routine').get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
          const remote = [];
          snap.forEach(d => { const v = d.data(); try { remote.push(JSON.parse(v.json)); } catch (e) {} });
          // keep anything that only exists locally (made before sign-in or offline), and push it up
          const ids = new Set(remote.map(r => r.id));
          for (const r of local) if (!ids.has(r.id)) { remote.push(r); this.pushRoutine(r, true); }
          remote.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          this.routines = remote;
          this.localWriteList();
        } catch (e) { this.mode = 'local'; }
      }
      return this.routines;
    },
    col() { return this.db.collection('data/users/' + this.uid); },
    localList() { try { return JSON.parse(localStorage.getItem('drillbook:routines') || '[]'); } catch (e) { return []; } },
    localWriteList() { try { localStorage.setItem('drillbook:routines', JSON.stringify(this.routines)); } catch (e) {} },
    async pushRoutine(r, withLocalImages) {
      if (this.mode !== 'cloud') return;
      try {
        await this.col().doc('r_' + r.id).set({ kind: 'routine', updatedAt: Date.now(), json: JSON.stringify(r) });
        if (withLocalImages) for (const k of r.imageKeys || []) { const d = (await IDB.get('img:' + k)) || this.localImg(k); if (d) await this.col().doc('i_' + k).set({ kind: 'img', rid: r.id, data: d }); }
      } catch (e) { console.warn('save failed', e); }
    },
    async save(r, images) {
      const i = this.routines.findIndex(x => x.id === r.id);
      if (i >= 0) this.routines[i] = r; else this.routines.unshift(r);
      this.localWriteList();
      if (images) for (const [k, d] of Object.entries(images)) { this.imgCache[k] = d; const ok = await IDB.set('img:' + k, d); if (ok === null) { try { localStorage.setItem('drillbook:img:' + k, d); } catch (e) {} } }
      if (this.mode === 'cloud') {
        await this.pushRoutine(r);
        if (images) for (const [k, d] of Object.entries(images)) { try { await this.col().doc('i_' + k).set({ kind: 'img', rid: r.id, data: d }); } catch (e) { console.warn('image save failed', e); } }
      }
    },
    async remove(r) {
      this.routines = this.routines.filter(x => x.id !== r.id); this.localWriteList();
      for (const k of r.imageKeys || []) { delete this.imgCache[k]; IDB.del('img:' + k); try { localStorage.removeItem('drillbook:img:' + k); } catch (e) {} }
      if (this.mode === 'cloud') {
        try { await this.col().doc('r_' + r.id).delete(); for (const k of r.imageKeys || []) await this.col().doc('i_' + k).delete(); } catch (e) {}
      }
    },
    localImg(k) { try { return localStorage.getItem('drillbook:img:' + k); } catch (e) { return null; } },
    async img(k) {
      if (!k) return null;
      if (this.imgCache[k]) return this.imgCache[k];
      let d = (await IDB.get('img:' + k)) || this.localImg(k);
      if (!d && this.mode === 'cloud') { try { const s = await this.col().doc('i_' + k).get(); d = s.exists ? s.data().data : null; } catch (e) {} }
      if (d) this.imgCache[k] = d;
      return d;
    },
  };

  // ---------- helpers ----------
  const fmtRange = r => !r ? '' : (r[0] === r[1] ? String(r[0]) : r[0] + '–' + r[1]);
  const fmtSec = s => s >= 60 ? (s % 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' min' : (s / 60) + ' min') : s + ' sec';
  const fmtSecRange = r => !r ? '' : (r[0] === r[1] ? fmtSec(r[0]) : (r[1] >= 60 && r[0] % 60 === 0 && r[1] % 60 === 0 ? (r[0] / 60) + '–' + (r[1] / 60) + ' min' : r[0] + '–' + r[1] + ' sec'));
  const clock = s => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : String(s); };
  function doseLabel(e) {
    const side = e.perSide ? ' each side' : '';
    if (e.seconds) return (e.sets > 1 ? e.sets + ' × ' : '') + fmtSecRange(e.seconds) + side;
    return (e.sets > 1 ? e.sets + ' sets × ' : '') + fmtRange(e.reps) + ' reps' + side;
  }
  function patternFor(e) { return Coach.norm(e.pattern) || Coach.pick(e.name, (e.steps || []).join(' ') + ' ' + (e.desc || '')); }
  function estimate(w) {
    let t = 0;
    const ex = w.exercises.filter(e => e.include !== false);
    ex.forEach((e, i) => {
      const sides = e.perSide ? 2 : 1;
      if (e.seconds) t += e.sets * sides * e.seconds[1] + (e.perSide ? 5 * e.sets : 0) + (e.sets - 1) * restSets(w, e);
      else t += e.sets * (e.reps[1] * Coach.cycle(patternFor(e)) * sides + 5) + (e.sets - 1) * restSets(w, e);
      if (i < ex.length - 1) t += restBetween(w, e);
    });
    return Math.round((t * (w.rounds || 1) + 10) / 60);
  }
  const restSets = (w, e) => e.restSets || (w.rest && w.rest.sets) || (e.seconds ? 10 : 45);
  const restBetween = (w, e) => e.restAfter || (w.rest && (w.rest.exercises || w.rest.sets)) || 10;
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  function fillThumbs(root) {
    for (const el of root.querySelectorAll('[data-thumb]')) {
      const id = el.getAttribute('data-thumb');
      Coach.thumb(id, 200).then(d => {
        if (!el.isConnected) return;
        if (d) el.innerHTML = '<img alt="" src="' + d + '">';
        else { el.innerHTML = '<canvas style="width:100%;height:100%"></canvas>'; Coach.still2d(el.firstChild, id); }
      });
    }
  }


  // ---------- views ----------
  const app = $('#app'), layer = $('#layer');
  let view = { name: 'home' };
  function go(v) { view = v; render(); window.scrollTo(0, 0); }

  function render() {
    if (view.name === 'home') return renderHome();
    const r = Store.routines.find(x => x.id === view.rid);
    if (!r) return go({ name: 'home' });
    if (view.name === 'routine') return renderRoutine(r);
    const w = r.workouts.find(x => x.id === view.wid);
    if (!w) return go({ name: 'routine', rid: r.id });
    renderWorkout(r, w);
  }

  function renderHome() {
    const rs = Store.routines;
    app.innerHTML = `<div class="wrap stack" style="gap:22px">
      <div class="topbar" style="margin:0"><div class="brand"><div class="brand-mark">${MARK}</div><span class="brand-name">Drillbook</span></div>
        <span class="small muted">${Store.mode === 'cloud' ? 'Saved to your account' : 'Saved on this device'}</span></div>
      <div class="hero"><h1>Your plan, coached move by move.</h1>
        <p class="muted">Upload any workout plan. Drillbook reads the exercises, sets, reps and timings, then walks you through it with a timer and a picture of each move.</p></div>
      <section class="drop" id="drop">
        <div class="addhead"><span class="drop-ic">${ICON.up}</span>
          <span><strong>Add a workout sheet</strong><span class="small muted">A PDF, Word file, text, or photos of a printed or handwritten page. Every sheet you add becomes its own routine.</span></span></div>
        <div class="addbtns">
          <label class="btn"><input type="file" id="file" multiple class="vh" aria-label="Choose a workout file">${ICON.doc}<span>Choose a file</span></label>
          <label class="btn ghost"><input type="file" id="cam" accept="image/*" capture="environment" class="vh" aria-label="Take a photo of a workout sheet">${ICON.cam}<span>Take a photo</span></label>
        </div>
        <div class="pages" id="pages" hidden></div>
      </section>
      <div class="pickrow" id="projPick" hidden><button class="btn ghost block" id="projBtn">Choose a plan you sent to Claude</button>
        <span class="small muted">Send the PDF in your Claude chat for this project, then pick it here. This works in the Claude app too.</span></div>
      <div style="margin-top:-12px"><button class="linkbtn small" id="paste">Or paste the workout as text</button></div>
      ${rs.length ? `<section class="stack"><div class="eyebrow">Your routines · ${rs.length}</div><div class="list">${rs.map(r => {
        const nEx = r.workouts.reduce((a, w) => a + w.exercises.length, 0);
        const firstEx = r.workouts[0] && r.workouts[0].exercises[0];
        return `<button class="rcard" data-r="${r.id}"><span class="thumb" data-thumb="${firstEx ? patternFor(firstEx) : 'stand'}" data-img="${firstEx && firstEx.imageKey || ''}"></span>
          <span style="min-width:0"><h3>${esc(r.title)}</h3><span class="meta">${r.workouts.length} workout${r.workouts.length > 1 ? 's' : ''} · ${nEx} exercises · from ${esc(r.fileName)}</span></span><span class="chev">${ICON.chev}</span></button>`;
      }).join('')}</div></section>` : `<section class="wcard"><div class="eyebrow">How it works</div><div class="howto">
        <div><b>1</b><span>Upload the plan your coach, doctor or app gave you.</span></div>
        <div><b>2</b><span>Check the exercise list. Tap any exercise to fix a number or switch it off.</span></div>
        <div><b>3</b><span>Press start and follow along. Timed moves count down on their own; rep sets wait for you to tap Done.</span></div></div></section>`}
    </div>`;
    const inp = $('#file'), drop = $('#drop'), cam = $('#cam');
    inp.onchange = () => { if (inp.files.length) { const fs = [...inp.files]; inp.value = ''; importFiles(pagesOf(fs)); } };
    cam.onchange = () => { if (cam.files.length) { shots.push(...cam.files); cam.value = ''; renderPages(); } };
    renderPages();
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const fs = [...e.dataTransfer.files]; if (fs.length) importFiles(fs); };
    $('#paste').onclick = pasteSheet;
    Proj.get().then(f => { const el = $('#projPick'); if (f && el) { el.hidden = false; $('#projBtn').onclick = projectSheet; } });
    app.querySelectorAll('[data-r]').forEach(b => b.onclick = () => openRoutine(b.getAttribute('data-r')));
    fillThumbs(app);
  }
  function openRoutine(id) {
    const r = Store.routines.find(x => x.id === id);
    if (r && r.workouts.length === 1) go({ name: 'workout', rid: id, wid: r.workouts[0].id, single: true });
    else go({ name: 'routine', rid: id });
  }

  function renderRoutine(r) {
    app.innerHTML = `<div class="wrap stack" style="gap:18px">
      <div class="topbar"><button class="iconbtn" id="back" aria-label="Back to routines">${ICON.back}</button><span class="small muted">${esc(r.fileName)}</span>
        <button class="iconbtn" id="more" aria-label="Routine options">${ICON.trash}</button></div>
      <div class="ov-head"><div class="eyebrow">Routine</div><h1>${esc(r.title)}</h1>
        <p class="intro">This plan has ${r.workouts.length} separate workouts. Pick one, or do them all in order.</p></div>
      <button class="btn block" id="all">Do all ${r.workouts.length} in order · about ${r.workouts.reduce((a, w) => a + estimate(w), 0)} min</button>
      <div class="list">${r.workouts.map(w => {
        const on = w.exercises.filter(e => e.include !== false);
        return `<div class="wcard"><div><div class="eyebrow">${on.length} exercises · about ${estimate(w)} min${w.rounds > 1 ? ' · ' + w.rounds + ' rounds' : ''}</div><h2>${esc(w.name)}</h2></div>
          ${w.intro ? `<p class="intro" style="margin:0">${esc(w.intro.length > 180 ? w.intro.slice(0, 177) + '…' : w.intro)}</p>` : ''}
          <div class="meta">${on.slice(0, 6).map(e => `<span class="pill">${esc(e.name)}</span>`).join('')}${on.length > 6 ? `<span class="pill">+${on.length - 6} more</span>` : ''}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-start="${w.id}">Start</button><button class="btn ghost" data-open="${w.id}">See exercises</button></div></div>`;
      }).join('')}</div>
      ${rereadBlock(r)}
    </div>`;
    $('#back').onclick = () => go({ name: 'home' });
    $('#more').onclick = () => deleteSheet(r);
    $('#all').onclick = () => startPlayer(r, null);
    app.querySelectorAll('[data-open]').forEach(b => b.onclick = () => go({ name: 'workout', rid: r.id, wid: b.getAttribute('data-open') }));
    app.querySelectorAll('[data-start]').forEach(b => b.onclick = () => startPlayer(r, r.workouts.find(w => w.id === b.getAttribute('data-start'))));
    wireReread(r);
  }
  function rereadBlock(r) {
    return `<div class="small muted" id="reread" hidden>Something missing or wrong? <button class="linkbtn" id="rereadBtn">Read the file again with Claude</button></div>`;
  }
  function wireReread(r) {
    if (!r.lines || !r.lines.length) return;
    Smart.get().then(s => { const el = $('#reread'); if (s && el) { el.hidden = false; $('#rereadBtn').onclick = () => smartReread(r); } });
  }

  function renderWorkout(r, w) {
    const exs = w.exercises;
    const on = exs.filter(e => e.include !== false);
    app.innerHTML = `<div class="wrap">
      <div class="topbar"><button class="iconbtn" id="back" aria-label="Back">${ICON.back}</button><span class="small muted" style="text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(view.single ? r.fileName : r.title)}</span>
        ${view.single ? `<button class="iconbtn" id="more" aria-label="Routine options">${ICON.trash}</button>` : '<span style="width:40px"></span>'}</div>
      <div class="ov-head"><div class="eyebrow">${on.length} exercises · about ${estimate(w)} min${w.rounds > 1 ? ' · ' + w.rounds + ' rounds' : ''}</div>
        <h1>${esc(w.name)}</h1>${w.intro ? `<p class="intro" style="margin:0">${esc(w.intro)}</p>` : ''}
        <div class="meta" style="display:flex;gap:6px;flex-wrap:wrap">${w.rest && w.rest.sets ? `<span class="pill">Rest ${w.rest.sets} s between sets</span>` : ''}${w.rest && w.rest.exercises && w.rest.exercises !== w.rest.sets ? `<span class="pill">Rest ${w.rest.exercises} s between exercises</span>` : ''}</div></div>
      <div>${exs.map((e, i) => `<button class="row ${e.include === false ? 'off' : ''}" data-i="${i}">
        <span class="thumb" data-thumb="${patternFor(e)}" data-img="${e.imageKey || ''}"></span>
        <span style="min-width:0"><span class="nm">${e.code ? `<span class="code">${esc(e.code)}</span>` : ''}${esc(e.name)}</span>
          <span class="dose">${esc(doseLabel(e))}</span>${e.muscles ? `<span class="mus"> · ${esc(e.muscles)}</span>` : ''}
          ${e.note ? `<div style="margin-top:4px"><span class="pill warn">${esc(e.note)}${e.include === false ? ' · off' : ''}</span></div>` : ''}</span>
        <span class="chev">${ICON.chev}</span></button>`).join('')}</div>
      <p class="small muted" style="margin-top:14px">Tap an exercise to see how to do it, change its numbers, or switch it off.</p>
      ${view.single ? rereadBlock(r) : ''}
    </div>
    <div class="dock"><button class="btn" id="start" ${on.length ? '' : 'disabled'}>Start workout</button></div>`;
    $('#back').onclick = () => view.single ? go({ name: 'home' }) : go({ name: 'routine', rid: r.id });
    if (view.single) { $('#more').onclick = () => deleteSheet(r); wireReread(r); }
    $('#start').onclick = () => startPlayer(r, w);
    app.querySelectorAll('[data-i]').forEach(b => b.onclick = () => exerciseSheet(r, w, +b.getAttribute('data-i')));
    fillThumbs(app);
  }

  // ---------- sheets ----------
  function sheet(html, onMount) {
    layer.innerHTML = `<div class="sheet-bg" id="sbg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    const bg = $('#sbg');
    bg.onclick = e => { if (e.target === bg) closeSheet(); };
    onMount && onMount(bg);
  }
  function closeSheet() { layer.innerHTML = ''; }

  function exerciseSheet(r, w, i) {
    const e = w.exercises[i];
    const pat = patternFor(e);
    sheet(`<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><div class="eyebrow">${e.code ? esc(e.code) + ' · ' : ''}${esc(doseLabel(e))}</div><h2>${esc(e.name)}</h2>${e.muscles ? `<div class="small muted">${esc(e.muscles)}</div>` : ''}</div>
        <button class="iconbtn" id="x" aria-label="Close">${ICON.close}</button></div>
      <div class="fig-box" id="fb"></div>
      ${e.imageKey ? `<div style="display:flex;gap:8px"><button class="pill" id="showFig" style="border:0">Animated coach</button><button class="pill" id="showImg" style="border:0;opacity:.6">Drawing from your file</button></div>` : ''}
      ${e.desc ? `<p style="margin:0">${esc(e.desc)}</p>` : ''}
      ${e.steps && e.steps.length ? `<ol>${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${(e.tips || []).map(t => `<div class="tip">${esc(t)}</div>`).join('')}
      <div class="eyebrow" style="margin-top:6px">Adjust</div>
      <label class="check"><input type="checkbox" id="inc" ${e.include !== false ? 'checked' : ''}> Include in this workout</label>
      <div class="fields">
        <label class="field">Sets<input id="fSets" type="number" inputmode="numeric" min="1" max="20" value="${e.sets}"></label>
        <label class="field">Counted by<select id="fType"><option value="reps" ${e.reps ? 'selected' : ''}>Reps</option><option value="time" ${e.seconds ? 'selected' : ''}>Time (sec)</option></select></label>
        <label class="field" id="lMin">${e.seconds ? 'Seconds' : 'Reps (low)'}<input id="fMin" type="number" inputmode="numeric" min="1" value="${e.seconds ? e.seconds[1] : e.reps[0]}"></label>
        <label class="field" id="lMax" ${e.seconds ? 'hidden' : ''}>Reps (high)<input id="fMax" type="number" inputmode="numeric" min="1" value="${e.reps ? e.reps[1] : ''}"></label>
      </div>
      <label class="check"><input type="checkbox" id="side" ${e.perSide ? 'checked' : ''}> Do each side separately</label>
      <label class="field">Figure to show<select id="fPat">${Coach.ids.map(p => [p, Coach.label(p)]).sort((a, b) => a[1].localeCompare(b[1])).map(([p, l]) => `<option value="${p}" ${p === pat ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <button class="btn block" id="save">Save changes</button>`, () => {
      let mode = 'fig';
      const fb = $('#fb');
      const show = async () => {
        if (mode === 'img') { const d = await Store.img(e.imageKey); fb.innerHTML = d ? `<img alt="Drawing of ${esc(e.name)} from your file" src="${d}">` : ''; }
        else { fb.innerHTML = ''; Coach.mount(fb, $('#fPat').value, { label: 'Moving figure showing ' + e.name }); }
        if ($('#showImg')) { $('#showImg').style.opacity = mode === 'img' ? 1 : .6; $('#showFig').style.opacity = mode === 'fig' ? 1 : .6; }
      };
      show();
      if ($('#showImg')) { $('#showImg').onclick = () => { mode = 'img'; show(); }; $('#showFig').onclick = () => { mode = 'fig'; show(); }; }
      $('#fPat').onchange = () => { if (mode === 'fig') show(); };
      $('#fType').onchange = () => { const t = $('#fType').value; $('#lMax').hidden = t === 'time'; $('#lMin').firstChild.textContent = t === 'time' ? 'Seconds' : 'Reps (low)'; };
      $('#x').onclick = closeSheet;
      $('#save').onclick = async () => {
        const sets = Math.max(1, Math.min(20, parseInt($('#fSets').value, 10) || 1));
        const t = $('#fType').value, a = Math.max(1, parseInt($('#fMin').value, 10) || 1);
        e.sets = sets; e.include = $('#inc').checked; e.perSide = $('#side').checked; e.pattern = $('#fPat').value;
        if (t === 'time') { e.seconds = [a, a]; e.reps = null; }
        else { const b = Math.max(a, parseInt($('#fMax').value, 10) || a); e.reps = [a, b]; e.seconds = null; }
        closeSheet(); render(); toast('Saved'); await Store.save(r);
      };
    });
  }

  function deleteSheet(r) {
    sheet(`<h2>Delete this routine?</h2><p class="muted" style="margin:0">"${esc(r.title)}" and its pictures will be removed. Your original file is not affected.</p>
      <div style="display:flex;gap:10px"><button class="btn ghost" id="no" style="flex:1">Keep it</button><button class="btn" id="yes" style="flex:1;background:var(--danger);color:#fff">Delete</button></div>`, () => {
      $('#no').onclick = closeSheet;
      $('#yes').onclick = async () => { closeSheet(); await Store.remove(r); go({ name: 'home' }); toast('Routine deleted'); };
    });
  }

  function pasteSheet() {
    sheet(`<h2>Paste a workout</h2><p class="small muted" style="margin:0">One exercise per line works best, for example "Squats – 3 x 12" or "Plank 45 sec".</p>
      <label class="field">Title<input id="pt" value="My workout"></label>
      <label class="field">Workout text<textarea id="pb" rows="9" placeholder="Warm-up&#10;Jumping jacks 60 sec&#10;&#10;Main&#10;Push-ups 3 x 10&#10;Lunges 3 x 12 per leg"></textarea></label>
      <button class="btn block" id="go">Make routine</button>`, () => {
      $('#go').onclick = () => {
        const txt = $('#pb').value.trim(); if (!txt) return;
        const title = $('#pt').value.trim() || 'My workout';
        closeSheet();
        importFile(new File(['# ' + title + '\n' + txt], title + '.txt', { type: 'text/plain' }));
      };
    });
  }

  // ---------- project files (plans sent to Claude in this project) ----------
  const Proj = {
    p: null,
    get() { if (!this.p) this.p = (window.claude && window.claude.use) ? window.claude.use('files').catch(() => null) : Promise.resolve(null); return this.p; },
  };
  function sniff(b) {
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
    if (b[0] === 0x50 && b[1] === 0x4b) return 'docx';
    if ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50)) return 'image';
    let ok = 0; for (const c of b) if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127) || c >= 0xc2) ok++;
    return b.length && ok / b.length > 0.95 ? 'text' : null;
  }
  async function projectSheet() {
    const files = await Proj.get();
    sheet(`<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><div class="eyebrow">From this project</div><h2>Choose a plan</h2></div><button class="iconbtn" id="x" aria-label="Close">${ICON.close}</button></div>
      <div id="plist" class="list"><p class="muted" style="margin:0">Looking for files…</p></div>`, () => { $('#x').onclick = closeSheet; });
    const list = $('#plist');
    try {
      let entries = [], cursor;
      do { const r = await files.list({ recursive: true, cursor }); entries = entries.concat(r.entries); cursor = r.cursor; } while (cursor && entries.length < 1500);
      entries = entries.filter(e => !e.isDirectory && !/^drillbook\//.test(e.path) && e.size > 20 && e.size < 30e6);
      entries.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      const found = []; const sizes = new Set();
      for (const e of entries.slice(0, 40)) {
        let kind = null;
        const ext = (e.path.match(/\.([a-z0-9]+)$/i) || [])[1];
        if (ext) kind = /^pdf$/i.test(ext) ? 'pdf' : /^docx$/i.test(ext) ? 'docx' : /^(txt|md|markdown)$/i.test(ext) ? 'text' : null;
        else { try { kind = sniff((await files.read(e.path, { length: 16 })).bytes); } catch (err) { if (err && err.code === 'not_granted') throw err; } }
        if (!kind || kind === 'image') continue;
        const key = kind + ':' + e.size; if (sizes.has(key)) continue; sizes.add(key);
        found.push(Object.assign({ kind }, e));
      }
      if (!found.length) { list.innerHTML = '<p class="muted" style="margin:0">No PDF, Word or text files here yet. Send your workout file in the Claude chat for this project, then come back and tap this again.</p>'; return; }
      list.innerHTML = found.map((f, k) => `<button class="rcard" data-pf="${k}"><span class="thumb" style="font-family:var(--display);font-weight:800;color:#0c6b61">${f.kind === 'pdf' ? 'PDF' : f.kind === 'docx' ? 'DOC' : 'TXT'}</span>
        <span style="min-width:0"><h3 data-ttl="${k}">${esc(niceName(f))}</h3><span class="meta">${Math.max(1, Math.round(f.size / 1024))} KB${f.createdAt ? ' · ' + new Date(f.createdAt).toLocaleDateString() : ''}</span></span><span class="chev">${ICON.chev}</span></button>`).join('');
      list.querySelectorAll('[data-pf]').forEach(b => b.onclick = async () => {
        const f = found[+b.getAttribute('data-pf')];
        closeSheet(); busy('Opening your plan', '');
        try {
          const parts = []; let off = 0, size = f.size;
          while (off < size) { const r = await files.read(f.path, { offset: off, length: 25 * 1024 * 1024 }); parts.push(r.bytes); off += r.bytes.length; size = r.size; if (!r.bytes.length) break; }
          const ext = f.kind === 'pdf' ? '.pdf' : f.kind === 'docx' ? '.docx' : '.txt';
          let name = f.title || niceName(f); if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += ext;
          importFile(new File(parts, name, { type: f.kind === 'pdf' ? 'application/pdf' : '' }));
        } catch (err) { busy(null); errorSheet('That file could not be opened (' + (err && err.code || 'error') + '). Try again in a moment.'); }
      });
      // fill in real titles for unnamed PDFs
      for (const [k, f] of found.entries()) {
        if (f.kind !== 'pdf' || /\.pdf$/i.test(f.path)) continue;
        try {
          const r = await files.read(f.path); const lib = await Reader.pdfLib();
          const doc = await lib.getDocument({ data: r.bytes, isEvalSupported: false }).promise;
          const meta = await doc.getMetadata().catch(() => null);
          let t = meta && meta.info && meta.info.Title;
          if (!t) { const tc = await (await doc.getPage(1)).getTextContent(); t = (tc.items.find(i => i.str.trim()) || {}).str; }
          if (t) { f.title = t.trim().slice(0, 80); const h = list.querySelector('[data-ttl="' + k + '"]'); if (h) h.textContent = f.title; }
        } catch (e) {}
      }
    } catch (err) {
      list.innerHTML = `<div class="err">${err && err.code === 'not_granted' ? 'Drillbook was not allowed to see this project’s files.' : 'Could not list the project’s files right now. Try again in a moment.'}</div>`;
    }
  }
  function niceName(f) {
    const base = f.path.split('/').pop();
    if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(base)) return f.kind === 'pdf' ? 'PDF you sent' : f.kind === 'docx' ? 'Word file you sent' : 'Text file you sent';
    return base.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ');
  }

  // ---------- import ----------
  let busyFig = null;
  function busy(msg, sub) {
    if (!msg) { layer.innerHTML = ''; return; }
    if (!$('#busy')) {
      layer.innerHTML = `<div class="busy" id="busy" role="status" aria-live="polite"><div><div id="bfig" style="width:220px;height:170px;margin:0 auto"></div><h2 id="bmsg"></h2><p id="bsub" style="color:var(--court-dim);margin:0"></p><div id="bx" style="margin-top:16px"></div></div></div>`;
      busyFig = Coach.mount($('#bfig'), 'squat', { flat: true, colors: { body: '#f4f7f5', far: '#5f8a82', floor: '#2a5a53' } });
    }
    $('#bmsg').textContent = msg; $('#bsub').textContent = sub || '';
  }

  function prepare(parsed, read, fileName, source) {
    const images = {}; const imageKeys = [];
    const rid = uid();
    if (read.images && read.images.length) {
      Reader.attachImages(parsed.workouts, read.images);
      parsed.workouts.forEach(w => w.exercises.forEach(e => {
        if (e.imageIdx != null) { const k = rid + '_' + e.imageIdx; e.imageKey = k; if (!images[k]) { images[k] = read.images[e.imageIdx].data; imageKeys.push(k); } }
        delete e.imageIdx;
      }));
    }
    parsed.workouts.forEach((w, wi) => {
      w.id = w.id || 'w' + wi;
      w.exercises.forEach(e => {
        e.include = !e.optional;
        if (!e.reps && !e.seconds) e.reps = [10, 10];
        if (!e.breath) e.breath = Parser.breathCue((e.steps || []).join(' ') + ' ' + e.name);
        if (!e.pattern) e.pattern = Coach.pick(e.name, (e.steps || []).join(' ') + ' ' + (e.desc || ''));
      });
    });
    const lines = (read.lines || []).slice(0, 2500).map(l => ({ text: l.text, page: l.page, y: Math.round(l.y * 10) / 10, x: Math.round(l.x), size: l.size }));
    const imgMeta = (read.images || []).map((im, k) => ({ k, page: im.page, x0: im.x0, y0: im.y0, x1: im.x1, y1: im.y1 }));
    const title = (parsed.title && parsed.title !== fileName ? parsed.title : fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ')).slice(0, 90);
    return { routine: { id: rid, title, fileName, createdAt: Date.now(), source, workouts: parsed.workouts, imageKeys, lines: JSON.stringify(lines).length < 180000 ? lines : [], imgMeta }, images };
  }

  // several photos (pages of one plan) become one routine; other files are imported one by one
  // photos taken one page at a time collect here until the person taps "Read"
  let shots = [];
  function pagesOf(fs) { // photos picked from the gallery join pages already taken
    const imgs = fs.filter(isImg);
    if (shots.length && imgs.length === fs.length) { const all = shots.concat(imgs); shots = []; return all; }
    return fs;
  }
  function isImg(f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name || ''); }
  function renderPages() {
    const el = $('#pages'); if (!el) return;
    el.hidden = !shots.length; if (!shots.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="pagestrip">${shots.map((f, i) => `<span class="pg"><img alt="Page ${i + 1}" data-pg="${i}"><button class="pgx" data-rm="${i}" aria-label="Remove page ${i + 1}">×</button></span>`).join('')}</div>
      <div class="small muted">${shots.length} page${shots.length > 1 ? 's' : ''} ready. Add every page of the sheet, then read them together.</div>
      <div class="addbtns"><label class="btn ghost"><input type="file" id="cam2" accept="image/*" capture="environment" class="vh">${ICON.cam}<span>Add a page</span></label>
        <button class="btn" id="readPages">Read ${shots.length} page${shots.length > 1 ? 's' : ''}</button></div>`;
    el.querySelectorAll('[data-pg]').forEach(img => { const u = URL.createObjectURL(shots[+img.getAttribute('data-pg')]); img.src = u; img.onload = () => URL.revokeObjectURL(u); });
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { shots.splice(+b.getAttribute('data-rm'), 1); renderPages(); });
    const c2 = $('#cam2'); c2.onchange = () => { if (c2.files.length) { shots.push(...c2.files); renderPages(); } };
    $('#readPages').onclick = () => { const fs = shots; shots = []; renderPages(); importFiles(fs); };
  }
  async function importFiles(files) {
    const imgs = files.filter(isImg);
    if (imgs.length >= 1 && imgs.length === files.length) return importFile(imgs, true);
    if (imgs.length > 1) return importFile(imgs, true);
    for (const f of files) await importFile(f);
  }
  async function importFile(file, many) {
    if (many) {
      try { return await importPhotos(file); }
      catch (e) { console.error(e); busy(null); errorSheet('Something went wrong while reading these photos (' + (e && e.message || e) + '). Try again, or paste the workout as text.'); return; }
    }
    try { await importFile0(file); }
    catch (e) { console.error(e); busy(null); errorSheet('Something went wrong while reading this file (' + (e && e.message || e) + '). Try again, or paste the workout as text.'); }
  }
  async function importPhotos(files) {
    busy('Reading your photos', files.length + ' pages');
    const shots = [];
    for (let i = 0; i < files.length && i < 10; i++) { busy('Preparing the photos', 'Page ' + (i + 1) + ' of ' + files.length); shots.push(await Reader.shrink(files[i])); }
    const s = await Smart.get();
    if (!s) { busy(null); errorSheet('Photos and handwriting are read by Claude. Open Drillbook inside the Claude app or on claude.ai to read them, or paste the workout as text.'); return; }
    busy('Asking Claude to read it', 'Reading ' + shots.length + ' photos. This can take up to a minute.');
    const name = (files[0].name || 'Photos').replace(/\.[a-z0-9]+$/i, '') + (files.length > 1 ? ' + ' + (files.length - 1) + ' more' : '');
    let parsed;
    try { parsed = await Smart.read([], name, shots); } catch (e) { busy(null); errorSheet(smartErr(e)); return; }
    if (!parsed.workouts.length) { busy(null); errorSheet('Claude could not find exercises with sets, reps or times in these photos. Try clearer photos taken straight on, or paste the workout as text.'); return; }
    busy('Saving your routine', '');
    const { routine, images } = prepare(parsed, { lines: [], images: [], pageShots: [] }, name, 'claude');
    await Promise.race([Store.save(routine, images), new Promise(r => setTimeout(r, 4000))]);
    busy(null); openRoutine(routine.id);
    const n = routine.workouts.reduce((a, w) => a + w.exercises.length, 0);
    toast(`Found ${n} exercises in ${routine.workouts.length} workout${routine.workouts.length > 1 ? 's' : ''}`);
  }
  async function importFile0(file) {
    busy('Reading your plan', file.name);
    let read;
    try {
      read = await Reader.readFile(file, s => busy('Reading your plan', s));
    } catch (e) { busy(null); errorSheet(e.message || 'This file could not be opened.'); return; }
    busy('Finding the exercises', '');
    let parsed = Parser.parse(read.lines, { fileName: file.name });
    let source = 'auto';
    const count = parsed.workouts.reduce((a, w) => a + w.exercises.length, 0);
    if (!count || read.kind === 'image') {
      const s = await Smart.get();
      if (!s && read.kind === 'image') { busy(null); errorSheet('Photos and handwriting are read by Claude. Open Drillbook inside the Claude app or on claude.ai to read them, or paste the workout as text.'); return; }
      if (s) {
        busy('Asking Claude to read it', 'This can take up to a minute.');
        try { parsed = await Smart.read(read.lines, file.name, read.pageShots); source = 'claude'; }
        catch (e) { busy(null); errorSheet(smartErr(e)); return; }
      }
    }
    if (!parsed.workouts.length) {
      busy(null);
      errorSheet(read.lines.length ? 'No exercises with sets, reps or times were found in this file. If it is a scan or photo, open this page in the Claude app or claude.ai so Claude can read it, or paste the workout as text.' : 'This file has no readable text. Open this page in the Claude app or claude.ai so Claude can read scans and photos, or paste the workout as text.');
      return;
    }
    busy('Saving your routine', '');
    const { routine, images } = prepare(parsed, read, file.name, source);
    // save in the background so a slow connection never blocks opening the routine
    await Promise.race([Store.save(routine, images), new Promise(r => setTimeout(r, 4000))]);
    busy(null);
    openRoutine(routine.id);
    const n = routine.workouts.reduce((a, w) => a + w.exercises.length, 0);
    toast(`Found ${n} exercises in ${routine.workouts.length} workout${routine.workouts.length > 1 ? 's' : ''}`);
  }
  function smartErr(e) {
    const c = e && e.code;
    if (c === 'not_granted') return 'Claude was not allowed to read the file, so nothing changed.';
    if (c === 'rate_limited') return 'Claude is busy right now. Wait a minute and try again.';
    if (c === 'cancelled') return 'Stopped.';
    if (c === 'images_unavailable') return 'Claude cannot look at pictures in this view. Open Drillbook in the Claude app or on claude.ai, or paste the workout as text.';
    return 'Claude could not read this file. Try again, or paste the workout as text.';
  }
  function errorSheet(msg) {
    sheet(`<h2>Could not make a routine</h2><div class="err">${esc(msg)}</div><div style="display:flex;gap:10px"><button class="btn ghost" id="pasteIt" style="flex:1">Paste text instead</button><button class="btn" id="ok" style="flex:1">OK</button></div>`, () => {
      $('#ok').onclick = closeSheet; $('#pasteIt').onclick = pasteSheet;
    });
  }
  async function smartReread(r) {
    busy('Asking Claude to read it again', 'This can take up to a minute.');
    try {
      const parsed = await Smart.read(r.lines, r.fileName, null);
      if (!parsed.workouts.length) throw { code: 'bad_answer' };
      // reuse stored drawings: re-match by position
      const imgs = (r.imgMeta || []).map(m => Object.assign({}, m));
      if (imgs.length) Reader.attachImages(parsed.workouts, imgs);
      parsed.workouts.forEach((w, wi) => { w.id = 'w' + wi; w.exercises.forEach(e => {
        if (e.imageIdx != null) { const k = r.id + '_' + imgs[e.imageIdx].k; if ((r.imageKeys || []).includes(k)) e.imageKey = k; delete e.imageIdx; }
        e.include = !e.optional; if (!e.reps && !e.seconds) e.reps = [10, 10];
        e.breath = e.breath || Parser.breathCue((e.steps || []).join(' ') + ' ' + e.name);
        if (!e.pattern) e.pattern = Coach.pick(e.name, (e.steps || []).join(' '));
      }); });
      r.workouts = parsed.workouts; r.source = 'claude'; if (parsed.title) r.title = parsed.title;
      await Store.save(r);
      busy(null); openRoutine(r.id); toast('Updated from Claude’s reading');
    } catch (e) { busy(null); errorSheet(smartErr(e)); }
  }

  // ---------- player ----------
  let P = null;
  function buildSteps(w) {
    const exs = w.exercises.filter(e => e.include !== false);
    const steps = [];
    const rounds = w.rounds || 1;
    let n = 0;
    for (let r = 1; r <= rounds; r++) {
      exs.forEach((e, k) => {
        n++;
        const base = { ex: e, idx: k, round: r, rounds, num: n };
        if (!steps.length) steps.push(Object.assign({ type: 'ready', dur: 10 }, base));
        for (let s = 1; s <= e.sets; s++) {
          if (e.seconds) {
            const sides = e.perSide ? ['Right side', 'Left side'] : [null];
            sides.forEach((side, si) => {
              steps.push(Object.assign({ type: 'timed', dur: e.seconds[1], set: s, side }, base));
              if (si < sides.length - 1) steps.push(Object.assign({ type: 'switch', dur: 5, set: s, nextSide: sides[si + 1] }, base));
            });
          } else {
            const sides = e.perSide && !Coach.info(patternFor(e)).alt ? ['Right side', 'Left side'] : [null];
            sides.forEach((side, si) => {
              steps.push(Object.assign({ type: 'reps', set: s, side }, base));
              if (si < sides.length - 1) steps.push(Object.assign({ type: 'switch', dur: 5, set: s, nextSide: sides[si + 1] }, base));
            });
          }
          if (s < e.sets) steps.push(Object.assign({ type: 'rest', dur: restSets(w, e), set: s, sameEx: true }, base));
        }
        const last = k === exs.length - 1 && r === rounds;
        if (!last) {
          const nextEx = k < exs.length - 1 ? exs[k + 1] : exs[0];
          const dur = k === exs.length - 1 ? ((w.rest && w.rest.rounds) || 60) : restBetween(w, e);
          steps.push({ type: 'rest', dur, ex: nextEx, idx: k < exs.length - 1 ? k + 1 : 0, round: k === exs.length - 1 ? r + 1 : r, rounds, num: n + 1, upNext: true, roundBreak: k === exs.length - 1 });
        }
      });
    }
    steps.forEach(st => { st.pos = ((st.num - 1) % exs.length) + 1; st.of = exs.length; });
    return { steps, total: n, perRound: exs.length };
  }
  function buildAll(r) {
    const ws = r.workouts.filter(w => w.exercises.some(e => e.include !== false));
    let steps = [], total = 0;
    ws.forEach((w, wi) => {
      const b = buildSteps(w);
      b.steps.forEach(st => { st.num += total; st.part = w.name; });
      if (wi > 0) {
        const first = b.steps.find(x => x.type !== 'ready');
        b.steps[0] = { type: 'rest', dur: 30, ex: first.ex, idx: 0, round: 1, rounds: first.rounds, num: total + 1, upNext: true, partBreak: w.name };
      }
      steps = steps.concat(b.steps); total += b.total;
    });
    steps.forEach(st => { st.pos = st.num; st.of = total; });
    return { steps, total, perRound: total };
  }

  // sound + voice
  let actx = null;
  function beep(f, d, v) {
    if (!prefs.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.type = 'sine'; g.gain.value = v || 0.18;
      o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime; g.gain.setValueAtTime(v || 0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o.stop(t + d + 0.02);
    } catch (e) {}
  }
  function say(text) {
    if (!prefs.voice || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; speechSynthesis.speak(u); } catch (e) {}
  }
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  let wake = null;
  async function keepAwake() { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (P && document.visibilityState === 'visible') keepAwake(); });

  function startPlayer(r, w) {
    const { steps, total, perRound } = w ? buildSteps(w) : buildAll(r);
    if (!w) w = { name: r.title, exercises: [] };
    if (!steps.length) return;
    P = { r, w, steps, total, perRound, i: 0, left: 0, paused: false, last: performance.now(), started: Date.now(), showFig: {}, count: 0, counting: false, how: false, done: 0 };
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch (e) {}
    keepAwake();
    layer.innerHTML = '<div class="player" id="player" role="dialog" aria-label="Workout player"></div>';
    enter(0);
    requestAnimationFrame(tick);
  }
  function exitPlayer() {
    P = null; layer.innerHTML = '';
    try { speechSynthesis.cancel(); } catch (e) {}
    try { wake && wake.release(); } catch (e) {}
    wake = null; render();
  }
  function enter(i) {
    P.i = i; P.count = 0; P.counting = false; P.how = false;
    const s = P.steps[i];
    if (!s) return finish();
    P.left = s.dur || 0; P.dur = s.dur || 0; P.stepStart = performance.now(); P.lastBeep = null;
    drawStep();
    const e = s.ex;
    if (s.type === 'ready') say('Get ready. ' + e.name + '.');
    else if (s.type === 'timed') { say(s.side && s.set === 1 && s.side === 'Right side' ? e.name + '. Right side. Go.' : s.side ? 'Left side. Go.' : (s.set > 1 ? 'Set ' + s.set + '. Go.' : e.name + '. Go.')); beep(880, 0.25); buzz(80); }
    else if (s.type === 'reps') { say(e.name + '. ' + (e.sets > 1 ? 'Set ' + s.set + ' of ' + e.sets + '. ' : '') + spokenReps(e)); beep(880, 0.25); buzz(80); }
    else if (s.type === 'switch') say('Switch sides.');
    else if (s.type === 'rest') say(s.upNext ? (s.roundBreak ? 'Round complete. Rest. ' : 'Rest. ') + 'Up next, ' + e.name + '.' : 'Rest.');
  }
  function spokenReps(e) { const a = e.reps[0], b = e.reps[1]; return (a === b ? a : a + ' to ' + b) + ' reps' + (e.perSide ? ' each side.' : '.'); }

  function visHTML(s, e) {
    return `<div class="vis" id="vis">${e.imageKey ? `<button class="swap" id="swap">${P.showFig[e.name] ? 'Show animated coach' : 'Show drawing from file'}</button>` : ''}<div id="visIn"></div>${s.type === 'timed' || s.type === 'switch' ? '<div class="bar"><b id="vbar"></b></div>' : ''}${e.breath && s.type === 'timed' ? '<div class="breath" id="breath">Breathe in</div>' : ''}</div>`;
  }
  async function mountVis(s, e) {
    const box = $('#visIn'); if (!box) return;
    const useImg = e.imageKey && P.showFig[e.name];
    if (useImg) {
      const d = await Store.img(e.imageKey);
      if (d && $('#visIn') === box) { box.innerHTML = `<img alt="How to do ${esc(e.name)}" src="${d}">`; return; }
    }
    box.innerHTML = '';
    const pat = patternFor(e), inf = Coach.info(pat);
    const side = s.side === 'Right side' ? 'R' : s.side === 'Left side' ? 'L' : null;
    Coach.mount(box, pat, {
      side, label: 'Moving figure showing ' + e.name,
      timeFn: now => {
        if (!P) return 0;
        let t = (now - (P.counting && s.type === 'reps' ? P.countT : P.stepStart)) / 1000;
        if (P.paused && P.pauseAt) t = (P.pauseAt - P.stepStart) / 1000;
        if (inf.breath && e.breath && s.type === 'timed') { const cyc = e.breath.in + e.breath.out, u = t % cyc; return u < e.breath.in ? 4 * u / e.breath.in : 4 + 6 * (u - e.breath.in) / e.breath.out; }
        return t;
      },
    });
  }

  function drawStep() {
    const el = $('#player'); if (!el) return;
    const s = P.steps[P.i], e = s.ex;
    const isRest = s.type === 'rest' || s.type === 'ready' || s.type === 'switch';
    el.classList.toggle('is-rest', s.type === 'rest' || s.type === 'ready');
    const exNum = s.pos;
    const head = `<div class="ptop"><button class="pbtn" id="pclose" aria-label="End workout">${ICON.close}</button>
      <span class="pcount">${s.type === 'rest' && s.upNext ? 'Up next · ' : ''}${exNum} of ${s.of}${s.rounds > 1 ? ' · Round ' + s.round + '/' + s.rounds : ''}</span>
      <button class="pbtn" id="psound" aria-label="${prefs.sound ? 'Mute' : 'Unmute'}">${prefs.sound ? ICON.sound : ICON.mute}</button></div>
      <div class="pbar">${Array.from({ length: P.total }, (_, k) => `<i><b data-seg="${k}"></b></i>`).join('')}</div>`;
    let mid = '', read = '', ctl = '';
    const setTxt = e.sets > 1 ? `Set ${s.set} of ${e.sets}` : '';
    if (s.type === 'rest' && s.upNext) {
      mid = `<div class="pname"><h2>${s.partBreak ? 'Part done. Rest' : s.roundBreak ? 'Round done. Rest' : 'Rest'}</h2><div class="sub">${s.partBreak ? 'Next: ' + esc(s.partBreak) : 'Next: ' + esc(e.name)}</div></div>
        <div class="stage" style="align-content:center;gap:14px"><div class="readout"><div class="big" id="clock">${clock(P.left)}</div></div>
        <div class="upnext"><span class="thumb" id="unThumb"></span><span><b>${esc(e.name)}</b><div class="small" style="color:var(--chalk)">${esc(doseLabel(e))}</div>${e.steps && e.steps[0] ? `<div class="first">${esc(e.steps[0])}</div>` : ''}</span></div></div>`;
      ctl = `<div class="pctl"><button class="side" id="pprev" aria-label="Previous">${ICON.prev}</button><button class="main" id="pmain">Skip rest</button><button class="side" id="pnext" aria-label="Next">${ICON.next}</button></div>
        <div class="extra"><button id="plus">+15 sec</button><button id="phow">How to do it</button></div>`;
    } else {
      let sub = '';
      if (s.type === 'ready') sub = 'Get ready · ' + doseLabel(e);
      else if (s.type === 'switch') sub = 'Switch to the ' + (s.nextSide || 'other side').toLowerCase();
      else if (s.type === 'rest') sub = 'Rest before set ' + (s.set + 1) + ' of ' + e.sets;
      else sub = [setTxt, s.side].filter(Boolean).join(' · ') || doseLabel(e);
      mid = `<div class="pname"><h2>${esc(e.name)}</h2><div class="sub">${esc(sub)}</div></div><div class="stage">${visHTML(s, e)}</div>`;
      if (s.type === 'reps') {
        const rr = fmtRange(e.reps);
        read = `<div class="readout"><div class="big" id="clock">${P.counting ? P.count : rr}<small>${P.counting ? 'of ' + rr : 'reps'}${e.perSide && !P.counting ? ' each side' : ''}</small></div>${dots(s, e)}</div>`;
        ctl = `<div class="pctl"><button class="side" id="pprev" aria-label="Previous">${ICON.prev}</button><button class="main" id="pmain">Done</button><button class="side" id="pnext" aria-label="Next">${ICON.next}</button></div>
          <div class="extra"><button id="pcount" class="${P.counting ? 'on' : ''}">${P.counting ? 'Stop counting' : 'Count reps for me'}</button><button id="phow">How to do it</button></div>`;
      } else {
        read = `<div class="readout"><div class="big" id="clock">${clock(P.left)}</div>${s.type === 'timed' ? dots(s, e) : '<div class="dots"></div>'}</div>`;
        ctl = `<div class="pctl"><button class="side" id="pprev" aria-label="Previous">${ICON.prev}</button><button class="main" id="pmain">${P.paused ? 'Resume' : (isRest ? 'Start now' : 'Pause')}</button><button class="side" id="pnext" aria-label="Next">${ICON.next}</button></div>
          <div class="extra">${isRest ? '<button id="plus">+15 sec</button>' : ''}<button id="phow">How to do it</button></div>`;
      }
    }
    el.innerHTML = head + mid + read + ctl + (P.how ? howHTML(e) : '');
    // events
    $('#pclose').onclick = () => confirmExit();
    $('#psound').onclick = () => { prefs.sound = !prefs.sound; prefs.voice = prefs.sound; savePrefs(); if (!prefs.sound) try { speechSynthesis.cancel(); } catch (e) {} drawStep(); };
    $('#pprev').onclick = () => jump(-1);
    $('#pnext').onclick = () => jump(1);
    $('#pmain').onclick = () => {
      if (s.type === 'reps' || isRest) { completeStep(); return; }
      P.paused = !P.paused; const nw = performance.now();
      if (P.paused) P.pauseAt = nw; else if (P.pauseAt) { P.stepStart += nw - P.pauseAt; if (P.countT) P.countT += nw - P.pauseAt; P.pauseAt = null; }
      drawStep();
    };
    const plus = $('#plus'); if (plus) plus.onclick = () => { P.left += 15; P.dur += 15; updateClock(); };
    const how = $('#phow'); if (how) how.onclick = () => { P.how = true; drawStep(); };
    const hc = $('#hclose'); if (hc) hc.onclick = () => { P.how = false; drawStep(); };
    const cnt = $('#pcount'); if (cnt) cnt.onclick = () => { P.counting = !P.counting; P.count = 0; P.countT = performance.now(); drawStep(); };
    const sw = $('#swap'); if (sw) sw.onclick = () => { P.showFig[e.name] = !P.showFig[e.name]; drawStep(); };
    if ($('#visIn')) mountVis(s, e);
    if ($('#unThumb')) {
      const t = $('#unThumb');
      Coach.thumb(patternFor(e), 200).then(d => {
        if (d) t.innerHTML = `<img alt="" src="${d}">`; else { t.innerHTML = '<canvas></canvas>'; Coach.still2d(t.firstChild, patternFor(e)); }
      });
    }
    updateBar();
  }
  function dots(s, e) {
    if (e.sets <= 1) return '<div class="dots"></div>';
    return `<div class="dots" aria-label="Set ${s.set} of ${e.sets}">${Array.from({ length: e.sets }, (_, k) => `<i class="${k < s.set ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  function howHTML(e) {
    return `<div class="howsheet" role="dialog" aria-label="How to do ${esc(e.name)}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 style="font-size:20px">${esc(e.name)}</h3><button class="pbtn" id="hclose" aria-label="Close">${ICON.close}</button></div>
      <div style="color:var(--chalk);font-weight:600">${esc(doseLabel(e))}${e.muscles ? ' · ' + esc(e.muscles) : ''}</div>
      ${e.desc ? `<p style="margin:0">${esc(e.desc)}</p>` : ''}
      ${e.steps && e.steps.length ? `<ol>${e.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<p style="margin:0;color:var(--court-dim)">Your file has no written steps for this one. Follow the figure.</p>'}
      ${(e.tips || []).map(t => `<div class="tip">${esc(t)}</div>`).join('')}</div>`;
  }
  function confirmExit() {
    const el = $('#player');
    const d = document.createElement('div'); d.className = 'howsheet';
    d.innerHTML = `<h3 style="font-size:22px">End this workout?</h3><p style="margin:0;color:var(--court-dim)">You are on exercise ${P.steps[P.i].pos} of ${P.steps[P.i].of}.</p>
      <div style="display:flex;gap:10px"><button class="btn ghost" id="cKeep" style="flex:1;color:var(--court-ink);border-color:rgba(255,255,255,.25)">Keep going</button><button class="btn" id="cEnd" style="flex:1;background:var(--chalk);color:#1c1a10">End workout</button></div>`;
    el.appendChild(d);
    const was = P.paused; P.paused = true;
    $('#cKeep').onclick = () => { d.remove(); P.paused = was; };
    $('#cEnd').onclick = exitPlayer;
  }
  function completeStep() {
    const s = P.steps[P.i];
    if (s.type === 'timed' || s.type === 'reps') P.done++;
    beep(660, 0.18);
    P.paused = false;
    enter(P.i + 1);
  }
  function jump(dir) {
    // jump to the start of the previous/next exercise
    const cur = P.steps[P.i];
    let i = P.i;
    if (dir > 0) { while (i < P.steps.length && P.steps[i].num === cur.num) i++; while (i < P.steps.length && P.steps[i].type === 'rest' && P.steps[i].upNext) i++; }
    else {
      const notNext = x => !(x.type === 'rest' && x.upNext);
      const startCur = P.steps.findIndex(x => x.num === cur.num && notNext(x));
      if (startCur >= 0 && P.i > startCur) i = startCur;
      else i = P.steps.findIndex(x => x.num === cur.num - 1 && notNext(x));
      if (i < 0) i = 0;
    }
    P.paused = false;
    if (i >= P.steps.length) return finish();
    enter(i);
  }
  function updateClock() {
    const c = $('#clock'); if (!c) return;
    const s = P.steps[P.i];
    if (s.type === 'reps') {
      if (P.counting) { const rr = fmtRange(s.ex.reps); c.innerHTML = P.count + '<small>of ' + rr + '</small>'; }
      return;
    }
    const txt = clock(P.left); if (c.textContent !== txt) c.textContent = txt;
  }
  function updateBar() {
    if (!P) return;
    const s = P.steps[P.i];
    document.querySelectorAll('[data-seg]').forEach(b => {
      const k = +b.getAttribute('data-seg');
      const curEx = s.num - 1 - (s.type === 'rest' && s.upNext ? 1 : 0);
      let f = k < curEx ? 1 : 0;
      if (k === curEx && !(s.type === 'rest' && s.upNext)) {
        const sameEx = P.steps.filter(x => x.num === s.num && !(x.type === 'rest' && x.upNext));
        const pos = sameEx.indexOf(s);
        const part = s.dur ? 1 - P.left / Math.max(1, P.dur) : 0;
        f = (pos + part) / sameEx.length;
      }
      if (k === curEx && s.type === 'rest' && s.upNext) f = 1;
      b.style.transform = 'scaleX(' + Math.max(0, Math.min(1, f)) + ')';
    });
    const vb = $('#vbar'); if (vb && P.dur) vb.style.transform = 'scaleX(' + (1 - P.left / P.dur) + ')';
  }
  function tick(now) {
    if (!P) return;
    const dt = Math.min(0.25, (now - P.last) / 1000); P.last = now;
    const s = P.steps[P.i];
    if (s && !P.paused && s.dur) {
      P.left -= dt;
      const whole = Math.ceil(P.left);
      if (whole <= 3 && whole >= 1 && P.lastBeep !== whole) { P.lastBeep = whole; beep(s.type === 'timed' ? 520 : 600, 0.12, 0.14); }
      if (P.left <= 0) { completeStep(); requestAnimationFrame(tick); return; }
      updateClock(); updateBar();
      const br = $('#breath');
      if (br && s.ex.breath) { const cyc = s.ex.breath.in + s.ex.breath.out; const t = ((now - P.stepStart) / 1000) % cyc; const inh = t < s.ex.breath.in; const n = Math.ceil(inh ? s.ex.breath.in - t : cyc - t); const txt = (inh ? 'Breathe in · ' : 'Breathe out · ') + n; if (br.textContent !== txt) br.textContent = txt; }
    }
    if (s && s.type === 'reps' && P.counting && !P.paused) {
      const n = Math.floor((now - P.countT) / 1000 / Coach.cycle(patternFor(s.ex)));
      if (n !== P.count) { P.count = n; if (n > 0) { if (prefs.voice) say(String(n)); else beep(740, 0.08, 0.1); } updateClock(); if (n >= s.ex.reps[1]) { P.counting = false; drawStep(); } }
    }
    requestAnimationFrame(tick);
  }
  function finish() {
    const el = $('#player'); if (!el) return;
    const mins = Math.max(1, Math.round((Date.now() - P.started) / 60000));
    const ex = P.total;
    el.classList.remove('is-rest');
    el.innerHTML = `<div class="ptop"><span></span><span class="pcount">${esc(P.w.name)}</span><button class="pbtn" id="pclose" aria-label="Close">${ICON.close}</button></div>
      <div class="pfin"><div id="finfig" style="width:220px;height:170px"></div><h2>Workout done</h2>
      <div class="stats"><div><b>${mins}</b><span>minutes</span></div><div><b>${ex}</b><span>exercises</span></div><div><b>${P.done}</b><span>sets & holds</span></div></div>
      <button class="btn" id="fin" style="background:var(--chalk);color:#1c1a10;min-width:200px">Back to the plan</button></div>`;
    Coach.mount($('#finfig'), 'jack', { flat: true, colors: { body: '#f4f7f5', far: '#5f8a82', floor: '#2a5a53' } });
    say('Workout complete. Nice work.'); beep(880, 0.2); setTimeout(() => beep(1175, 0.35), 220);
    $('#pclose').onclick = exitPlayer; $('#fin').onclick = exitPlayer;
    P.steps = []; P.i = 0;
  }
  document.addEventListener('keydown', e => {
    if (!P || !P.steps.length) return;
    if (e.key === ' ') { e.preventDefault(); const b = $('#pmain'); b && b.click(); }
    if (e.key === 'ArrowRight') jump(1);
    if (e.key === 'ArrowLeft') jump(-1);
    if (e.key === 'Escape') confirmExit();
  });

  // ---------- boot ----------
  render();
  Coach.init();
  Store.init().then(() => { if (!P && !layer.innerHTML) render(); });
  window.__drillbook = { Store, importFile, startPlayer, go };
})();
