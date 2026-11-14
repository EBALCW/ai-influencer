// assets/timing.js + assets/plan.js -> cues.json (edit-video/scripts/sfx-sync.mjs için)
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('..', import.meta.url).pathname;
const box = { window: {} };
vm.createContext(box);
for (const f of ['assets/timing.js', 'assets/plan.js'])
  vm.runInContext(fs.readFileSync(dir + f, 'utf8'), box);
const { cues } = box.window.PLAN;
fs.writeFileSync(
  dir + 'cues.json',
  JSON.stringify(
    { fps: 30, total: box.window.TIMING.duration, cues },
    null,
    1,
  ) + '\n',
);
console.log(`${cues.length} ses işareti -> cues.json`);
