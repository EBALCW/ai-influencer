import crypto from "node:crypto";
import { CAMERA_SHUTTER_PRINT, UI_CLICK_PRINT } from "./sfx-prints.mjs";

export const SAMPLE_RATE = 48_000;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function expEnvelope(time, decay) {
  return Math.exp(-time * decay);
}

function chirp(time, startHz, endHz, duration, phase = 0) {
  const slope = (endHz - startHz) / duration;
  return Math.sin(2 * Math.PI * (startHz * time + 0.5 * slope * time * time) + phase);
}

const TAU = 2 * Math.PI;

// A band-pass resonator (constant 0 dB peak). Higher q rings longer.
function resonator(hz, q) {
  const w = (TAU * hz) / SAMPLE_RATE;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return {
    reset() { x1 = x2 = y1 = y2 = 0; },
    step(x) {
      const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    },
  };
}

// Noise-burst clicks through a resonator bank: crisp, broadband mechanical hits.
// events: [start seconds, gain]; bank: [[Hz, q, level], ...]. Filter state resets at time 0.
function clicker({ events, bank, burstDecay = 900, direct = 0.5, dark = 0, body }) {
  const filters = bank.map(([hz, q, level]) => ({ filter: resonator(hz, q), level }));
  const bodyFilter = body ? resonator(body.hz, body.q) : null;
  return ({ time, noise, smoothNoise }) => {
    if (time === 0) {
      for (const { filter } of filters) filter.reset();
      bodyFilter?.reset();
    }
    const excitation = noise * (1 - dark) + 4 * smoothNoise * dark;
    let burst = 0;
    for (const [at, gain] of events) if (time >= at) burst += gain * excitation * Math.exp(-(time - at) * burstDecay);
    let value = direct * burst;
    for (const { filter, level } of filters) value += level * filter.step(burst);
    if (bodyFilter) value += body.level * bodyFilter.step(burst);
    return value;
  };
}


// A state-variable filter whose cutoff can move every sample (for whooshes and risers): low, band and high outputs.
function sweepFilter() {
  let low = 0, band = 0;
  return {
    reset() { low = band = 0; },
    step(x, hz, q = 0.7) {
      const f = 2 * Math.sin(Math.PI * Math.min(hz, SAMPLE_RATE / 6) / SAMPLE_RATE);
      low += f * band;
      const high = x - low - q * band;
      band += f * high;
      return { low, band, high };
    },
  };
}

// An oscillator whose pitch can glide: returns the running phase in radians.
function glide() {
  let phase = 0;
  return { reset() { phase = 0; }, step(hz) { phase += (TAU * hz) / SAMPLE_RATE; return phase; } };
}


// A mechanism's rattle: band-limited noise under a clicker between two times, so a shutter sounds gritty, not pinged.
function rattle(from, to, level, clicks, hz = 3200) {
  const grit = sweepFilter();
  return (input) => {
    const { time, noise } = input;
    if (time === 0) grit.reset();
    const window = time < from || time > to ? 0 : Math.sin(Math.PI * (time - from) / (to - from)) ** 0.6;
    return clicks(input) + level * window * grit.step(noise, hz, 0.9).band * (0.6 + 0.4 * Math.sin(TAU * 31 * time));
  };
}


// A sound's spectral fingerprint played through noise: the level in log-spaced bands every few milliseconds, measured
// once from a recording and kept as numbers (lib/sfx-prints.mjs), so the pack reproduces its timing and colour while
// shipping no audio. Band gains are interpolated between frames.
function noiseprint({ hop, bands, frames, q = 5 }) {
  const filters = bands.map((hz) => resonator(hz, q));
  const gains = frames.map((row) => row.map((db) => 10 ** (db / 20)));
  return ({ time, noise }) => {
    if (time === 0) for (const filter of filters) filter.reset();
    const position = time / hop;
    const i = Math.min(gains.length - 1, Math.floor(position));
    const j = Math.min(gains.length - 1, i + 1);
    const u = position - Math.floor(position);
    let value = 0;
    for (let k = 0; k < filters.length; k += 1) value += filters[k].step(noise) * (gains[i][k] * (1 - u) + gains[j][k] * u);
    return value;
  };
}

// A rising wash of high, slightly inharmonic partials for the shimmer.
const SHIMMER_PARTIALS = (() => {
  const random = seededRandom(1709);
  return Array.from({ length: 26 }, (_, index) => {
    const position = index / 25;
    return {
      hz: (5200 + 7200 * position) * (0.98 + random() * 0.04),
      onset: 0.03 + 0.4 * position + (random() - 0.5) * 0.05,
      amp: 0.45 + random() * 0.55,
      decay: 10 + random() * 8,
    };
  });
})();
const SHIMMER_AIR = resonator(10_500, 2.5);

