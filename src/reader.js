// ---------- Read an uploaded file into lines + images ----------
var Reader = (function () {
  const VB = window.DRILLBOOK_VENDOR;
  const PDFJS = VB || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const MAMMOTH = VB ? VB + 'mammoth.browser.min.js' : 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error('Could not load a helper library. Check your connection and try again.')); };
      document.head.appendChild(s);
    }));
  }
  async function pdfLib() {
    if (!window.pdfjsWorker) await loadScript(PDFJS + 'pdf.worker.min.js');
    if (!window['pdfjs-dist/build/pdf']) await loadScript(PDFJS + 'pdf.min.js');
    const lib = window['pdfjs-dist/build/pdf'];
    lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    return lib;
  }

  function mul(m, n) { // pdf affine [a b c d e f]
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }

  async function imageBoxes(lib, page) {
    const OPS = lib.OPS;
    const ol = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; const boxes = [];
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i], args = ol.argsArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() || ctm;
      else if (fn === OPS.transform) ctm = mul(ctm, args);
      else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (args && args[0]) ctm = mul(ctm, args[0]); }
      else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageXObjectRepeat || fn === OPS.paintJpegXObject) {
        const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]);
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        boxes.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
      }
    }
    return boxes;
  }

  async function readPdf(file, onStep) {
    const lib = await pdfLib();
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
    let lines = []; const images = []; const pageShots = [];
    const maxPages = Math.min(doc.numPages, 40);
    for (let p = 1; p <= maxPages; p++) {
      onStep && onStep('Reading page ' + p + ' of ' + doc.numPages);
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      lines = lines.concat(Lines.fromPdfItems(tc.items, p));
      const vp1 = page.getViewport({ scale: 1 });
      let boxes = [];
      try { boxes = await imageBoxes(lib, page); } catch (e) { boxes = []; }
      const pageArea = vp1.width * vp1.height;
      boxes = boxes.filter(b => (b[2] - b[0]) > 36 && (b[3] - b[1]) > 36 && (b[2] - b[0]) * (b[3] - b[1]) < pageArea * 0.7);
      // merge overlapping boxes (images drawn in pieces)
      const merged = [];
      for (const b of boxes) {
        const m = merged.find(o => !(b[2] < o[0] - 2 || b[0] > o[2] + 2 || b[3] < o[1] - 2 || b[1] > o[3] + 2));
        if (m) { m[0] = Math.min(m[0], b[0]); m[1] = Math.min(m[1], b[1]); m[2] = Math.max(m[2], b[2]); m[3] = Math.max(m[3], b[3]); } else merged.push(b.slice());
      }
      const textPoor = tc.items.filter(i => i.str.trim()).length < 5;
      if (merged.length || (textPoor && pageShots.length < 6)) {
        const scale = 2;
        const vp = page.getViewport({ scale });
        const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        for (const b of merged) {
          const r = vp.convertToViewportRectangle(b);
          const x = Math.max(0, Math.min(r[0], r[2])), y = Math.max(0, Math.min(r[1], r[3]));
          const w = Math.min(cv.width - x, Math.abs(r[2] - r[0])), h = Math.min(cv.height - y, Math.abs(r[3] - r[1]));
          if (w < 20 || h < 20) continue;
          const out = document.createElement('canvas');
          const k = Math.min(1, 640 / w); out.width = Math.round(w * k); out.height = Math.round(h * k);
          const o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
          o.drawImage(cv, x, y, w, h, 0, 0, out.width, out.height);
          images.push({ page: p, x0: b[0], y0: b[1], x1: b[2], y1: b[3], data: encode(out) });
        }
        if (textPoor && pageShots.length < 6) pageShots.push(await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8)));
      }
    }
    return { lines, images, pageShots, pages: doc.numPages };
  }
  function encode(c) {
    let d = c.toDataURL('image/webp', 0.8);
    if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', 0.82);
    return d;
  }

  // phone photos are huge: send Claude a sharp but small JPEG, upright
  async function shrink(file, max) {
    max = max || 1800;
    try {
      let bmp;
      try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file); }
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.86));
    } catch (e) { return file; }
  }
  async function readFile(file, onStep) {
    const name = file.name || 'workout';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf' || file.type === 'application/pdf') return Object.assign(await readPdf(file, onStep), { kind: 'pdf' });
    if (ext === 'docx') {
      onStep && onStep('Opening the Word document');
      await loadScript(MAMMOTH);
      const res = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      return { kind: 'docx', lines: Lines.fromHtml(res.value), images: [], pageShots: [] };
    }
    if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(name)) { onStep && onStep('Preparing the photo'); return { kind: 'image', lines: [], images: [], pageShots: [await shrink(file)] }; }
    if (ext === 'doc' || ext === 'pages' || ext === 'odt') throw new Error('This file type cannot be read here. Save it as PDF or .docx and upload it again.');
    const text = await file.text();
    if (ext === 'html' || ext === 'htm') return { kind: 'html', lines: Lines.fromHtml(text), images: [], pageShots: [] };
    return { kind: 'text', lines: Lines.fromText(text), images: [], pageShots: [] };
  }

  // Attach each extracted image to the exercise whose heading sits beside or just under it.
  function attachImages(workouts, images) {
    const used = new Set();
    const pairs = [];
    workouts.forEach(w => w.exercises.forEach(ex => {
      const a = ex.anchor; if (!a || a.page == null) return;
      images.forEach((im, k) => {
        if (im.page !== a.page) return;
        let d = null;
        if (a.y <= im.y1 + 24 && a.y >= im.y0 - 6) d = Math.abs(im.y1 - a.y);           // image beside the heading
        else if (a.y < im.y0 && im.y0 - a.y < 40) d = 60 + (im.y0 - a.y);              // image right above the heading
        if (d != null) pairs.push({ ex, k, d });
      });
    }));
    pairs.sort((p, q) => p.d - q.d);
    const done = new Set();
    for (const p of pairs) {
      if (used.has(p.k) || done.has(p.ex)) continue;
      used.add(p.k); done.add(p.ex); p.ex.imageIdx = p.k;
    }
  }

  return { readFile, attachImages, pdfLib, shrink };
})();
