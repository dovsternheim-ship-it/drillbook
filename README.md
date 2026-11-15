# Drillbook

Upload any workout plan — a PDF, a Word file, text, or photos of a printed or handwritten sheet — and Drillbook turns it into a guided session: the exact sets, reps, timers and rest from your sheet, with an animated 3D coach for every exercise.

**Open the app:** https://dovsternheim-ship-it.github.io/drillbook/
On Android, open it in Chrome and choose *Add to Home screen* (or *Install app*). It then opens like any other app and works offline.

## How it works
- **Reading plans:** PDFs and Word files are read on the device. Photos and handwriting are read by Claude, which only works when Drillbook is opened inside the Claude app or on claude.ai.
- **Coach:** a skinned 3D human (MakeHuman CC0 body) driven by a small motion engine (inverse kinematics, planted hands and feet, balance) with 81 exercises.
- **Storage:** routines stay on your device (IndexedDB / localStorage).

## Layout
- `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`, `vendor/` — the built app served by GitHub Pages
- `src/` — source modules (`app.js`, `parser.js`, `reader.js`, `smart.js`, `body.js`, `moves.js`, `moves_lib.js`, `coach3d.js`, `coach.js`, `human_data.js`, `shell.html`)
- `tools/build_pwa.sh` — rebuilds the app in the repository root; `tools/build.sh` — builds a single-file page
- `tools/convert3.py` — builds `src/human_data.js` from MakeHuman CC0 assets

## Credits
Body mesh and skeleton: MakeHuman (CC0). Libraries: three.js (MIT), pdf.js (Apache-2.0), mammoth.js (BSD-2-Clause).