function synthesize(definition) {
  const length = Math.max(1, Math.round(definition.duration * SAMPLE_RATE));
  const samples = new Float64Array(length);
  const random = seededRandom(definition.seed);
  let smoothNoise = 0;

  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    const progress = index / Math.max(1, length - 1);
    const noise = random() * 2 - 1;
    smoothNoise += (noise - smoothNoise) * 0.075;
    samples[index] = definition.sample({
      time,
      progress,
      noise,
      smoothNoise,
      expEnvelope,
      chirp,
    });
  }

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const normalization = peak > 0 ? 0.78 / peak : 1;
  const pcm = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const fadeIn = Math.min(1, index / (SAMPLE_RATE * 0.002));
    const fadeOut = Math.min(1, (length - 1 - index) / (SAMPLE_RATE * 0.008));
    const value = Math.max(-1, Math.min(1, samples[index] * normalization * fadeIn * fadeOut));
    pcm[index] = Math.round(value * 32767);
  }
  return pcm;
}

export const SOUND_DEFINITIONS = Object.freeze([
  {
    id: "clean-ding",
    title: "Clean Ding",
    duration: 0.55,
    seed: 404,
    tags: ["success", "reveal", "bright"],
    use: "A positive result or satisfying completion; use sparingly.",
    sample: ({ time, expEnvelope: env }) => (Math.sin(2 * Math.PI * 1046.5 * time) + 0.42 * Math.sin(2 * Math.PI * 1569.75 * time)) * env(time, 7.4),
  },
  {
    id: "sub-impact",
    title: "Sub Impact",
    duration: 0.64,
    seed: 1001,
    tags: ["impact", "reveal", "low"],
    use: "One important claim, number, or final reveal—not every cut.",
    sample: ({ time, noise, chirp: sweep, expEnvelope: env }) => (sweep(time, 105, 38, 0.64) + noise * 0.28 * env(time, 36)) * env(time, 5.2),
  },
  {
    id: "typing-tick",
    title: "Typing Tick",
    duration: 0.055,
    seed: 1102,
    tags: ["typing", "input", "ui"],
    use: "Occasional typed-character accents; never repeat on every letter for long copy.",
    sample: ({ time, noise, expEnvelope: env }) => (noise * 0.45 + Math.sin(2 * Math.PI * 2400 * time) * 0.22) * env(time, 83),
  },
  {
    id: "sparkle",
    title: "Sparkle",
    duration: 0.72,
    seed: 1203,
    tags: ["delight", "highlight", "bright"],
    use: "A delightful payoff or premium highlight; keep below the voice.",
    sample: ({ time, expEnvelope: env }) => {
      const first = Math.sin(2 * Math.PI * 1396.9 * time) * env(time, 7.8);
      const secondTime = Math.max(0, time - 0.11);
      const second = time >= 0.11 ? 0.7 * Math.sin(2 * Math.PI * 2093 * secondTime) * env(secondTime, 9) : 0;
      const thirdTime = Math.max(0, time - 0.23);
      const third = time >= 0.23 ? 0.48 * Math.sin(2 * Math.PI * 2637 * thirdTime) * env(thirdTime, 10) : 0;
      return first + second + third;
    },
  },
  {
    id: "tick",
    title: "Tick",
    duration: 0.09,
    seed: 1304,
    tags: ["step", "mechanical", "precise"],
    use: "One step, checklist row or spec callout landing; keep it quiet under the voice.",
    sample: clicker({
      events: [[0.004, 1], [0.013, 0.3]],
      bank: [[3300, 120, 2.4], [6200, 160, 2.6], [9300, 220, 3.4], [12_400, 120, 1]],
      burstDecay: 1100,
      direct: 0.22,
      dark: 0.35,
    }),
  },
  {
    id: "latch",
    title: "Latch",
    duration: 0.2,
    seed: 1405,
    tags: ["lock", "connected", "mechanical"],
    use: "Something locks, closes or connects: a lid, a clasp, an account linked.",
    sample: clicker({
      events: [[0.004, 0.35], [0.05, 1], [0.088, 0.4]],
      bank: [[1250, 25, 2.2], [2900, 90, 2.4], [5300, 130, 2.4], [8300, 150, 2.2]],
      burstDecay: 800,
      direct: 0.22,
      dark: 0.4,
      body: { hz: 190, q: 4, level: 3 },
    }),
  },
  {
    id: "ratchet",
    title: "Ratchet",
    duration: 0.4,
    seed: 1506,
    tags: ["progress", "mechanism", "mechanical"],
    use: "Progress or a mechanism engaging: a dial turning, a setting stepping into place.",
    sample: clicker({
      events: [[0.004, 0.75], [0.056, 0.9], [0.105, 0.8], [0.152, 1], [0.197, 0.85], [0.24, 0.95], [0.282, 0.8], [0.323, 1]],
      bank: [[1400, 20, 1.6], [2700, 110, 2.2], [4500, 140, 2.2], [7200, 170, 2.4], [10_600, 120, 1.2]],
      burstDecay: 1000,
      direct: 0.2,
      dark: 0.35,
    }),
  },
  {
    id: "thock",
    title: "Thock",
    duration: 0.12,
    seed: 1607,
    tags: ["land", "settle", "wood"],
    use: "A product, card or block settling into place.",
    sample: clicker({
      events: [[0.004, 1]],
      bank: [[620, 7, 3.2], [1150, 9, 2.4], [2300, 10, 1.4], [4700, 7, 0.6]],
      burstDecay: 650,
      direct: 0.3,
      dark: 0.35,
      body: { hz: 240, q: 4, level: 4 },
    }),
  },
  {
    id: "shimmer",
    title: "Shimmer",
    duration: 0.9,
    seed: 1708,
    tags: ["highlight", "sheen", "premium"],
    use: "A highlight or sheen passing over the product; syncs on its peak, keep it under the voice.",
    sample: ({ time, noise }) => {
      if (time === 0) SHIMMER_AIR.reset();
      let value = 0;
      for (const partial of SHIMMER_PARTIALS) {
        const t = time - partial.onset;
        if (t < 0) continue;
        value += partial.amp * Math.sin(TAU * partial.hz * t) * (1 - Math.exp(-t * 220)) * Math.exp(-t * partial.decay);
      }
      const air = 0.3 * SHIMMER_AIR.step(noise) * Math.exp(-(((time - 0.28) / 0.17) ** 2));
      return value / 8 + air;
    },
  },
  {
    id: "ui-pop",
    title: "UI Pop",
    duration: 0.2,
    seed: 2101,
    gainDb: -12,
    tags: ["arrival", "graphic"],
    use: "An element visibly arrives; not every caption.",
    sample: (() => {
      const osc = glide();
      return ({ time, smoothNoise }) => {
        if (time === 0) osc.reset();
        const phase = osc.step(640 + 380 * Math.exp(-time * 70));
        const tone = Math.sin(phase) + 0.22 * Math.sin(2 * phase) + 0.06 * Math.sin(3 * phase);
        return tone * Math.exp(-time * 80) + 0.4 * smoothNoise * Math.exp(-time * 900);
      };
    })(),
  },
  {
    id: "ui-click",
    title: "UI Click",
    duration: 0.3,
    seed: 2202,
    gainDb: -13,
    tags: ["ui", "selection"],
    use: "A visible click, selection or editing action.",
    sample: noiseprint(UI_CLICK_PRINT),
  },
  {
    id: "camera-shutter",
    title: "Camera Shutter",
    duration: 0.31,
    seed: 2303,
    gainDb: -11,
    tags: ["camera", "cut"],
    use: "A substantial camera or layout change.",
    sample: noiseprint(CAMERA_SHUTTER_PRINT),
  },
  {
    id: "camera-shutter-light",
    title: "Light Shutter",
    duration: 0.16,
    seed: 2404,
    gainDb: -12,
    tags: ["camera", "cut", "subtle"],
    use: "A smaller framing or take change.",
    sample: rattle(0.02, 0.11, 0.15, clicker({
      events: [[0.02, 0.25], [0.06, 0.45], [0.07, 1], [0.1, 0.18]],
      bank: [[2600, 10, 1.2], [3100, 10, 1], [7200, 12, 2.4], [8000, 14, 2.2], [9750, 15, 2], [12_000, 10, 0.8]],
      burstDecay: 1300,
      direct: 0.25,
      dark: 0.45,
    })),
  },
  {
    id: "zoom-swish",
    title: "Zoom Swish",
    duration: 0.76,
    seed: 2505,
    gainDb: -8,
    tags: ["zoom", "movement"],
    use: "A motivated zoom; align its rise with travel.",
    sample: (() => {
      const air = sweepFilter(), air2 = sweepFilter(), body = sweepFilter();
      return ({ time, noise, smoothNoise }) => {
        if (time === 0) { air.reset(); air2.reset(); body.reset(); }
        const env = time < 0.15 ? (time / 0.15) ** 2.2 : time < 0.25 ? 1 - 0.15 * (time - 0.15) / 0.1 : 0.85 * Math.exp(-(time - 0.25) * 9);
        const center = time < 0.15 ? 600 + 1900 * (time / 0.15) : 300 + 2200 * Math.exp(-(time - 0.15) * 7);
        const hiss = air2.step(air.step(noise, center * 1.3, 0.8).low, center * 1.3, 0.8).low;
        const rumble = body.step(smoothNoise * 4, 160 + 140 * env, 0.8).low;
        return env * (0.7 * hiss + 1.6 * rumble);
      };
    })(),
  },
  {
    id: "hook-impact",
    title: "Hook Impact",
    duration: 1.9,
    seed: 2606,
    gainDb: -6,
    tags: ["hook", "reveal"],
    use: "The payoff of a reveal, below speech.",
    sample: (() => {
      const low = glide(), detuned = glide(), kick = glide(), crack = resonator(2000, 1.2), knock = resonator(450, 1.5);
      return ({ time, noise }) => {
        if (time === 0) { low.reset(); detuned.reset(); kick.reset(); crack.reset(); knock.reset(); }
        const hz = 23.4 * (1 + 0.6 * Math.exp(-time * 14));
        const a = low.step(hz), b = detuned.step(hz * 1.012);
        let buzz = 0;
        for (const [n, level] of [[3, 0.8], [4, 1], [5, 0.85], [6, 0.7], [7, 0.4], [9, 0.3], [10, 0.25]]) buzz += level * (Math.sin(n * a) + 0.6 * Math.sin(n * b));
        const tail = Math.exp(-time * 2);
        const body = Math.sin(kick.step(55 + 170 * Math.exp(-time * 38))) * Math.exp(-time * 9);   // the punch
        const thud = knock.step(noise) * Math.exp(-time * 60);
        const hit = crack.step(noise) * Math.exp(-time * 45) + 0.2 * noise * Math.exp(-time * 300);
        return Math.tanh(1.6 * (0.75 * Math.tanh(0.6 * buzz) * tail + 1.4 * body + 1.2 * thud + 0.8 * hit));
      };
    })(),
  },
  {
    id: "metallic-riser",
    title: "Metallic Riser",
    duration: 1.64,
    seed: 2707,
    gainDb: -6,
    tags: ["build", "reveal"],
    use: "Build anticipation and end at the reveal.",
    sample: (() => {
      const wash = sweepFilter(), wash2 = sweepFilter(), floor = sweepFilter();
      const partials = [2578, 3360, 4875, 6150, 7734].map((hz, index) => ({ hz, osc: glide(), level: [1, 0.6, 0.9, 0.5, 0.75][index] }));
      return ({ time, noise, smoothNoise }) => {
        if (time === 0) { wash.reset(); wash2.reset(); floor.reset(); for (const p of partials) p.osc.reset(); }
        const rise = Math.min(1, time / 1.39);
        const env = time <= 1.39 ? 0.03 + 0.97 * rise ** 2.5 : Math.exp(-(time - 1.39) * 14);
        const cutoff = 700 + 4300 * rise ** 2;
        const hiss = wash2.step(wash.step(noise, cutoff, 0.6).low, cutoff, 0.6).low;
        let ring = 0;
        for (const p of partials) ring += p.level * Math.sin(p.osc.step(p.hz * (0.94 + 0.08 * rise) * (1 + 0.004 * Math.sin(TAU * 7 * time))));
        const rumble = floor.step(smoothNoise * 4, 90, 0.8).low;
        return env * (0.8 * hiss + 0.22 * ring * rise ** 2) + 1.5 * rumble * (0.04 + 0.96 * rise ** 3) * (time <= 1.39 ? 1 : env);
      };
    })(),
  },
]);

export function wavBuffer(definition) {
  const pcm = synthesize(definition);
  const dataLength = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  for (let index = 0; index < pcm.length; index += 1) buffer.writeInt16LE(pcm[index], 44 + index * 2);
  return buffer;
}

export function soundManifestEntry(definition, buffer) {
  return {
    id: definition.id,
    title: definition.title,
    file: `${definition.id}.wav`,
    durationSeconds: definition.duration,
    sampleRate: SAMPLE_RATE,
    channels: 1,
    bitDepth: 16,
    tags: definition.tags,
    recommendedUse: definition.use,
    ...(definition.gainDb === undefined ? {} : { suggestedGainDb: definition.gainDb }),
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    license: "Apache-2.0",
    provenance: "Deterministically synthesized by scripts/generate-sfx.mjs; contains no third-party recording.",
  };
}
