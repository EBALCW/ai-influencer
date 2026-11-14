// Blueprint (ozalit) çizim motoru: her kare yalnızca t'nin işlevi. Canvas 2D, 2x örnekleme.
// film-styles/styles/07-line-diagrams/blueprint/STYLE.md kurallarının sadeleştirilmiş uygulaması:
// Prusya mavisi kâğıt, açık mavi-beyaz çizgi, dört kalınlık, çizim sırası, uçta parlayan kalem.
const W = 1080,
  H = 1920,
  SS = 2;
const INK = '#E7F0F9',
  PAPER = '#1C3E82',
  RED = '#F0503C';
const WT = { o: 5, d: 3.2, t: 2.2, h: 1.4 };
const HAND = '"Architects Daughter"',
  MONO = '"IBM Plex Mono"';
let ctx,
  SC = 1;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ramp = (t, t0, d) => clamp((t - t0) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const eio = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const eout = (x) => 1 - Math.pow(1 - x, 3);
const eback = (x) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const seq = (p, i, n, ov = 0.35) => {
  const w = 1 / (n - (n - 1) * ov);
  return clamp((p - i * w * (1 - ov)) / w);
};
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- yol üreticiler (nokta dizileri) ----
const line = (x1, y1, x2, y2) => [
  [x1, y1],
  [x2, y2],
];
function bez(p0, p1, p2, p3, n = 24) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n,
      v = 1 - u;
    o.push([
      v * v * v * p0[0] +
        3 * v * v * u * p1[0] +
        3 * v * u * u * p2[0] +
        u * u * u * p3[0],
      v * v * v * p0[1] +
        3 * v * v * u * p1[1] +
        3 * v * u * u * p2[1] +
        u * u * u * p3[1],
    ]);
  }
  return o;
}
function arc(cx, cy, rx, ry, a0, a1, n = 40) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return o;
}
function fn(f, x0, x1, n = 60) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    o.push([x, f(x)]);
  }
  return o;
}
const join = (...a) => a.flat();
function plen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++)
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
function ptrim(pts, p) {
  if (p >= 1) return pts;
  const T = plen(pts) * p;
  let L = 0;
  const o = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (L + d >= T) {
      const u = d ? (T - L) / d : 0;
      o.push([
        lerp(pts[i - 1][0], pts[i][0], u),
        lerp(pts[i - 1][1], pts[i][1], u),
      ]);
      return o;
    }
    L += d;
    o.push(pts[i]);
  }
  return o;
}
function pat(pts, u) {
  const q = ptrim(pts, clamp(u, 0.0001, 1));
  const a = q[q.length - 1],
    b = q[Math.max(0, q.length - 2)];
  return { x: a[0], y: a[1], ang: Math.atan2(a[1] - b[1], a[0] - b[0]) };
}

// ---- dönüşüm ----
function T(x, y, s, rot, f, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(flip ? -s : s, s);
  const o = SC;
  SC *= s;
  f();
  SC = o;
  ctx.restore();
}
const lw = (w) => (w * Math.pow(SC, 0.65)) / SC; // çizgi kalınlığı = kâğıt kalınlığı x zoom^0.65

