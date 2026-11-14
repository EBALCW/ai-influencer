// "Planör nasıl uçar?" — Blueprint stili, 1080x1920. Sahneler t'nin saf işlevi (hf-seek).
const TM = window.TIMING,
  { S, L, E, Wd } = window.PLAN,
  END = TM.duration;
const TITLES = [
  'PLANÖR · GENEL GÖRÜNÜŞ',
  'KALKIŞ · ÇEKME',
  'SÜZÜLÜŞ',
  'KANAT KESİTİ A–A',
  'SÜZÜLME ORANI',
  'SORU',
  'YÜKSELEN HAVA',
  'DAĞ DALGASI',
  'SONUÇ',
];
const HIDE_CAPTION = new Set([1, 2, 25, 26]); // büyük yazının kendisi altyazı olduğunda ikinci katman açılmaz
let PAPER_C;

// ---------- nesneler (yerel koordinat, burun sağda) ----------
function glider(p = 1, o = {}) {
  const farW = [
    [52, -20],
    [196, -112],
    [176, -117],
    [8, -22],
  ];
  const nearW = [
    [46, -4],
    [-138, 116],
    [-164, 113],
    [-14, -2],
  ];
  const fus = join(
    bez([206, 4], [198, -22], [150, -41], [96, -41], 12),
    bez([96, -41], [40, -40], [0, -22], [-60, -15], 12),
    [
      [-150, -13],
      [-196, -84],
      [-222, -84],
      [-206, -8],
    ],
    bez([-206, -3], [-120, 2], [-40, 8], [30, 30], 12),
    bez([30, 30], [90, 40], [184, 36], [206, 4], 12),
  );
  const stab = [
    [-252, -87],
    [-182, -87],
    [-173, -78],
    [-245, -78],
  ];
  solid(farW, WT.d, seq(p, 0, 5));
  solid(fus, WT.o, seq(p, 1, 5));
  solid(stab, WT.d, seq(p, 2, 5));
  ink(
    bez([174, -15], [150, -37], [108, -41], [70, -36], 10),
    WT.t,
    seq(p, 3, 5),
    { nib: false },
  );
  ink(
    bez([70, -36], [104, -22], [146, -13], [174, -15], 10),
    WT.t,
    seq(p, 3, 5),
    { nib: false },
  );
  ink(arc(84, 33, 15, 11, 0.1, 3.04, 12), WT.t, seq(p, 3, 5), { nib: false });
  solid(nearW, WT.o, seq(p, 4, 5));
  if (o.hatch) hatch(nearW, 9, o.hatch, { alpha: 0.6 });
  if (o.centre)
    ink(
      [
        [-270, -4],
        [250, 2],
      ],
      WT.h,
      o.centre,
      { dash: [26, 7, 5, 7], nib: false, alpha: 0.7 },
    );
}
function towplane(p = 1, spin = 0) {
  const farW = [
    [44, -50],
    [136, -118],
    [112, -123],
    [2, -50],
  ];
  const nearW = [
    [40, -46],
    [-84, 58],
    [-116, 55],
    [-8, -44],
  ];
  const fus = join(
    bez([150, 2], [150, -26], [122, -34], [82, -36], 8),
    bez([82, -36], [54, -66], [0, -64], [-22, -34], 10),
    [
      [-132, -18],
      [-160, -66],
      [-180, -66],
      [-162, -4],
    ],
    bez([-162, 0], [-80, 14], [0, 26], [60, 28], 10),
    bez([60, 28], [122, 30], [150, 22], [150, 2], 8),
  );
  solid(farW, WT.d, seq(p, 0, 4));
  solid(fus, WT.o, seq(p, 1, 4));
  solid(
    [
      [-196, -22],
      [-142, -22],
      [-134, -13],
      [-188, -13],
    ],
    WT.d,
    seq(p, 2, 4),
  );
  ink(bez([72, -36], [56, -52], [20, -52], [4, -36], 8), WT.t, seq(p, 2, 4), {
    nib: false,
  });
  ink(
    [
      [44, 27],
      [34, 56],
    ],
    WT.d,
    seq(p, 2, 4),
    { nib: false },
  );
  ink(arc(34, 62, 13, 13, 0, 6.3, 18), WT.d, seq(p, 2, 4), { nib: false });
  solid(nearW, WT.o, seq(p, 3, 4));
  if (p >= 1) {
    ink(arc(158, 2, 7, 46, 0, 6.3, 28), WT.t, 1, { nib: false, alpha: 0.9 });
    const a = spin * 6.283;
    ink(
      [
        [158, 2 - 46 * Math.cos(a)],
        [158, 2 + 46 * Math.cos(a)],
      ],
      WT.d,
      1,
      { nib: false },
    );
  }
}
function airfoil(c) {
  // NACA benzeri kesit; hücum kenarı (0,0), veter +x
  const up = [],
    lo = [];
  for (let i = 0; i <= 40; i++) {
    const x = (1 - Math.cos((Math.PI * i) / 40)) / 2,
      yt =
        5 *
        0.13 *
        (0.2969 * Math.sqrt(x) -
          0.126 * x -
          0.3516 * x * x +
          0.2843 * x ** 3 -
          0.1015 * x ** 4),
      yc =
        x < 0.4
          ? (0.045 / 0.16) * (0.8 * x - x * x)
          : (0.045 / 0.36) * (0.2 + 0.8 * x - x * x);
    up.push([x * c, -(yc + yt) * c]);
    lo.push([x * c, -(yc - yt) * c]);
  }
  return join(up, lo.reverse());
}

