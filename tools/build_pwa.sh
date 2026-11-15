set -e
D=/tmp/claude-0/-home-user/1a225017-3aeb-5401-8363-1982d1300b6d/scratchpad/pwa
rm -rf $D && mkdir -p $D/vendor $D/icons
cp node_modules/pdfjs-dist/build/pdf.min.js node_modules/pdfjs-dist/build/pdf.worker.min.js node_modules/three/build/three.min.js node_modules/mammoth/mammoth.browser.min.js $D/vendor/
VER=$(date +%s)
{
cat <<'H'
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b2f2b">
<meta name="description" content="Upload any workout plan and follow it as a guided, timed session.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<script>window.DRILLBOOK_VENDOR = 'vendor/';</script>
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
H
cat src/shell.html
echo '<script>'
for f in lines parser human_data body moves moves_lib coach3d coach reader smart app; do sed '/^if (typeof module/d' src/$f.js; echo; done
echo '</script>'
echo "<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>"
echo '</body></html>'
} > $D/index.html
cat > $D/manifest.webmanifest <<M
{ "name": "Drillbook", "short_name": "Drillbook", "description": "Your workout plan, coached move by move.",
  "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait",
  "background_color": "#eef2ee", "theme_color": "#0b2f2b",
  "icons": [ { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
             { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
             { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
M
cat > $D/sw.js <<S
const CACHE = 'drillbook-$VER';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/three.min.js', 'vendor/mammoth.browser.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && (req.mode === 'navigate' || url.pathname.endsWith('/index.html'))) {
    // app page: try the network first so updates arrive, fall back to the saved copy offline
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('index.html', cp)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});
S
python3 - "$D" <<'P'
import sys
from PIL import Image, ImageDraw
D=sys.argv[1]
def icon(size, pad, path):
    S=size*4; im=Image.new('RGBA',(S,S),(11,47,43,255)); d=ImageDraw.Draw(im)
    c=S/2; r=(S/2)*(1-pad)*0.62; w=int(S*0.075*(1-pad))
    d.arc([c-r,c-r,c+r,c+r],start=-90,end=-90+240,fill=(242,194,48,255),width=w)
    rr=r*0.28; d.ellipse([c-rr,c-rr,c+rr,c+rr],fill=(244,247,245,255))
    im=im.resize((size,size),Image.LANCZOS); im.save(path)
icon(192,0.0,D+'/icons/icon-192.png'); icon(512,0.0,D+'/icons/icon-512.png'); icon(512,0.3,D+'/icons/maskable-512.png')
P
ls -la $D $D/vendor | head -20
