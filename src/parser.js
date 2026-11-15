// ---------- Drillbook document parser ----------
// Input: an array of "lines" {text, page, y, x, size} in reading order.
// Output: {title, workouts:[{name, intro, rest, rounds, exercises:[...]}]}
var Parser = (function () {
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twice: 2, once: 1 };
  const DASH = '[-–—]|to';
  const RANGE = '(\\d+(?:\\.\\d+)?)(?:\\s*(?:' + DASH + ')\\s*(\\d+(?:\\.\\d+)?))?';
  const TIME_UNIT = '(seconds?|secs?|s|minutes?|mins?|m|min)\\b';
  const reTime = new RegExp(RANGE + '\\s*' + TIME_UNIT, 'i');
  const reSetsX = new RegExp('(\\d+)\\s*[x×]\\s*' + RANGE, 'i');           // 3 x 10, 3 × 8–12, 2 × 20–30 sec
  const reSetsOf = new RegExp('(\\d+|two|three|four|five|six)\\s*(?:sets?|rounds?)\\s*(?:of|x|×)?\\s*(?:' + RANGE + ')?', 'i');
  const reReps = new RegExp(RANGE + '\\s*(?:slow\\s+|controlled\\s+|easy\\s+)?(?:reps?|repetitions?|times|breaths?)\\b', 'i');
  const reSide = /\b(per|each|every|a)\s+(side|leg|arm|direction|way)\b|\/\s*(side|leg|arm)\b|\bper\s+side\b|\b(each|both)\s+sides\b|\b(L|R)\s*\/\s*(R|L)\b/i;
  const reTimesWord = /\b(twice|three times|four times|2x|3x)\b/i;
  const reWeek = /\(?\b(?:from|starting|start(?:ing)?\s+(?:in|at|from)?|after|begin(?:ning)?\s+(?:in)?)\s+week\s+(\d+)\)?/i;
  const FILLER = new Set(('slow slowly controlled easy each per every side sides leg legs arm arms direction way twice once total ' +
    'and of the a on in x × sets set reps rep repetitions repetition seconds second sec secs s min mins minutes minute m hold ' +
    'holds starting start from week weeks after times time round rounds breaths breath , ; / – - — + or to up with ' +
    'alternating alternate both hour hours approx about roughly then').split(' '));

  function num(s) { if (s == null) return null; s = String(s).toLowerCase(); return NUMW[s] != null ? NUMW[s] : parseFloat(s); }
  function toSec(v, unit) { unit = (unit || '').toLowerCase(); return unit.startsWith('m') ? Math.round(v * 60) : Math.round(v); }

  // Parse a dose ("3 sets of 8–12", "45 seconds per side, twice", "10 slow reps", "2 × 20–30 sec per side").
  function parseDose(text) {
    if (!text) return null;
    const t = text.replace(/ /g, ' ');
    const d = { sets: null, reps: null, seconds: null, perSide: false, week: null, pieces: [] };
    let m;
    if ((m = t.match(reSetsX))) {
      d.sets = num(m[1]);
      const a = num(m[2]), b = num(m[3]);
      const rest = t.slice(m.index + m[0].length);
      const um = rest.match(/^\s*(seconds?|secs?|s|minutes?|mins?|min|m)\b/i);
      if (um) { d.seconds = [toSec(a, um[1]), toSec(b || a, um[1])]; d.pieces.push(m[0] + um[0]); }
      else { d.reps = [a, b || a]; d.pieces.push(m[0]); }
    } else if ((m = t.match(reSetsOf))) {
      d.sets = num(m[1]);
      d.pieces.push(m[0]);
      if (m[2]) {
        const a = num(m[2]), b = num(m[3]);
        const rest = t.slice(m.index + m[0].length);
        const um = rest.match(/^\s*(seconds?|secs?|s|minutes?|mins?|min|m)\b/i);
        if (um) { d.seconds = [toSec(a, um[1]), toSec(b || a, um[1])]; d.pieces.push(um[0]); }
        else d.reps = [a, b || a];
      }
    }
    if (!d.seconds && !d.reps && (m = t.match(/(?:^|\s)[x×]\s?(\d+)(?:\s*(?:[-–—]|to)\s*(\d+))?\b(?!\s*(?:sec|s\b|min))/i))) {
      d.reps = [num(m[1]), num(m[2] || m[1])]; d.pieces.push(m[0].trim());
    }
    if (!d.seconds && !d.reps) {
      if ((m = t.match(reReps))) { d.reps = [num(m[1]), num(m[2] || m[1])]; d.pieces.push(m[0]); }
    }
    if (!d.seconds && !d.reps) {
      if ((m = t.match(reTime))) {
        // avoid "4 seconds" inside "breathe in for 4 seconds" when used as full-line check; caller decides
        d.seconds = [toSec(num(m[1]), m[3]), toSec(num(m[2] || m[1]), m[3])]; d.pieces.push(m[0]);
      }
    }
    if (!d.sets && (m = t.match(reTimesWord))) {
      const w = m[1].toLowerCase();
      d.sets = w === 'twice' || w === '2x' ? 2 : w.startsWith('three') || w === '3x' ? 3 : 4; d.pieces.push(m[0]);
    }
    if ((m = t.match(reSide))) { d.perSide = true; d.pieces.push(m[0]); }
    if ((m = t.match(reWeek))) { d.week = parseInt(m[1], 10); d.pieces.push(m[0]); }
    if (!d.seconds && !d.reps && !d.sets) return null;
    if (d.sets && !d.seconds && !d.reps) return null; // "3 rounds" alone is not an exercise dose
    return d;
  }

  function leftoverWords(text, d) {
    let t = ' ' + text + ' ';
    for (const p of d.pieces) t = t.replace(p, ' ');
    return t.replace(/[(),.;:!]/g, ' ').split(/\s+/).filter(w => w && !FILLER.has(w.toLowerCase()) && !/^\d+([.,]\d+)?$/.test(w));
  }
  function doseOnly(text) {
    const d = parseDose(text);
    if (!d) return null;
    return leftoverWords(text, d).length === 0 ? d : null;
  }

  const reCode = /^\s*(?:([A-Z]{1,2}\d{1,2}[a-z]?|\d{1,2}[a-z]?)[.):]|([A-Z]{1,2}\d{1,2}[a-z]?)\s)\s*/;
  const reBullet = /^\s*(?:[•●▪◦‣∙·*\-–—]|\d{1,2}[.)]|[a-z][.)])\s+/;
  function stripCode(text) {
    const m = text.match(reCode);
    if (m) return { code: (m[1] || m[2]), name: text.slice(m[0].length).trim() };
    return { code: null, name: text.replace(/^\s*[•●▪◦*\-–—]\s*/, '').trim() };
  }
  function cleanName(n) {
    let note = null;
    const wm = n.match(reWeek);
    if (wm) { note = wm[0].replace(/[()]/g, '').trim(); n = n.replace(wm[0], ''); }
    n = n.replace(/\s*[:\-–—|,]+\s*$/, '').replace(/^\s*[:\-–—|,]+\s*/, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
    return { name: n, note };
  }
  function normName(n) {
    return n.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(s|es)\b/g, '').trim().replace(/s\b/g, '');
  }
  function words(t) { return t.trim().split(/\s+/).filter(Boolean); }

  const reSectionWord = /^(?:#+\s*)?(part|day|workout|circuit|session|section|block|phase|routine|warm[\s-]?up|cool[\s-]?down|finisher|stretch(?:ing)?|mobility|strength|cardio|core|upper body|lower body|full body|legs|push|pull|abs|hiit|amrap|emom|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const reRestLine = /^\s*(?:[•\-*]\s*)?rest\b[^.]{0,40}?(\d+(?:\.\d+)?)(?:\s*(?:[-–—]|to)\s*(\d+))?\s*(seconds?|secs?|s|minutes?|mins?|min|m)\b/i;
  const reRounds = /\b(?:repeat|do|perform|complete)\b[^.]{0,40}?\b(\d+|two|three|four|five|six)\s*(?:times|rounds|x)\b|\b(\d+|two|three|four|five)\s+rounds\b/i;

  function median(arr) { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; }

  function bodySize(lines) {
    const w = new Map();
    for (const l of lines) { const k = Math.round(l.size * 2) / 2; w.set(k, (w.get(k) || 0) + l.text.length); }
    let best = 0, bs = 10; for (const [k, v] of w) if (v > best) { best = v; bs = k; }
    return bs;
  }

  function dropRepeated(lines) {
    const pages = new Set(lines.map(l => l.page)).size;
    if (pages < 3) return lines;
    const count = new Map();
    for (const l of lines) { const k = l.text.replace(/\d+/g, '#').trim(); if (!count.has(k)) count.set(k, new Set()); count.get(k).add(l.page); }
    return lines.filter(l => {
      const k = l.text.replace(/\d+/g, '#').trim();
      if (/^page\s*#(\s*of\s*#)?$/i.test(k) || /^#$/.test(k)) return false;
      return count.get(k).size < Math.max(3, pages * 0.5);
    });
  }

  function parse(rawLines, opts) {
    opts = opts || {};
    let lines = dropRepeated(rawLines.filter(l => l.text && l.text.trim()));
    lines = lines.map((l, i) => Object.assign({}, l, { i, text: l.text.replace(/\s+/g, ' ').trim() }));
    const body = bodySize(lines);
    const N = lines.length;

    // Title: largest text on first page (top-most among ties)
    let title = opts.fileName || 'My workout';
    const first = lines.filter(l => l.page === (lines[0] && lines[0].page));
    if (first.length) {
      const maxS = Math.max(...first.map(l => l.size));
      if (maxS > body * 1.15) title = first.find(l => l.size === maxS).text.replace(/^#+\s*/, '');
      else if (first[0].text.length < 70) title = first[0].text.replace(/^#+\s*/, '');
    }

    // ---- 1. Mark heading-style exercises (name line, followed by a dose-only line) ----
    const kind = new Array(N).fill(null);
    const ex = []; // candidates
    for (let i = 0; i < N - 1; i++) {
      const l = lines[i], nx = lines[i + 1];
      if (l.text.includes(' | ')) continue;
      if (l.page !== nx.page && (nx.y || 0) > 0 && false) continue;
      const d = doseOnly(nx.text);
      if (!d) continue;
      if (doseOnly(l.text) || parseDose(l.text) && !doseOnly(l.text) && words(l.text).length > 6) continue;
      const w = words(l.text).length;
      if (w > 9 || /[.?!]$/.test(l.text) || l.text.length > 70) continue;
      if (/^rest\b/i.test(stripCode(l.text).name)) continue;
      const sc = stripCode(l.text); const cn = cleanName(sc.name);
      if (!/[a-z]{2}/i.test(cn.name)) continue;
      kind[i] = 'exhead'; kind[i + 1] = 'dose';
      ex.push({ line: i, doseLine: i + 1, code: sc.code, name: cn.name, note: cn.note, dose: d, doseText: nx.text, size: l.size, page: l.page, y: l.y, x: l.x, style: 'card' });
      i++;
    }
    const headingStyle = ex.length >= 2;
    const exHeadSize = headingStyle ? median(ex.map(e => e.size)) : body;

    // ---- 2. Tables (lines with cells) ----
    const tableRows = [];
    let tableHeader = null, origHeader = null, lastTableLine = -5;
    for (let i = 0; i < N; i++) {
      const l = lines[i];
      if (kind[i]) continue;
      if (!l.text.includes(' | ')) { if (i - lastTableLine > 1) tableHeader = null; continue; }
      let cells = l.text.split(' | ').map(s => s.trim());
      if (i - lastTableLine > 1) { tableHeader = null; origHeader = null; }
      lastTableLine = i;
      tableHeader = origHeader;
      if (tableHeader) {
        const hi = re => tableHeader.findIndex(h => re.test(h));
        const si = hi(/^sets?\b|\bsets?$|rounds/), ri = hi(/^reps?\b|reps?$|repetitions|count/), ti = hi(/time|duration|hold|seconds|secs?\b/);
        if ((si >= 0 || ri >= 0 || ti >= 0) && !cells.some((c, k) => k !== hi(/rest/) && doseOnly(c) && (k === si || k === ri || k === ti) && /\D{3}/.test(c))) {
          let dt = '';
          if (si >= 0 && /\d/.test(cells[si] || '')) dt += cells[si].match(/\d+/)[0] + ' sets of ';
          if (ri >= 0 && /\d/.test(cells[ri] || '')) dt += cells[ri] + (/[a-z]/i.test(cells[ri]) ? '' : ' reps');
          else if (ti >= 0 && /\d/.test(cells[ti] || '')) dt += cells[ti] + (/[a-z]/i.test(cells[ti]) ? '' : ' seconds');
          if (dt && !/of $/.test(dt)) {
            const keep = cells.filter((c, k) => k !== si && k !== ri && k !== ti);
            const hdr = tableHeader.filter((c, k) => k !== si && k !== ri && k !== ti);
            cells = keep.concat([dt]);
            tableHeader = hdr.concat(['sets x reps']);
            tableHeader._composed = true;
          }
        }
      }
      const restCol = tableHeader ? tableHeader.findIndex(h => /rest/.test(h)) : -1;
      const doseIdx = cells.findIndex((c, k) => k !== restCol && doseOnly(c));
      if (doseIdx < 0) {
        if (!tableHeader && cells.some(c => /[a-z]/i.test(c))) { tableHeader = cells.map(c => c.toLowerCase()); origHeader = tableHeader; }
        kind[i] = 'table';
        continue;
      }
      const d = doseOnly(cells[doseIdx]);
      const hdrOK = tableHeader && tableHeader.some(h => /exercise|movement|move\b|name|drill|sets|reps|lift/.test(h));
      if (!hdrOK && !(d.reps || d.sets)) { kind[i] = 'table'; continue; }
      let code = null, name = null, nameIdx = -1;
      cells.forEach((c, k) => {
        if (k === doseIdx) return;
        if (!code && /^[A-Z]{0,2}\d{1,2}[a-z]?\.?$|^#?\d{1,2}$/.test(c)) { code = c.replace(/[.#]/g, ''); return; }
        if (name == null && /[a-z]{2}/i.test(c)) {
          if (tableHeader && tableHeader[k] && /muscle|target|focus|notes?|rest|tempo|why|what/.test(tableHeader[k])) return;
          name = c; nameIdx = k;
        }
      });
      if (!name) { kind[i] = 'table'; continue; }
      const extra = {};
      cells.forEach((c, k) => {
        const h = tableHeader && tableHeader[k];
        if (!h || k === doseIdx || k === nameIdx) return;
        if (/muscle|target|focus|works/.test(h)) extra.muscles = c;
        else if (/rest/.test(h)) { const rd = c.match(/(\d+)\s*(s|sec|seconds|min|m)?/i); if (rd) extra.rest = toSec(+rd[1], rd[2] || 's'); }
        else if (/note|tip|cue/.test(h)) extra.tip = c;
      });
      const sc = stripCode(name); const cn = cleanName(sc.name);
      kind[i] = 'tablerow';
      tableRows.push({ line: i, code: code || sc.code, name: cn.name, note: cn.note, dose: d, doseText: cells[doseIdx], page: l.page, y: l.y, x: l.x, style: 'table', extra });
    }

    // ---- 3. Inline exercises ("Squats – 3 x 10", "Plank: 45 sec", "20 jumping jacks") ----
    const inline = [];
    if (!headingStyle) {
      for (let i = 0; i < N; i++) {
        if (kind[i]) continue;
        const l = lines[i];
        const t = l.text;
        if (/[.?!]$/.test(t) && words(t).length > 6) continue;
        if (words(t).length > 14) continue;
        if (reRestLine.test(t) && words(t).length <= 8) { kind[i] = 'rest'; continue; }
        if (reRounds.test(t) && words(t).length <= 8) { kind[i] = 'rounds'; continue; }
        let d = parseDose(t);
        if (!d) {
          const sc0 = stripCode(t); const lm = sc0.name.match(/^(\d{1,3})\s+([A-Za-z][A-Za-z' \-/]{2,40})$/);
          if (lm && words(lm[2]).length <= 5) d = { sets: 1, reps: [+lm[1], +lm[1]], seconds: null, perSide: reSide.test(t), week: null, pieces: [lm[1] + ' '] };
        }
        if (!d) continue;
        let rest = ' ' + t + ' ';
        for (const p of d.pieces) rest = rest.replace(p, ' ');
        const sc = stripCode(rest.replace(/\s+/g, ' ').trim());
        let cn = cleanName(sc.name.replace(/\s[-–—:|]\s/g, ' ').replace(/\b(of|x|×|for|reps?|sets?)\s*$/i, '').trim());
        cn.name = cn.name.replace(/^(of|x|×|for)\s+/i, '').replace(/\s*[,;:]\s*$/, '').trim();
        if (!/[a-z]{2}/i.test(cn.name)) continue;
        const nw = words(cn.name).length;
        if (nw > 7 || cn.name.length > 55) continue;
        if (/^(hold|rest|repeat|breathe|then|keep|do|start|perform|complete|take|walk for|aim)\b/i.test(cn.name) && nw > 3) continue;
        if (/\b(your|you|the|between|until|while)\b/i.test(cn.name) && nw > 4) continue;
        kind[i] = 'exinline';
        inline.push({ line: i, code: sc.code, name: cn.name.charAt(0).toUpperCase() + cn.name.slice(1), note: cn.note, dose: d, doseText: t, page: l.page, y: l.y, x: l.x, size: l.size, style: 'inline' });
      }
    }

    // ---- 4. Sections ----
    const allEx = ex.concat(tableRows, inline).sort((a, b) => a.line - b.line);
    const exLineSet = new Set(allEx.map(e => e.line));
    const isSectionLine = (l, i) => {
      if (kind[i] || exLineSet.has(i)) return false;
      const w = words(l.text).length;
      if (w > 10 || l.text.length > 80 || /[.?!,]$/.test(l.text)) return false;
      const big = l.size >= Math.max(exHeadSize * 1.12, body * 1.25);
      const md = /^#{1,3}\s/.test(l.text);
      const pat = reSectionWord.test(l.text) && (l.size >= body * 1.05 || /:$/.test(l.text) || w <= 6 || /^[A-Z0-9 :&()\-–]+$/.test(l.text));
      const caps = /^[A-Z][A-Z0-9 :&()\-–/]{3,}$/.test(l.text) && w <= 6;
      return big || md || pat || caps || (/:$/.test(l.text) && w <= 6 && !headingStyle);
    };
    const sections = [];
    let cur = null;
    const startSection = (name, line) => { cur = { name, line, introLines: [], items: [] }; sections.push(cur); };
    let lastEx = null;
    for (let i = 0; i < N; i++) {
      const l = lines[i];
      if (isSectionLine(l, i) && !(l.text === title && i < 3)) {
        startSection(l.text.replace(/^#+\s*/, '').replace(/:$/, '').trim(), i); lastEx = null; continue;
      }
      const e = allEx.find(e => e.line === i);
      if (e) {
        if (!cur) startSection(null, i);
        e.steps = []; e.notes = []; e.desc = [];
        cur.items.push(e); lastEx = e; continue;
      }
      if (kind[i] === 'dose') continue;
      if (kind[i] === 'rounds') {
        const ro = l.text.match(reRounds); const r = num(ro[1] || ro[2]) || 1;
        const label = l.text.replace(ro[0], '').replace(/[()\-–—:,.]/g, ' ').replace(/\s+/g, ' ').trim();
        if (label && /[a-z]{3}/i.test(label) && words(label).length <= 5 && (!cur || cur.items.length)) { startSection(label, i); lastEx = null; }
        else if (!cur) startSection(null, i);
        cur.rounds = r; continue;
      }
      if (kind[i] === 'rest') {
        if (!cur) startSection(null, i);
        const m = l.text.match(reRestLine);
        const sec = toSec(+m[1], m[3]);
        if (cur.items.length) cur.items.push({ rest: sec, line: i });
        else cur.rest = sec;
        continue;
      }
      if (kind[i] === 'table' || kind[i] === 'tablerow') { lastEx = null; continue; }
      if (!cur) startSection(null, i);
      // body text
      if (lastEx && lastEx.style === 'card') attachText(lastEx, l);
      else if (lastEx && lastEx.style === 'inline' && l.x > lastEx.x + 4 && l.page === lastEx.page) attachText(lastEx, l);
      else if (!cur.items.length || !lastEx) cur.introLines.push(l.text);
      else if (lastEx && lastEx.style === 'table') cur.introLines.push(l.text);
    }

    function attachText(e, l) {
      attachText0(e, l); e._last = l;
    }
    function attachText0(e, l) {
      const t = l.text;
      const bm = t.match(reBullet);
      if (bm) { e.steps.push({ t: t.slice(bm[0].length).trim(), x: l.x, size: l.size }); return; }
      const last = e.steps[e.steps.length - 1];
      if (last && !e.notes.length && l.size >= last.size - 0.3 && (l.x > last.x + 2 || !/[.!?]$/.test(last.t))) { last.t += ' ' + t; return; }
      if (!e.steps.length && !e.notes.length) {
        if (e.desc.length && !/[.!?]$/.test(e.desc[e.desc.length - 1])) e.desc[e.desc.length - 1] += ' ' + t;
        else e.desc.push(t);
        return;
      }
      const close = e._last && e._last.page === l.page && l.y < e._last.y && (e._last.y - l.y) < l.size * 1.7 && Math.abs(e._last.size - l.size) < 0.6;
      if (e.notes.length && (close || !/[.!?]$/.test(e.notes[e.notes.length - 1]))) e.notes[e.notes.length - 1] += ' ' + t;
      else e.notes.push(t);
    }

    // ---- 5. Merge table rows with detailed cards (same code or name) ----
    const cards = allEx.filter(e => e.style === 'card');
    for (const s of sections) {
      s.items = s.items.filter(it => {
        if (it.rest != null || it.style !== 'table') return true;
        const match = cards.find(c => (it.code && c.code && it.code === c.code) || normName(c.name) === normName(it.name) ||
          (normName(it.name).length > 4 && (normName(c.name).startsWith(normName(it.name)) || normName(it.name).startsWith(normName(c.name)))));
        if (match) {
          if (it.extra && it.extra.muscles) match.muscles = it.extra.muscles;
          if (it.extra && it.extra.tip) match.notes.push(it.extra.tip);
          if (!match.note && it.note) match.note = it.note;
          match.tableLine = Math.min(match.tableLine == null ? 1e9 : match.tableLine, it.line);
          return false;
        }
        if (it.extra && it.extra.muscles) it.muscles = it.extra.muscles;
        if (it.extra && it.extra.rest) it.restSets = it.extra.rest;
        return true;
      });
    }

    // ---- 6. Build workouts ----
    const workouts = [];
    sections.forEach((s, si) => {
      const exs = s.items.filter(it => it.rest == null);
      if (!exs.length) return;
      const intro = s.introLines.join(' ');
      const rest = { sets: null, exercises: null, rounds: null };
      const reR = /\brest\b[^.]{0,30}?(\d+(?:\.\d+)?)(?:\s*(?:[-–—]|to)\s*(\d+))?\s*(seconds?|secs?|s|minutes?|mins?|min|m)\b([^.]{0,40})/gi;
      let rm;
      while ((rm = reR.exec(intro))) {
        const v = toSec(+rm[1], rm[3]); const ctx = rm[4] || '';
        if (/round|circuit/i.test(ctx)) rest.rounds = v;
        else if (/exercise|move|station/i.test(ctx)) rest.exercises = v;
        else if (/set/i.test(ctx)) rest.sets = v;
        else { rest.sets = rest.sets || v; rest.exercises = rest.exercises || v; }
      }
      if (s.rest != null) { rest.exercises = rest.exercises || s.rest; rest.sets = rest.sets || s.rest; }
      let rounds = s.rounds || 1;
      const ro = s.rounds ? null : intro.match(reRounds);
      if (ro) rounds = num(ro[1] || ro[2]) || 1;
      const items = [];
      s.items.forEach(it => {
        if (it.rest != null) { if (items.length) items[items.length - 1].restAfter = it.rest; return; }
        items.push(finalize(it));
      });
      let name = s.name;
      if (!name) name = workouts.length ? 'Workout ' + (workouts.length + 1) : title;
      workouts.push({ id: 'w' + workouts.length, name, intro, rest, rounds, exercises: items });
    });
    return { title, workouts };
  }

  function finalize(e) {
    const d = e.dose;
    let note = e.note || null;
    if (d.week && !note) note = 'Starts week ' + d.week;
    if (note && /week\s*(\d+)/i.test(note)) note = 'Starts week ' + note.match(/week\s*(\d+)/i)[1];
    const steps = (e.steps || []).map(s => s.t);
    const tips = (e.notes || []).slice();
    const text = [e.name, steps.join(' ')].join(' ');
    const out = {
      code: e.code || null,
      name: e.name,
      sets: d.sets || 1,
      reps: d.reps,
      seconds: d.seconds,
      perSide: !!d.perSide,
      doseText: e.style === 'table' ? e.doseText : e.doseText,
      steps, tips, desc: (e.desc || []).join(' '),
      muscles: e.muscles || null,
      note,
      optional: !!(note && /week/i.test(note)),
      restAfter: e.restAfter || null,
      restSets: e.restSets || null,
      anchor: { page: e.page, y: e.y, x: e.x },
      pattern: null,
      breath: breathCue(steps.join(' ') + ' ' + e.name),
    };
    return out;
  }

  function breathCue(t) {
    const i = t.match(/(?:breathe|inhale|breath)\s+in[^.]{0,40}?(\d+)\s*(?:seconds?|secs?|counts?|s)\b/i);
    const o = t.match(/(?:breathe|exhale|breath)\s+out[^.]{0,40}?(\d+)\s*(?:seconds?|secs?|counts?|s)\b/i);
    if (i && o) return { in: +i[1], out: +o[1] };
    return null;
  }

  return { parse, parseDose, doseOnly, normName, breathCue };
})();
if (typeof module !== 'undefined') module.exports = Parser;