// ---------- pafta mobilyası ----------
function header(t, k) {
  const a = S[k],
    p = k === 0 ? 1 : ramp(t, a + 0.02, 0.4);
  ink(
    [
      [72, 290],
      [222, 290],
      [222, 352],
      [72, 352],
      [72, 290],
    ],
    WT.t,
    1,
    { nib: false },
  );
  text(`ŞEK. ${k + 1}`, 147, 334, 32, {
    font: MONO,
    weight: 500,
    align: 'center',
  });
  text(TITLES[k], 244, 337, 40, { p });
  ink(
    [
      [72, 372],
      [900, 372],
    ],
    WT.h,
    1,
    { nib: false, alpha: 0.8 },
  );
  ink(
    [
      [72, 378],
      [900, 378],
    ],
    WT.h,
    1,
    { nib: false, alpha: 0.45 },
  );
}
function topBand() {
  text('NASIL ÇALIŞIR?', 72, 168, 40, { alpha: 0.9 });
  text('PAFTA 01', 1008, 166, 26, {
    font: MONO,
    weight: 500,
    align: 'right',
    alpha: 0.85,
  });
  ink(
    [
      [72, 196],
      [1008, 196],
    ],
    WT.h,
    1,
    { nib: false, alpha: 0.7 },
  );
  for (let i = 0; i <= 12; i++) {
    const x = 72 + i * 78;
    ink(
      [
        [x, 196],
        [x, i % 4 ? 208 : 220],
      ],
      WT.h,
      1,
      { nib: false, alpha: 0.7 },
    );
  }
  text('ANLATIM VİDEOSU · ÖLÇEKSİZ ŞEMA', 72, 248, 17, {
    font: MONO,
    weight: 500,
    alpha: 0.55,
  });
}
function notesColumn(t) {
  text('GENEL NOTLAR', 72, 1322, 24, { font: MONO, weight: 500, alpha: 0.85 });
  ink(
    [
      [72, 1334],
      [1008, 1334],
    ],
    WT.h,
    1,
    { nib: false, alpha: 0.7 },
  );
  const shown = TM.phrases.filter((ph) => ph.s <= t),
    list = shown.slice(-6);
  list.forEach((ph, i) => {
    const y = 1378 + i * 39,
      p = ramp(t, ph.s - 0.12, 0.35);
    text(String(ph.n).padStart(2, '0'), 72, y, 22, {
      font: MONO,
      weight: 500,
      alpha: 0.6,
    });
    text(ph.text, 118, y, 27, { p, alpha: 0.78, nib: p < 1 });
  });
}
function titleBlock(t, k) {
  const x0 = 60,
    x1 = 1020,
    y0 = 1612,
    y1 = 1808,
    a = 0.85;
  ink(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ],
    WT.t,
    1,
    { nib: false, alpha: a },
  );
  for (const y of [1678, 1744])
    ink(
      [
        [x0, y],
        [x1, y],
      ],
      WT.h,
      1,
      { nib: false, alpha: a },
    );
  ink(
    [
      [760, y0],
      [760, 1678],
    ],
    WT.h,
    1,
    { nib: false, alpha: a },
  );
  for (const x of [300, 540, 800])
    ink(
      [
        [x, 1678],
        [x, 1744],
      ],
      WT.h,
      1,
      { nib: false, alpha: a },
    );
  const cell = (lab, val, x, y, o = {}) => {
    text(lab, x + 12, y + 22, 15, { font: MONO, weight: 500, alpha: 0.6 });
    text(val, x + 12, y + 54, o.size || 27, {
      font: o.hand ? HAND : MONO,
      weight: 500,
      alpha: 0.92,
    });
  };
  cell('PROJE', 'PLANÖR NASIL UÇAR?', x0, y0, { hand: true, size: 30 });
  cell('PAFTA', '1 / 1', 760, y0);
  cell('MOTOR', 'YOK', x0, 1678);
  cell('YAKIT', 'YOK', 300, 1678);
  cell('ÖLÇEK', 'ŞEMATİK', 540, 1678);
  cell('ŞEKİL', `${k + 1} / 9`, 800, 1678);
  cell('KAYNAK', 'NASA GLENN · FAI · PERLAN PROJECT', x0, 1744, { size: 24 });
  if (k === 8)
    for (const [x, j] of [
      [190, 1],
      [430, 3],
    ]) {
      const p = ramp(t, Wd(10, j), 0.18);
      ink(
        [
          [x, 1716],
          [x + 12, 1730],
          [x + 38, 1698],
        ],
        WT.d,
        p,
        { nib: false },
      );
    }
}
function wrap(str, size, maxw) {
  const rows = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const nx = cur ? cur + ' ' + w : w;
    if (tw(nx, size) > maxw && cur) {
      rows.push(cur);
      cur = w;
    } else cur = nx;
  }
  if (cur) rows.push(cur);
  return rows;
}
function caption(t) {
  // altyazı = çizim notu: çift cetvelli yarı saydam kutu, NOT / n sekmesi, yazı soldan sağa yazılır
  const ph = TM.phrases.find((q) => t >= q.s && t < q.e);
  if (!ph || HIDE_CAPTION.has(ph.n)) return;
  const size = 46,
    lh = 58,
    rows = wrap(ph.text, size, 640),
    wmax = Math.max(...rows.map((r) => tw(r, size))),
    bw = Math.min(720, wmax + 72),
    bh = rows.length * lh + 40,
    bx = 540 - bw / 2,
    by = 1236 - bh;
  ctx.save();
  ctx.fillStyle = 'rgba(9,24,62,.88)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();
  ink(
    [
      [bx, by],
      [bx + bw, by],
      [bx + bw, by + bh],
      [bx, by + bh],
      [bx, by],
    ],
    WT.t,
    1,
    { nib: false },
  );
  ink(
    [
      [bx + 7, by + 7],
      [bx + bw - 7, by + 7],
      [bx + bw - 7, by + bh - 7],
      [bx + 7, by + bh - 7],
      [bx + 7, by + 7],
    ],
    WT.h,
    1,
    { nib: false, alpha: 0.7 },
  );
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(bx, by - 30, 104, 30);
  ctx.restore();
  text(`NOT / ${String(ph.n).padStart(2, '0')}`, bx + 52, by - 8, 19, {
    font: MONO,
    weight: 500,
    align: 'center',
    color: '#0F2350',
  });
  ink(
    [
      [bx + bw, by + bh / 2],
      [bx + bw + 16, by + bh / 2],
    ],
    WT.t,
    1,
    { nib: false },
  );
  const total = rows.join('').length,
    p = ramp(t, ph.s, 0.35);
  let done = 0;
  rows.forEach((r, i) => {
    const pr = clamp((p * total - done) / r.length);
    done += r.length;
    text(r, 540, by + 20 + lh * (i + 1) - 14, size, {
      align: 'center',
      p: pr,
      nib: pr < 1,
    });
  });
}
function ground(y, x0, x1, p = 1, gap = 14) {
  ink(
    [
      [x0, y],
      [x1, y],
    ],
    WT.o,
    p,
    { nib: false },
  );
  hatch(
    [
      [x0, y + 3],
      [x1, y + 3],
      [x1, y + 44],
      [x0, y + 44],
    ],
    gap,
    p,
    { alpha: 0.55 },
  );
}
function bigText(str, x, y, size, p, o = {}) {
  text(str, x, y, size, { align: 'center', p, glow: 7, ...o });
}
function cross(x, y, r, p) {
  ink(
    [
      [x - r, y - r],
      [x + r, y + r],
    ],
    WT.o,
    clamp(p * 2),
    { nib: false },
  );
  ink(
    [
      [x + r, y - r],
      [x - r, y + r],
    ],
    WT.o,
    clamp(p * 2 - 1),
    { nib: false },
  );
}

