// ---------- Optional: ask Claude to read the document ----------
var Smart = (function () {
  let samplePromise = null;
  function get() {
    if (!samplePromise) samplePromise = (window.claude && window.claude.use) ? window.claude.use('sample').catch(() => null) : Promise.resolve(null);
    return samplePromise;
  }

  function prompt(lines, fileName, hasImages) {
    const body = lines.slice(0, 1600).map(l => (l.page ? 'p' + l.page + ' ' : '') + (l.size >= 13 ? '[H] ' : '') + l.text).join('\n');
    return `You turn a workout document into structured data for a guided workout player.

Rules:
- Use only exercises the document actually prescribes. Keep names, numbers, sets, reps, durations exactly as written. Never invent exercises or numbers.
- A "workout" is a routine the person does in one go (e.g. "Part A: Daily mobility", "Day 1", "Circuit"). Skip sections that only give advice (nutrition, progress tables, weekly schedule, warnings).
- If the same exercise appears both in a summary table and a detailed description, output it once with the detailed instructions.
- Ranges: keep both ends (repsMin/repsMax or secondsMin/secondsMax). "per side"/"each leg" -> perSide true. "twice" -> sets 2.
- Use seconds for durations (3 minutes -> 180).
- "anchor" must be the exact line of text where the exercise is named in the document (copy it verbatim, including any code like "B1.").
- optional = true only when the document says the exercise is conditional (e.g. "from week 3"), and put that condition in "note".
- pattern: the id of the closest movement for the animation, from this list (id = what it shows): ${Coach.ids.map(id => id + ' = ' + Coach.label(id)).join('; ')}. Match the actual body position (e.g. kneeling, lying on the side, on a bench) not just the name.
- restBetweenSetsSec / restBetweenExercisesSec: only if the document states them for that workout.
${hasImages ? '- The document is attached as images (scans, phone photos, or handwritten notes, possibly several pages in order). Read all of them carefully, including handwriting. Common shorthand: "3x10" or "3 x 10" = 3 sets of 10 reps, "30s"/"30 sec" = 30 seconds, "ea"/"e/s"/"/side" = per side, "min" = minutes, "RPE" and tempo notes go in tips. Ignore crossed-out text. If a word is unclear, use the most likely exercise name.\n' : ''}
Return only JSON, no prose, in this shape:
{"title": string, "workouts": [{"name": string, "intro": string, "rounds": number, "restBetweenSetsSec": number|null, "restBetweenExercisesSec": number|null,
 "exercises": [{"code": string|null, "name": string, "anchor": string, "sets": number, "repsMin": number|null, "repsMax": number|null, "secondsMin": number|null, "secondsMax": number|null, "perSide": boolean, "steps": [string], "tips": [string], "muscles": string|null, "note": string|null, "optional": boolean, "pattern": string}]}]}

File name: ${fileName}
Document text (one line per row; "p3" = page 3; [H] = large heading text):
${body}`;
  }

  async function read(lines, fileName, images, signal) {
    const sample = await get();
    if (!sample) throw { code: 'unavailable' };
    const opts = { modelTier: 'default', signal };
    if (images && images.length) {
      const lim = await sample.limits().catch(() => ({}));
      if (lim && lim.images) { const mx = lim.images.maxInputBytes || 5e6; opts.images = images.filter(b => !b.size || b.size <= mx).slice(0, Math.max(1, lim.images.maxCount || 6)); }
      else if (!lines.length) throw { code: 'images_unavailable' };
    }
    const out = await sample.json(prompt(lines, fileName, !!opts.images), opts);
    if (!out || !Array.isArray(out.workouts)) throw { code: 'bad_answer' };
    // find anchors in the lines for image matching
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const workouts = out.workouts.map((w, wi) => ({
      id: 'w' + wi, name: w.name || 'Workout ' + (wi + 1), intro: w.intro || '', rounds: Math.max(1, +w.rounds || 1),
      rest: { sets: w.restBetweenSetsSec || null, exercises: w.restBetweenExercisesSec || null, rounds: null },
      exercises: (w.exercises || []).filter(e => e && e.name).map(e => {
        const an = norm(e.anchor || e.name);
        const line = lines.find(l => norm(l.text) === an) || lines.find(l => an && norm(l.text).includes(an)) || lines.find(l => norm(l.text).includes(norm(e.name)));
        const reps = e.repsMin || e.repsMax ? [+e.repsMin || +e.repsMax, +e.repsMax || +e.repsMin] : null;
        const secs = !reps && (e.secondsMin || e.secondsMax) ? [+e.secondsMin || +e.secondsMax, +e.secondsMax || +e.secondsMin] : null;
        return {
          code: e.code || null, name: e.name, sets: Math.max(1, +e.sets || 1), reps, seconds: secs || (reps ? null : [30, 30]),
          perSide: !!e.perSide, steps: (e.steps || []).map(String), tips: (e.tips || []).map(String), desc: '',
          muscles: e.muscles || null, note: e.note || null, optional: !!e.optional, restAfter: null, restSets: null,
          anchor: line ? { page: line.page, y: line.y, x: line.x } : null,
          pattern: Coach.norm(e.pattern), breath: null,
        };
      }),
    })).filter(w => w.exercises.length);
    return { title: out.title, workouts };
  }
  return { get, read };
})();