// ---- mürekkep ----
function trace(pts, close) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function nib(x, y, r = 16) {
  const R = r / SC;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.25, 'rgba(210,232,255,.55)');
  g.addColorStop(1, 'rgba(160,200,255,0)');
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, 7);
  ctx.fill();
  ctx.restore();
}
function ink(pts, w = WT.d, p = 1, o = {}) {
  if (p <= 0 || pts.length < 2) return;
  const q = ptrim(pts, p),
    a = o.alpha ?? 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = o.color || INK;
  if (o.dash) {
    ctx.setLineDash(o.dash.map((d) => d / Math.pow(SC, 0.35)));
    ctx.lineDashOffset = -(o.phase || 0);
    ctx.lineCap = 'butt';
  }
  if (w >= WT.d && !o.noglow) {
    ctx.globalAlpha = 0.1 * a;
    ctx.lineWidth = lw(w) * 3.2;
    trace(q, o.close && p >= 1);
    ctx.stroke();
  }
  ctx.globalAlpha = a;
  ctx.lineWidth = lw(w);
  trace(q, o.close && p >= 1);
  ctx.stroke();
  ctx.restore();
  if (p < 1 && o.nib !== false) {
    const e = q[q.length - 1];
    nib(e[0], e[1]);
  }
}
function solid(pts, w = WT.o, p = 1, o = {}) {
  // önce kâğıtla doldur, sonra konturu çek (ressam sırası)
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(p * 2.5) * (o.fillAlpha ?? 0.97);
  ctx.fillStyle = o.fill || PAPER;
  trace(pts, true);
  ctx.fill();
  ctx.restore();
  ink(pts, w, p, { ...o, close: true });
}
function hatch(pts, gap = 12, p = 1, o = {}) {
  // 45 derece tarama, çizgi çizgi
  if (p <= 0) return;
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const h = y1 - y0,
    n = Math.ceil((x1 - x0 + h) / gap),
    shown = p * n;
  ctx.save();
  trace(pts, true);
  ctx.clip();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw(o.w || WT.h);
  ctx.globalAlpha = o.alpha ?? 0.75;
  ctx.lineCap = 'butt';
  for (let i = 0; i < shown; i++) {
    const u = clamp(shown - i),
      x = x0 - h + i * gap;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x + h * u, y1 - h * u);
    ctx.stroke();
  }
  ctx.restore();
}
function font(size, f = HAND, wgt = 400) {
  ctx.font = `${wgt} ${size}px ${f}, sans-serif`;
}
function text(str, x, y, size, o = {}) {
  // soldan sağa yazılır; p < 1 iken uçta kalem
  const p = o.p ?? 1;
  if (p <= 0) return 0;
  ctx.save();
  font(size, o.font || HAND, o.weight || 400);
  ctx.textBaseline = 'alphabetic';
  const full = ctx.measureText(str).width;
  let x0 = x;
  if (o.align === 'center') x0 = x - full / 2;
  else if (o.align === 'right') x0 = x - full;
  const chars = [...str],
    n = Math.ceil(p * chars.length),
    sub = chars.slice(0, n).join('');
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.color || INK;
  if (o.glow) {
    ctx.shadowColor = 'rgba(190,220,255,.55)';
    ctx.shadowBlur = o.glow * SS;
  }
  if (o.rot) {
    ctx.translate(x0, y);
    ctx.rotate(o.rot);
    ctx.fillText(sub, 0, 0);
  } else ctx.fillText(sub, x0, y);
  const wsub = ctx.measureText(sub).width;
  ctx.restore();
  if (p < 1 && o.nib !== false && !o.rot)
    nib(x0 + wsub + 4, y - size * 0.3, Math.max(12, size * 0.28));
  return full;
}
function tw(str, size, f = HAND) {
  ctx.save();
  font(size, f);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}