// ---------- sahneler ----------
const GX = 566,
  GY = 652,
  GS = 1.5; // kahraman planör (ŞEK. 1 ve 9 aynı yerde: döngü)
function heroGlider(t, hatchP) {
  const bob = Math.sin(t * 1.7) * 5;
  T(GX, GY + bob, GS, 0.035 + Math.sin(t * 1.1) * 0.006, () =>
    glider(1, { hatch: hatchP, centre: 1 }),
  );
  return bob;
}

function s1(t) {
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.55 + i * 0.2) % 1,
      y = 470 + i * 62 + (i % 2) * 18;
    ink(
      [
        [990 - ph * 980, y],
        [990 - ph * 980 - 110, y],
      ],
      WT.h,
      1,
      { nib: false, alpha: 0.5 * Math.sin(ph * 3.14) },
    );
  } // geçen hava
  const bob = heroGlider(t, 0.32 + ramp(t, 0, 1.6) * 0.68);
  // burunda hayalet pervane (çıkarılmış parça = kesik çizgi), üstüne çarpı
  const nx = GX + 212 * GS,
    ny = GY + bob + 14;
  ink(arc(nx + 4, ny, 10, 58, 0, 6.3, 30), WT.t, 1, {
    dash: [9, 7],
    nib: false,
    alpha: 0.85,
  });
  cross(nx + 4, ny, 34, 0.5 + ramp(t, 0, Wd(0, 1)) * 0.5);
  bigText('MOTOR YOK', 540, 918, 92, 1);
  const pf = ramp(t, Wd(0, 2) + 0.05, 0.4);
  bigText('YAKIT YOK', 540, 1022, 92, pf);
  // menzil ölçüsü: tek uçuşta 3.008 km (canlı sayı)
  const pd = ramp(t, Wd(0, 4), 0.55),
    pc = eout(ramp(t, Wd(0, 6), Wd(0, 8) + 0.36 - Wd(0, 6)));
  if (pd > 0) {
    const km = Math.round(3008 * pc),
      lab = `${km >= 1000 ? Math.floor(km / 1000) + '.' + String(km % 1000).padStart(3, '0') : km} KM`;
    dim(118, 452, 884, 452, lab, pd, { size: 56 });
    text('TEK UÇUŞ · FAI REKORU (2003)', 501, 412, 22, {
      font: MONO,
      weight: 500,
      align: 'center',
      p: ramp(t, Wd(0, 6), 0.4),
      alpha: 0.9,
      nib: false,
    });
    if (pc > 0 && pc < 1)
      T(lerp(150, 850, pc), 452 - 44, 0.16, 0, () => glider(1));
  }
  const pq = ramp(t, Wd(1, 3), 0.3);
  if (pq > 0) {
    solid(cloudPath(196, 742, 116, 56, 13), WT.d, pq);
    text('NASIL?', 196, 761, 54, { align: 'center', p: pq, glow: 6 });
  }
}
function s2(t) {
  const a = S[1],
    rel = Wd(3, 1),
    pr = eio(ramp(t, rel, 1.3)),
    climb = (t - a) * 9;
  ground(1010, 60, 1020, ramp(t, a - 0.3, 0.5));
  const gx = 300 + climb + pr * 30,
    gy = 770 - climb * 0.5 - pr * 6,
    grot = lerp(-0.2, 0.05, pr);
  const tx = 690 + climb + pr * 230,
    ty = 540 - climb * 0.5 - pr * 130,
    trot = lerp(-0.2, -0.34, pr);
  const nose = [
      gx + Math.cos(grot) * 206 * 0.8,
      gy + Math.sin(grot) * 206 * 0.8,
    ],
    tail = [
      tx - Math.cos(trot) * 170 * 0.72,
      ty - Math.sin(trot) * 170 * 0.72 - 6,
    ];
  const pv = ramp(t, Wd(2, 5), 0.5); // vinç: seçenek, kesik çizgiyle
  if (pv > 0) {
    solid(
      [
        [730, 950],
        [850, 950],
        [850, 1008],
        [730, 1008],
      ],
      WT.d,
      pv,
    );
    ink(arc(774, 979, 19, 19, 0, 6.3, 20), WT.t, pv, { nib: false });
    ink(
      [
        [774, 960],
        [nose[0] + 30, nose[1] + 60],
      ],
      WT.t,
      pv,
      { dash: [14, 10], alpha: 0.75 * (1 - pr) },
    );
    tagBox('VİNÇ', 900, 930, 38, { p: pv });
  }
  if (pr <= 0)
    ink([tail, nose], WT.t, ramp(t, a - 0.1, 0.4), { nib: false }); // halat
  else {
    const sw = Math.sin((t - rel) * 9) * 14 * (1 - pr * 0.5),
      ln = lerp(
        Math.hypot(nose[0] - tail[0], nose[1] - tail[1]),
        120,
        clamp(pr * 2),
      );
    ink(
      bez(
        tail,
        [tail[0] - ln * 0.4, tail[1] + ln * 0.2 + sw],
        [tail[0] - ln * 0.8, tail[1] + ln * 0.5 - sw],
        [tail[0] - ln, tail[1] + ln * 0.62],
        14,
      ),
      WT.t,
      1,
      { nib: false },
    );
    for (let i = 0; i < 5; i++) {
      const an = -2.2 + i * 0.5,
        r0 = 16 + pr * 22,
        r1 = r0 + 20;
      ink(
        [
          [nose[0] + 16 + Math.cos(an) * r0, nose[1] + Math.sin(an) * r0],
          [nose[0] + 16 + Math.cos(an) * r1, nose[1] + Math.sin(an) * r1],
        ],
        WT.t,
        1,
        { nib: false, alpha: 1 - pr },
      );
    }
  }
  T(tx, ty, 0.72, trot, () => towplane(ramp(t, a - 0.5, 0.9), t * 2.3));
  T(gx, gy, 0.8, grot, () => glider(ramp(t, a - 0.6, 0.9)));
  if (pr < 0.5)
    tagBox('ÇEKİCİ UÇAK', 600, 428, 38, {
      p: ramp(t, Wd(2, 2), 0.35),
      alpha: 1 - pr * 2,
    });
  if (pr <= 0)
    tagBox(
      'HALAT',
      (nose[0] + tail[0]) / 2 + 40,
      (nose[1] + tail[1]) / 2 + 50,
      36,
      { p: ramp(t, Wd(2, 7), 0.3) },
    );
  bigText('HALAT BIRAKILDI', 400, 952, 58, ramp(t, Wd(3, 0) + 0.1, 0.45));
  if (t < Wd(3, 0))
    tagBox('PLANÖR', 230, 930, 38, { p: ramp(t, Wd(2, 6), 0.3) });
}
function s3(t) {
  const a = S[2],
    P0 = [100, 500],
    P1 = [960, 792],
    u = lerp(0.16, 0.5, eio(ramp(t, a - 0.2, S[3] - a + 0.4))),
    ang = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]);
  ground(1010, 60, 1020, 1);
  ink([P0, P1], WT.t, ramp(t, a - 0.5, 0.7), {
    dash: [30, 8, 6, 8],
    nib: false,
  });
  ink(
    [
      [P0[0], P0[1]],
      [520, P0[1]],
    ],
    WT.h,
    1,
    { dash: [8, 8], nib: false, alpha: 0.7 },
  );
  ink(arc(P0[0], P0[1], 250, 250, 0, ang, 14), WT.h, ramp(t, a, 0.5), {
    nib: false,
  });
  const gx = lerp(P0[0], P1[0], u),
    gy = lerp(P0[1], P1[1], u);
  const ph = ramp(t, Wd(3, 5), 0.45); // canlı yükseklik ölçüsü: planör alçaldıkça kısalır
  if (ph > 0)
    dim(gx - 30, gy + 96, gx - 30, 1010, 'YÜKSEKLİK', ph, {
      size: 30,
      font: HAND,
      ext: 16,
    });
  const pv = ramp(t, Wd(3, 6), 0.45);
  if (pv > 0) {
    const d = 190 + 150 * eout(ramp(t, Wd(3, 6), 1.2));
    arrow(
      gx + Math.cos(ang) * 190,
      gy + Math.sin(ang) * 190 - 4,
      gx + Math.cos(ang) * (190 + d * 0.72),
      gy + Math.sin(ang) * (190 + d * 0.72) - 4,
      WT.o,
      pv,
      { head: 30 },
    );
    tagBox(
      'HIZ',
      gx + Math.cos(ang) * 270 + 26,
      gy + Math.sin(ang) * 270 - 62,
      46,
      { p: pv },
    );
  }
  T(gx, gy - 12, 0.82, ang, () => glider(ramp(t, a - 0.6, 0.8)));
  bigText('HEP ALÇALIR', 600, 462, 62, ramp(t, Wd(3, 3), 0.4));
}
function s4(t) {
  const a = S[3],
    c = 600,
    ox = 205,
    oy = 742,
    aoa = 0.13;
  const shape = airfoil(c).map(([x, y]) => [
    ox + x * Math.cos(aoa) - y * Math.sin(aoa),
    oy + x * Math.sin(aoa) + y * Math.cos(aoa),
  ]);
  const pl = ramp(t, a - 0.5, 0.9);
  for (let j = 0; j < 8; j++) {
    // akım çizgileri: kanadın arkasında aşağı döner
    const d = [-250, -168, -102, -52, 56, 104, 168, 240][j],
      near = Math.exp(-Math.abs(d) / 150);
    const f = (x) => {
      const s = (x - ox) / c,
        bump = Math.exp(-(((s - 0.34) / 0.42) ** 2)),
        down = clamp((s - 0.25) / 1.0) ** 1.4,
        up = Math.exp(-(((s + 0.08) / 0.2) ** 2));
      return (
        oy +
        20 +
        d +
        (d < 0 ? -1 : 0.55) * 62 * bump * near -
        26 * up * near +
        132 * down * (0.35 + 0.65 * near)
      );
    };
    ink(fn(f, 50, 1030, 70), j === 3 || j === 4 ? WT.t : WT.h, pl, {
      dash: [34, 16],
      phase: t * 150,
      nib: false,
      alpha: 0.9,
    });
  }
  solid(shape, WT.o, ramp(t, a - 0.6, 0.8));
  hatch(shape, 13, ramp(t, a - 0.15, 0.9), { alpha: 0.7 });
  ink(
    [
      [ox - 60, oy - 8],
      [ox + c + 70, oy + 80],
    ],
    WT.h,
    1,
    { dash: [26, 7, 5, 7], nib: false, alpha: 0.7 },
  );
  balloon(1, 196, 560, ox + 150, oy - 40, ramp(t, Wd(4, 0), 0.3));
  tagBox('KANAT', 300, 560, 40, { p: ramp(t, Wd(4, 0) + 0.1, 0.3) });
  const pdn = ramp(t, Wd(4, 2), 0.4);
  if (pdn > 0) {
    arrow(872, 838, 908, 1000, WT.o, pdn, { head: 30 });
    tagBox('HAVA AŞAĞI', 716, 1010, 44, { p: pdn });
  }
  const pup = eback(ramp(t, Wd(4, 7), 0.32));
  if (t > Wd(4, 7) + 0.02) {
    arrow(470, 668, 470, 668 - 232 * pup, 9, 1, { head: 46 });
    bigText('KALDIRMA', 690, 492, 72, ramp(t, Wd(4, 7), 0.35));
  }
}
function s5(t) {
  const a = S[4],
    A = [220, 520],
    B = [220, 868],
    C = [900, 868];
  ink([A, B], WT.d, ramp(t, a - 0.4, 0.5), { nib: false });
  ink([B, C], WT.d, ramp(t, a - 0.2, 0.6));
  ink([A, C], WT.t, ramp(t, a - 0.1, 0.8), { dash: [30, 8, 6, 8], nib: false });
  dim(142, 520, 142, 868, '1 KM', ramp(t, Wd(5, 3) - 0.15, 0.4), { size: 40 });
  const pc = ramp(t, Wd(5, 6) - 0.45, 0.6),
    done = t >= Wd(5, 7);
  dim(
    220,
    940,
    900,
    940,
    done ? '40–50 KM' : `${Math.round(40 * eout(pc))} KM`,
    ramp(t, Wd(5, 5), 0.5),
    { size: 48 },
  );
  const u = lerp(0.06, 0.8, eio(ramp(t, a, S[5] - a))),
    ang = Math.atan2(C[1] - A[1], C[0] - A[0]);
  T(lerp(A[0], C[0], u), lerp(A[1], C[1], u) - 30, 0.36, ang, () => glider(1));
  bigText('1 : 40–50', 650, 500, 76, ramp(t, Wd(5, 7), 0.35), {
    font: MONO,
    weight: 500,
  });
  // gerçek ölçek şeridi: 1:45 eğim
  const ps = ramp(t, Wd(5, 8), 0.5);
  ink(
    [
      [220, 1010],
      [900, 1010],
    ],
    WT.h,
    ps,
    { dash: [8, 8], nib: false, alpha: 0.7 },
  );
  ink(
    [
      [220, 1010 - 15],
      [900, 1010],
    ],
    WT.t,
    ps,
    { nib: false },
  );
  text('GERÇEK EĞİM', 220, 984, 24, {
    font: MONO,
    weight: 500,
    p: ps,
    alpha: 0.9,
    nib: false,
  });
  text('ÇİZİM ÖLÇEKSİZ', 900, 560, 22, {
    font: MONO,
    weight: 500,
    align: 'right',
    p: ramp(t, a + 0.3, 0.4),
    alpha: 0.8,
    nib: false,
  });
}
function s6(t) {
  const a = S[5],
    P0 = [96, 560],
    P1 = [860, 962],
    ang = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]),
    u = lerp(0.12, 0.7, eio(ramp(t, a - 0.2, S[6] - a + 0.3)));
  ground(966, 60, 1020, 1);
  ink([P0, P1], WT.t, ramp(t, a - 0.5, 0.7), {
    dash: [30, 8, 6, 8],
    nib: false,
  });
  T(lerp(P0[0], P1[0], u), lerp(P0[1], P1[1], u) - 12, 0.62, ang, () =>
    glider(ramp(t, a - 0.5, 0.7)),
  );
  bigText('HEP ALÇALIYORSA…', 540, 470, 62, ramp(t, Wd(6, 1), 0.45));
  const pq = eback(ramp(t, Wd(6, 5), 0.3));
  if (pq > 0) {
    ctx.save();
    ctx.translate(770, 800);
    ctx.scale(pq, pq);
    text('?', 0, 0, 300, { align: 'center', glow: 10 });
    ctx.restore();
  }
  const pr = ramp(t, Wd(6, 3), 0.5);
  if (pr > 0) {
    ink(cloudPath(P1[0] - 6, P1[1] - 8, 96, 50, 12), WT.d, pr, { close: true });
    tagBox('SAATLERCE?', 330, 900, 44, { p: pr });
  }
}
function s7(t) {
  const a = S[6],
    cx = 566,
    yb = 1000,
    yt = 592;
  ground(yb, 60, 1020, ramp(t, a - 0.3, 0.5));
  const pu = eio(ramp(t, L(8) + 0.1, S[7] - L(8) - 0.45)); // pilot sütunda daire çizerek tırmanır
  const pUp = ramp(t, a + 0.05, 0.9),
    pSun = ramp(t, a - 0.35, 0.8),
    pRay = ramp(t, Wd(7, 3), 0.4),
    pHeat = ramp(t, Wd(7, 5), 0.5),
    pCol = ramp(t, Wd(7, 6), 1.1),
    pCloud = ramp(t, Wd(7, 10), 0.7),
    pT = ramp(t, Wd(7, 12), 0.3);
  hatch(
    [
      [280, yb + 3],
      [752, yb + 3],
      [752, yb + 44],
      [280, yb + 44],
    ],
    7,
    pHeat,
    { alpha: 0.9 },
  ); // ısınan tarla: sık tarama
  if (pSun > 0) {
    ink(arc(176, 500, 46, 46, 0, 6.3, 30), WT.o, pSun, { close: true });
    for (let i = 0; i < 12; i++) {
      const an = i * 0.5236 + t * 0.12;
      ink(
        [
          [176 + Math.cos(an) * 62, 500 + Math.sin(an) * 62],
          [176 + Math.cos(an) * 88, 500 + Math.sin(an) * 88],
        ],
        WT.t,
        pRay,
        { nib: false },
      );
    }
    for (let i = 0; i < 3; i++)
      ink(
        [
          [226 + i * 24, 572 - i * 18],
          [300 + i * 62, 990],
        ],
        WT.h,
        pHeat,
        { dash: [16, 12], phase: t * 90, nib: false, alpha: 0.8 },
      );
    tagBox('GÜNEŞ', 176, 630, 34, { p: pRay });
  }
  const edge = (s) =>
    fn((y) => 0, 0, 1, 1) &&
    Array.from({ length: 40 }, (_, i) => {
      const y = lerp(yb, yt, i / 39);
      return [
        cx + s * (118 + 13 * Math.sin(y / 46 + t * 1.6 + (s > 0 ? 1.3 : 0))),
        y,
      ];
    });
  if (pCol > 0) {
    ink(edge(-1), WT.t, pCol, { dash: [20, 12], nib: false });
    ink(edge(1), WT.t, pCol, { dash: [20, 12], nib: false });
    for (let i = 0; i < 9; i++) {
      const xx = cx - 84 + (i % 3) * 84 + ((i * 37) % 23) - 11,
        ph = (t * 0.42 + i * 0.137) % 1,
        y1 = lerp(yb - 10, yt + 80, ph),
        top = lerp(yb, yt, pCol);
      if (y1 - 70 > top)
        arrow(xx, y1, xx, y1 - 70, WT.t, 1, {
          head: 15,
          alpha: Math.sin(ph * 3.14) * 0.9,
        });
    }
  }
  if (pu <= 0) {
    const q = eio(ramp(t, a, L(8) + 0.1 - a));
    T(lerp(236, cx + 35, q), lerp(826, 909, q), lerp(0.5, 0.3, q), 0.16, () =>
      glider(ramp(t, a - 0.5, 0.7)),
    );
  } // soru sahnesindeki planör sütuna doğru süzülür
  if (pUp > 0 && pCol <= 0)
    for (let i = 0; i < 3; i++)
      arrow(
        cx - 84 + i * 84,
        940,
        cx - 84 + i * 84,
        940 - 280 * eout(pUp),
        WT.o,
        1,
        { head: 30 },
      );
  if (pCloud > 0) {
    solid(cloudPath(cx + 10, 520, 178, 50, 13), WT.d, pCloud, {
      fillAlpha: 0.9,
    });
  }
  if (pT > 0) {
    balloon(2, 150, 800, cx - 122, 820, pT);
    bigText('TERMİK', 280, 912, 76, pT);
  }
  if (pu > 0) {
    const hel = (u) => {
      const an = u * 6.2832 * 3 - 1.2;
      return [
        cx + 96 * Math.cos(an),
        lerp(930, 640, u) + 22 * Math.sin(an),
        Math.sin(an),
      ];
    };
    const pts = [];
    for (let i = 0; i <= 120 * pu; i++) pts.push(hel(i / 120).slice(0, 2));
    if (pts.length > 1)
      ink(pts, WT.t, 1, { dash: [10, 8], nib: false, alpha: 0.85 });
    const [hx, hy, dep] = hel(pu),
      an = pu * 6.2832 * 3 - 1.2,
      left = Math.sin(an) > 0;
    T(hx, hy, 0.3 + 0.05 * dep, left ? 0.12 : -0.12, () => glider(1), left);
    const pa = ramp(t, Wd(8, 4), 0.4);
    if (pa > 0) {
      arrow(836, 960, 836, lerp(960, 720, pu), WT.d, 1, { head: 24 });
      tagBox('TIRMANIŞ', 800, 668, 40, { p: pa });
    }
  }
}
function s8(t) {
  const a = S[7],
    kmY = (km) => 1000 - km * 24,
    RX = 884;
  ground(1000, 60, 1020, ramp(t, a - 0.3, 0.5));
  const mtn = [
    [70, 1000],
    [190, 946],
    [262, 894],
    [302, 873],
    [346, 902],
    [420, 955],
    [500, 1000],
  ];
  solid(mtn, WT.o, ramp(t, a - 0.5, 0.8));
  hatch(mtn, 10, ramp(t, a, 0.7), { alpha: 0.7 });
  const pw = ramp(t, a + 0.1, 0.5);
  for (let i = 0; i < 3; i++)
    arrow(78, 600 + i * 92, 78 + 120 * pw, 600 + i * 92, WT.d, pw > 0 ? 1 : 0, {
      head: 20,
    });
  tagBox('RÜZGÂR', 150, 556, 36, { p: ramp(t, a + 0.25, 0.3) });
  const pl = ramp(t, Wd(9, 2), 1.6); // dağ ardı dalgalar
  [836, 724, 612].forEach((y0, i) => {
    const f = (x) => {
      const g = clamp((x - 150) / 150),
        s = g * g * (3 - 2 * g),
        ph = ((x - 302) / 248) * 6.2832;
      return (
        y0 -
        (i === 0 ? 30 : 42) * Math.cos(ph) * s -
        (i === 0 ? 34 * Math.exp(-(((x - 302) / 120) ** 2)) : 0)
      );
    };
    ink(fn(f, 60, 860, 90), WT.t, pl, {
      dash: [34, 14],
      phase: t * 160,
      nib: false,
      alpha: 0.9,
    });
  });
  tagBox('DALGA', 426, 566, 36, { p: ramp(t, Wd(9, 5), 0.3) });
  // irtifa cetveli (şematik, 0-25 km)
  const prl = ramp(t, a + 0.3, 0.7);
  ink(
    [
      [RX, 1000],
      [RX, lerp(1000, kmY(25), prl)],
    ],
    WT.d,
    1,
    { nib: false },
  );
  for (let k = 0; k <= 25; k += 1) {
    const y = kmY(k);
    if (y < lerp(1000, kmY(25), prl)) continue;
    ink(
      [
        [RX - (k % 5 ? 9 : 20), y],
        [RX, y],
      ],
      k % 5 ? WT.h : WT.t,
      1,
      { nib: false },
    );
    if (k % 5 === 0 && k)
      text(String(k), RX - 28, y + 9, 24, {
        font: MONO,
        weight: 500,
        align: 'right',
      });
  }
  text('KM', RX, kmY(25) - 14, 22, {
    font: MONO,
    weight: 500,
    align: 'center',
    p: prl,
    nib: false,
  });
  const pc = eio(ramp(t, Wd(9, 5) + 0.2, Wd(9, 7) + 0.4 - Wd(9, 5) - 0.2)),
    km = lerp(6, 22.6, pc),
    gy = kmY(km),
    gx = 716;
  ink(
    [
      [gx, kmY(6)],
      [gx, gy + 20],
    ],
    WT.h,
    1,
    { dash: [8, 8], nib: false, alpha: 0.8 },
  );
  T(gx, gy, 0.34, -0.3, () => glider(ramp(t, a - 0.3, 0.6)));
  ink(
    [
      [gx + 76, gy],
      [RX - 24, gy],
    ],
    WT.h,
    1,
    { nib: false },
  );
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(RX - 4, gy);
  ctx.lineTo(RX - 24, gy - 9);
  ctx.lineTo(RX - 24, gy + 9);
  ctx.fill();
  ctx.restore();
  const pb = ramp(t, Wd(9, 7), 0.35);
  if (pb > 0) {
    bigText('22+ KM', 350, 478, 100, pb);
    text('PERLAN 2 · 2 EYLÜL 2018', 350, 518, 22, {
      font: MONO,
      weight: 500,
      align: 'center',
      p: ramp(t, Wd(9, 8), 0.4),
      alpha: 0.9,
      nib: false,
    });
  } else if (pc > 0)
    tagBox(`${km.toFixed(0)} KM`, 590, gy - 34, 34, {
      font: MONO,
      weight: 500,
    });
}
function s9(t) {
  const a = S[8];
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.55 + i * 0.2) % 1,
      y = 470 + i * 62 + (i % 2) * 18;
    ink(
      [
        [990 - ph * 980, y],
        [990 - ph * 980 - 110, y],
      ],
      WT.h,
      1,
      { nib: false, alpha: 0.5 * Math.sin(ph * 3.14) },
    );
  }
  const bob = heroGlider(t, 1),
    nx = GX + 212 * GS,
    ny = GY + bob + 14;
  ink(arc(nx + 4, ny, 10, 58, 0, 6.3, 30), WT.t, 1, {
    dash: [9, 7],
    nib: false,
    alpha: 0.85,
  });
  cross(nx + 4, ny, 34, 1);
  bigText('MOTOR YOK', 540, 918, 92, ramp(t, a + 0.05, Wd(10, 1) - a));
  bigText('YAKIT YOK', 540, 1022, 92, ramp(t, Wd(10, 2) - 0.05, 0.4));
  const ts = Wd(10, 4),
    ps = ramp(t, ts, 0.14); // tek mavi olmayan renk, bir kez: damga
  if (ps > 0) {
    const sc = lerp(1.5, 1, eout(ps)),
      wd = 600,
      hg = 140;
    ctx.save();
    ctx.translate(520, 508);
    ctx.rotate(-0.1);
    ctx.scale(sc, sc);
    ctx.globalAlpha = 0.93 * clamp(ps * 3);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 9;
    ctx.strokeRect(-wd / 2, -hg / 2, wd, hg);
    ctx.lineWidth = 3;
    ctx.strokeRect(-wd / 2 + 14, -hg / 2 + 14, wd - 28, hg - 28);
    ctx.fillStyle = RED;
    font(82, HAND);
    ctx.textAlign = 'center';
    ctx.fillText('SADECE HAVA', 0, 31);
    ctx.restore();
  }
}
const SCENES = [s1, s2, s3, s4, s5, s6, s7, s8, s9];

