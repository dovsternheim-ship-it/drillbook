// ---------- Turn pdf.js text items into reading-order lines ----------
var Lines = (function () {
  function fromPdfItems(items, page) {
    const its = items.filter(it => it.str && it.str.trim()).map(it => ({
      s: it.str, x: it.transform[4], y: it.transform[5], w: it.width,
      h: Math.abs(it.height || it.transform[3] || 10) || 10,
    }));
    // detect two-column flow: many items starting near two distinct x positions with big gaps — keep it simple:
    its.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const rows = [];
    for (const it of its) {
      const r = rows.find(r => Math.abs(r.y - it.y) < Math.max(2, Math.min(r.h, it.h) * 0.45));
      if (r) { r.items.push(it); r.h = Math.max(r.h, it.h); } else rows.push({ y: it.y, h: it.h, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);
    const out = [];
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let text = '', end = null, size = 0;
      for (const it of r.items) {
        if (end != null) {
          const gap = it.x - end;
          if (gap > Math.max(14, r.h * 1.6)) text += ' | ';
          else if (gap > r.h * 0.12 && !text.endsWith(' ') && !it.s.startsWith(' ')) text += ' ';
        }
        text += it.s; end = it.x + it.w; size = Math.max(size, it.h);
      }
      out.push({ text: text.replace(/\s+/g, ' ').trim(), page, y: r.y, x: r.items[0].x, size: Math.round(size * 10) / 10 });
    }
    return out;
  }

  // Plain text / markdown
  function fromText(txt) {
    const out = [];
    txt.replace(/\r/g, '').split('\n').forEach((raw, i) => {
      if (!raw.trim()) return;
      let size = 10, text = raw.replace(/\t+/g, ' | ');
      const hm = text.match(/^\s*(#{1,6})\s+/);
      if (hm) { size = 10 + (7 - hm[1].length) * 1.6; text = text.slice(hm[0].length); }
      const bold = /^\s*\*\*[^*]+\*\*\s*$/.test(text);
      text = text.replace(/\*\*|__/g, '');
      if (bold) size = 12;
      if (/^\s*\|.*\|\s*$/.test(text)) { if (/^\s*\|[\s:|-]+\|\s*$/.test(text)) return; text = text.trim().replace(/^\||\|$/g, '').split('|').map(s => s.trim()).join(' | '); }
      const indent = (raw.match(/^\s*/)[0].length) * 4;
      out.push({ text: text.trim(), page: 1, y: -i, x: indent, size });
    });
    return out;
  }

  // HTML (from mammoth for .docx)
  function fromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = []; let i = 0;
    const sizes = { H1: 20, H2: 17, H3: 15, H4: 13, H5: 12, H6: 12 };
    function push(text, size, x) { text = text.replace(/\s+/g, ' ').trim(); if (text) out.push({ text, page: 1, y: -(i++), x: x || 0, size }); }
    function walk(el, depth) {
      for (const n of el.children) {
        const tag = n.tagName;
        if (sizes[tag]) push(n.textContent, sizes[tag]);
        else if (tag === 'P') {
          const strong = n.querySelector('strong,b');
          const allBold = strong && strong.textContent.trim() === n.textContent.trim();
          push(n.textContent, allBold ? 12 : 10);
        } else if (tag === 'OL' || tag === 'UL') {
          let k = 1;
          for (const li of n.children) {
            if (li.tagName !== 'LI') continue;
            const own = Array.from(li.childNodes).filter(c => !(c.tagName === 'OL' || c.tagName === 'UL')).map(c => c.textContent).join(' ');
            push((tag === 'OL' ? (k++) + '. ' : '• ') + own, 10, 12 * (depth + 1));
            const sub = li.querySelector('ol,ul'); if (sub) walk({ children: [sub] }, depth + 1);
          }
        } else if (tag === 'TABLE') {
          for (const tr of n.querySelectorAll('tr')) push(Array.from(tr.children).map(td => td.textContent.trim()).join(' | '), 10);
        } else walk(n, depth);
      }
    }
    walk(doc.body, 0);
    return out;
  }
  return { fromPdfItems, fromText, fromHtml };
})();
if (typeof module !== 'undefined') module.exports = Lines;