function arrow(x1, y1, x2, y2, w, p = 1, o = {}) {
  if (p <= 0) return;
  const hx = lerp(x1, x2, p),
    hy = lerp(y1, y2, p),
    a = Math.atan2(y2 - y1, x2 - x1),
    hs = o.head || 20;
  ink(
    [
      [x1, y1],
      [hx, hy],
    ],
    w,
    1,
    { nib: false, ...o },
  );
  ctx.save();
  ctx.fillStyle = o.color || INK;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.beginPath();
  ctx.moveTo(hx + Math.cos(a) * hs * 0.5, hy + Math.sin(a) * hs * 0.5);
  ctx.lineTo(hx - Math.cos(a - 0.42) * hs, hy - Math.sin(a - 0.42) * hs);
  ctx.lineTo(hx - Math.cos(a + 0.42) * hs, hy - Math.sin(a + 0.42) * hs);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function tagBox(str, cx, cy, size, o = {}) {
  // kâğıt zeminli etiket (çizginin üstünde okunur)
  const p = o.p ?? 1;
  if (p <= 0) return;
  const f = o.font || HAND,
    wd = tw(str, size, f),
    px = size * 0.32,
    h = size * 1.28;
  ctx.save();
  ctx.globalAlpha = clamp(p * 3) * 0.94 * (o.alpha ?? 1);
  ctx.fillStyle = PAPER;
  ctx.fillRect(cx - wd / 2 - px, cy - h / 2, wd + 2 * px, h);
  ctx.restore();
  text(str, cx, cy + size * 0.36, size, { ...o, align: 'center', font: f });
}
function dim(x1, y1, x2, y2, label, p = 1, o = {}) {
  // ölçü çizgisi: uzatma çizgileri, eğik çentikler, ortada yazı
  if (p <= 0) return;
  const a = Math.atan2(y2 - y1, x2 - x1),
    nx = -Math.sin(a),
    ny = Math.cos(a),
    e = o.ext ?? 22,
    pl = clamp(p * 1.4);
  ink(
    [
      [x1 - nx * e, y1 - ny * e],
      [x1 + nx * e, y1 + ny * e],
    ],
    WT.t,
    pl,
    { nib: false },
  );
  ink(
    [
      [x1, y1],
      [x2, y2],
    ],
    WT.t,
    pl,
  );
  if (pl >= 1)
    ink(
      [
        [x2 - nx * e, y2 - ny * e],
        [x2 + nx * e, y2 + ny * e],
      ],
      WT.t,
      1,
      { nib: false },
    );
  for (const [x, y, on] of [
    [x1, y1, pl > 0.05],
    [x2, y2, pl >= 1],
  ])
    if (on)
      ink(
        [
          [x - 11 * Math.cos(a - 0.785), y - 11 * Math.sin(a - 0.785)],
          [x + 11 * Math.cos(a - 0.785), y + 11 * Math.sin(a - 0.785)],
        ],
        WT.d,
        1,
        { nib: false },
      );
  if (label && p > 0.3)
    tagBox(
      label,
      (x1 + x2) / 2 + (o.lx || 0),
      (y1 + y2) / 2 + (o.ly || 0),
      o.size || 40,
      {
        font: o.font || MONO,
        weight: 500,
        p: clamp((p - 0.3) / 0.5),
        nib: false,
      },
    );
}
function balloon(n, x, y, tx, ty, p = 1, r = 26) {
  // numaralı balon + kılavuz çizgisi
  if (p <= 0) return;
  const a = Math.atan2(ty - y, tx - x);
  ink(
    [
      [x + Math.cos(a) * r, y + Math.sin(a) * r],
      [tx, ty],
    ],
    WT.h,
    clamp(p * 2),
    { nib: false },
  );
  ctx.save();
  ctx.globalAlpha = clamp(p * 3);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.restore();
  ink(arc(x, y, r, r, -1.57, 4.72, 30), WT.t, clamp(p * 2), { nib: false });
  if (p > 0.5)
    text(String(n), x, y + 11, 30, {
      font: MONO,
      weight: 500,
      align: 'center',
    });
  ctx.save();
  ctx.fillStyle = INK;
  ctx.globalAlpha = clamp(p * 2);
  ctx.beginPath();
  ctx.arc(tx, ty, 4.5, 0, 7);
  ctx.fill();
  ctx.restore();
}
function cloudPath(cx, cy, rx, ry, k = 14) {
  // revizyon bulutu / kümülüs: yay yay
  const o = [];
  for (let i = 0; i < k; i++) {
    const a0 = (i / k) * 6.2832,
      a1 = ((i + 1) / k) * 6.2832,
      x0 = cx + rx * Math.cos(a0),
      y0 = cy + ry * Math.sin(a0),
      x1 = cx + rx * Math.cos(a1),
      y1 = cy + ry * Math.sin(a1);
    const mx = (x0 + x1) / 2,
      my = (y0 + y1) / 2,
      r = Math.hypot(x1 - x0, y1 - y0) / 2,
      b = Math.atan2(y1 - y0, x1 - x0);
    o.push(...arc(mx, my, r, r, b + Math.PI, b + 2 * Math.PI, 8));
  }
  return o;
}

// ---- kâğıt: bir kez üretilir (tohumlu), her karede aynen basılır ----
function makePaper() {
  const c = document.createElement('canvas');
  c.width = W * SS;
  c.height = H * SS;
  const g = c.getContext('2d');
  g.scale(SS, SS);
  const R = rng(1903);
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#1A3877');
  gr.addColorStop(0.45, '#22498F');
  gr.addColorStop(1, '#183470');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  gr = g.createRadialGradient(W * 0.46, H * 0.36, 60, W * 0.5, H * 0.45, 1150);
  gr.addColorStop(0, 'rgba(48,98,178,.50)');
  gr.addColorStop(1, 'rgba(48,98,178,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  for (const [nw, nh, al] of [
    [9, 16, 0.5],
    [27, 48, 0.4],
    [68, 120, 0.28],
    [270, 480, 0.2],
  ]) {
    // fbm benzeri lekeler
    const n = document.createElement('canvas');
    n.width = nw;
    n.height = nh;
    const ng = n.getContext('2d'),
      id = ng.createImageData(nw, nh);
    for (let i = 0; i < nw * nh; i++) {
      const v = R();
      id.data[4 * i] =
        id.data[4 * i + 1] =
        id.data[4 * i + 2] =
          v > 0.5 ? 150 : 8;
      id.data[4 * i + 3] = Math.abs(v - 0.5) * 2 * 60 * al;
    }
    ng.putImageData(id, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(n, 0, 0, W, H);
  }
  for (let i = 0; i < 46; i++) {
    const x = R() * W,
      w = 16 + R() * 150;
    g.fillStyle =
      R() > 0.5
        ? `rgba(120,170,235,${0.012 + R() * 0.03})`
        : `rgba(4,12,40,${0.02 + R() * 0.045})`;
    g.fillRect(x, 0, w, H);
  } // kaplama izleri
  g.lineCap = 'round';
  for (let i = 0; i < 1500; i++) {
    const x = R() * W,
      y = R() * H,
      a = R() * 6.28,
      l = 6 + R() * 26;
    g.strokeStyle = `rgba(190,215,250,${0.03 + R() * 0.06})`;
    g.lineWidth = 0.6 + R() * 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  } // lifler
  for (let i = 0; i < 520; i++) {
    g.fillStyle =
      R() > 0.25
        ? `rgba(215,232,255,${0.06 + R() * 0.2})`
        : `rgba(3,10,34,${0.1 + R() * 0.25})`;
    g.beginPath();
    g.arc(R() * W, R() * H, 0.5 + R() * 1.5, 0, 7);
    g.fill();
  } // benekler
  for (const [x1, y1, x2, y2] of [
    [0, 1268, W, 1268],
    [540, 0, 540, H],
  ]) {
    // kat izleri
    const v = x1 === x2;
    g.strokeStyle = 'rgba(200,225,255,.13)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.strokeStyle = 'rgba(2,8,30,.20)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x1 + (v ? 3 : 0), y1 + (v ? 0 : 3));
    g.lineTo(x2 + (v ? 3 : 0), y2 + (v ? 0 : 3));
    g.stroke();
    for (let i = 0; i < 70; i++) {
      const u = R();
      g.fillStyle = `rgba(205,228,255,${0.03 + R() * 0.07})`;
      g.beginPath();
      g.ellipse(
        lerp(x1, x2, u) + (R() - 0.5) * 8,
        lerp(y1, y2, u) + (R() - 0.5) * 8,
        3 + R() * 16,
        1.5 + R() * 5,
        v ? 1.57 : 0,
        0,
        7,
      );
      g.fill();
    }
  }
  gr = g.createRadialGradient(W / 2, H / 2, 620, W / 2, H / 2, 1200);
  gr.addColorStop(0, 'rgba(3,9,30,0)');
  gr.addColorStop(1, 'rgba(3,9,30,.42)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  for (const [x, y, w, h, d] of [
    [0, 0, W, 46, 'v'],
    [0, H - 46, W, 46, 'V'],
    [0, 0, 46, H, 'h'],
    [W - 46, 0, 46, H, 'H'],
  ]) {
    // ağarmış kenarlar
    gr =
      d === 'v'
        ? g.createLinearGradient(0, 0, 0, 46)
        : d === 'V'
          ? g.createLinearGradient(0, H, 0, H - 46)
          : d === 'h'
            ? g.createLinearGradient(0, 0, 46, 0)
            : g.createLinearGradient(W, 0, W - 46, 0);
    gr.addColorStop(0, 'rgba(150,190,240,.20)');
    gr.addColorStop(1, 'rgba(150,190,240,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  }
  // pafta çerçevesi ve bölge işaretleri
  g.strokeStyle = INK;
  g.globalAlpha = 0.9;
  g.lineWidth = 3.5;
  g.strokeRect(30, 30, W - 60, H - 60);
  g.lineWidth = 1.4;
  g.strokeRect(44, 44, W - 88, H - 88);
  g.font = `500 17px ${MONO}`;
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.globalAlpha = 0.75;
  for (let i = 0; i < 8; i++) {
    const y = 44 + ((H - 88) * (i + 0.5)) / 8;
    g.fillText('ABCDEFGH'[i], 37, y + 6);
    g.fillText('ABCDEFGH'[i], W - 37, y + 6);
    if (i) {
      const yy = 44 + ((H - 88) * i) / 8;
      g.fillRect(30, yy, 14, 1.4);
      g.fillRect(W - 44, yy, 14, 1.4);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = 44 + ((W - 88) * (i + 0.5)) / 4;
    g.fillText(String(i + 1), x, 42);
    g.fillText(String(i + 1), x, H - 32);
    if (i) {
      const xx = 44 + ((W - 88) * i) / 4;
      g.fillRect(xx, 30, 1.4, 14);
      g.fillRect(xx, H - 44, 1.4, 14);
    }
  }
  return c;
}