function draw(t) {
  t = clamp(t, 0, END - 0.001);
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(PAPER_C, 0, 0, W, H);
  let k = 0;
  while (k < SCENES.length - 1 && t >= S[k + 1]) k++;
  const a = S[k],
    since = t - a,
    bump = k ? 7 * Math.exp(-since * 14) * Math.cos(since * 38) : 0;
  const stampHit =
    k === 8
      ? 9 *
        Math.exp(-(t - Wd(10, 4)) * 16) *
        (t >= Wd(10, 4) ? Math.cos((t - Wd(10, 4)) * 44) : 0)
      : 0;
  topBand();
  header(t, k);
  const z = 1 + 0.03 * ramp(t, a, S[k + 1] - a); // sahne boyunca yavaş yaklaşma
  ctx.save();
  ctx.translate(540, 720 + bump + stampHit);
  ctx.scale(z, z);
  ctx.translate(-540, -720);
  SC = z;
  SCENES[k](t);
  SC = 1;
  ctx.restore();
  notesColumn(t);
  titleBlock(t, k);
  caption(t);
}

window.__film = {
  draw,
  ready: Promise.all([
    document.fonts.load(`46px ${HAND}`, 'İıŞşĞğÖöÜüÇç'),
    document.fonts.load(`500 30px ${MONO}`, 'İıŞşĞğÖöÜüÇç'),
    document.fonts.ready,
  ]).then(() => {
    ctx = document.getElementById('c').getContext('2d');
    PAPER_C = makePaper();
    draw(0);
  }),
};
