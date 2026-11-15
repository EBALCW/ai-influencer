// Veriye dayalı Blueprint (ozalit) şablonu, 1080x1920. Sahne kodu videoya özel yazılmaz: her şey
// window.SPEC (üretim planı) ve window.TIMING (sesin kelime zamanları) verisinden çizilir.
// Çizim motoru: assets/bp.js (anlatim-videosu/ornek/planor-stil'den kopyalanır, değiştirilmez).
// Kurallar:
//   * Her kare yalnız t'nin işlevidir (hf-seek); rastgelelik yok.
//   * Ekrana yalnız SPEC ve TIMING içindeki metin çıkar. Metin yalnız canvas'a fillText ile
//     yazılır; hiçbir yerde HTML'e ya da koda çevrilmez.
//   * Okunması gereken her şey güvenli alanda: x 72-1008, y 269-1248. Altı ve üstü dekordur.
// Genişletme noktası: yeni kart türü = CARDS'a bir çizici + script.ts'teki cardSchema'ya bir tür.
/* global W, H, SS, INK, WT, HAND, MONO, ctx:writable, SC:writable, clamp, ramp, ink, text, tw, arrow, dim, balloon, makePaper */
(function () {
  const TM = window.TIMING,
    SP = window.SPEC,
    END = SP.total,
    N = TM.lines.length,
    EN = String(SP.lang || 'tr').startsWith('en'),
    LOCALE = EN ? 'en' : 'tr';
  const T_ = EN
    ? {
        fig: 'FIG.',
        intro: 'INTRO',
        sources: 'SOURCES',
        progress: 'PROGRESS',
        project: 'PROJECT',
        sheet: 'SHEET',
        series: 'SERIES',
        kind: 'TYPE',
        episode: 'EPISODE',
        voice: 'VOICE',
        synthetic: 'SYNTHETIC',
        figure: 'FIGURE',
        source: 'SOURCE',
        note: 'NOTE',
        single: 'SINGLE',
        sub: 'EXPLAINER VIDEO · TEMPLATE DRAWING',
        credit1: 'VOICE · SYNTHETIC (EDGE-TTS)',
        credit2: 'DRAWN BY CODE · NOT TO SCALE',
      }
    : {
        fig: 'ŞEK.',
        intro: 'GİRİŞ',
        sources: 'KAYNAKLAR',
        progress: 'İLERLEME',
        project: 'PROJE',
        sheet: 'PAFTA',
        series: 'SERİ',
        kind: 'TÜR',
        episode: 'BÖLÜM',
        voice: 'SES',
        synthetic: 'SENTETİK',
        figure: 'ŞEKİL',
        source: 'KAYNAK',
        note: 'NOT',
        single: 'TEKİL',
        sub: 'ANLATIM VİDEOSU · ŞABLON ÇİZİM',
        credit1: 'SESLENDİRME · SENTETİK SES (EDGE-TTS)',
        credit2: 'ÇİZİMLER KODLA ÜRETİLDİ · ÖLÇEKSİZ',
      };
  const up = (s) => String(s).toLocaleUpperCase(LOCALE);
  const X0 = 72,
    X1 = 1008,
    CX = 540;
  // Sahne başlangıçları: her vuruş kendi satırının ilk kelimesinden hemen önce açılır
  const S = TM.lines.map((l, i) => (i === 0 ? 0 : Math.max(0, l.start - 0.08)));
  const OUTRO = SP.outro > 0 ? Math.max(0, TM.duration - 0.3) : Infinity;
  let PAPER_C;

  // Altyazı parçaları, kelime zamanlarıyla birlikte, vuruş başına
  const PHR = TM.lines.map(() => []);
  (() => {
    const at = TM.lines.map(() => 0);
    for (const ph of TM.phrases) {
      const count = ph.text.split(' ').length,
        words = TM.lines[ph.line].words.slice(at[ph.line], at[ph.line] + count);
      at[ph.line] += count;
      if (words.length) PHR[ph.line].push({ n: ph.n, s: ph.s, e: ph.e, words });
    }
  })();

  // ---------- ölçü ve yerleşim ----------
  const isNum = (tok) => /\d/.test(tok);
  const tokFont = (tok) => (isNum(tok) ? MONO : HAND);
  const tokSize = (tok, size) => (isNum(tok) ? Math.round(size * 0.84) : size);
  function tokWidth(tok, size) {
    return tw(tok, tokSize(tok, size), tokFont(tok));
  }
  /** Metni en çok maxw genişliğe sığdırır: önce küçültür, yetmezse "…" ile keser. */
  function fit(str, size, min, maxw, f = HAND) {
    let s = size;
    while (s > min && tw(str, s, f) > maxw) s -= 2;
    if (tw(str, s, f) <= maxw) return { str, size: s };
    const chars = [...str];
    while (chars.length > 1 && tw(chars.join('') + '…', s, f) > maxw)
      chars.pop();
    return { str: chars.join('').trimEnd() + '…', size: s };
  }
  // El yazısı yazı tipinde "1" büyük "I" gibi görünür: sayı içeren kelimeler mono yazılır.
  // Serbest metin (başlık, etiket, kaynak adı) bu yüzden kelime kelime çizilir.
  function lineWidth(str, size) {
    return str
      .split(' ')
      .reduce(
        (sum, tok, i) => sum + tokWidth(tok, size) + (i ? size * 0.3 : 0),
        0,
      );
  }
  function fitLine(str, size, min, maxw) {
    let s = size;
    while (s > min && lineWidth(str, s) > maxw) s -= 2;
    if (lineWidth(str, s) <= maxw) return { str, size: s };
    const chars = [...str];
    while (chars.length > 1 && lineWidth(chars.join('') + '…', s) > maxw)
      chars.pop();
    return { str: chars.join('').trimEnd() + '…', size: s };
  }
  function drawLine(str, x, base, size, o = {}) {
    const toks = str.split(' '),
      w = lineWidth(str, size),
      p = o.p ?? 1;
    let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    toks.forEach((tok, i) => {
      const pp = clamp(p * toks.length - i);
      if (pp > 0) drawTok(tok, cx, base, size, { ...o, p: pp });
      cx += tokWidth(tok, size) + size * 0.3;
    });
  }
  /** Kelimeleri satırlara dizer. Dönen: [{ items: [{ i, tok, x, w }], width }] (x satır içi). */
  function rowsOf(tokens, size, maxw) {
    const gap = size * 0.3,
      rows = [];
    let cur = { items: [], width: 0 };
    tokens.forEach((tok, i) => {
      const w = Math.min(tokWidth(tok, size), maxw);
      if (cur.items.length && cur.width + gap + w > maxw) {
        rows.push(cur);
        cur = { items: [], width: 0 };
      }
      const x = cur.items.length ? cur.width + gap : 0;
      cur.items.push({ i, tok, x, w });
      cur.width = x + w;
    });
    if (cur.items.length) rows.push(cur);
    return rows;
  }
  /** Sığan en büyük boyu seçer. */
  function bestRows(tokens, sizes, maxw, maxh, maxRows, lhk = 1.3) {
    for (const size of sizes) {
      const rows = rowsOf(tokens, size, maxw);
      if (rows.length <= maxRows && rows.length * size * lhk <= maxh)
        return { rows, size, lh: size * lhk };
    }
    return null;
  }
  function drawTok(tok, x, base, size, o = {}) {
    const f = tokFont(tok),
      s = tokSize(tok, size);
    // Kutudan geniş tek kelime (ör. uzun adres) sıkıştırılır
    const natural = tw(tok, s, f),
      k = o.maxw && natural > o.maxw ? o.maxw / natural : 1;
    text(tok, x, base, Math.max(12, Math.floor(s * k)), {
      font: f,
      weight: f === MONO ? 500 : 400,
      p: o.p ?? 1,
      alpha: o.alpha ?? 1,
      glow: o.glow,
      nib: o.nib ?? (o.p ?? 1) < 1,
    });
  }

  // ---------- kinetik yazı: vuruşun cümlesi, sesle eşzamanlı ----------
  const KIN_SIZES = [104, 96, 88, 80, 72, 64, 56, 50, 46];
  const kinCache = new Map();
  function kinetic(i, box) {
    const key = `${i}:${box.y0}:${box.y1}`;
    if (kinCache.has(key)) return kinCache.get(key);
    const maxw = box.x1 - box.x0,
      maxh = box.y1 - box.y0,
      min = [KIN_SIZES[KIN_SIZES.length - 1]],
      toks = (list) => list.flatMap((ph) => ph.words.map((w) => w.w));
    const pages = [];
    let cur = [];
    for (const ph of PHR[i]) {
      const next = cur.concat([ph]);
      if (cur.length && !bestRows(toks(next), min, maxw, maxh, 7)) {
        pages.push(cur);
        cur = [ph];
      } else cur = next;
    }
    if (cur.length) pages.push(cur);
    const out = pages.map((phrases, p) => {
      const tokens = toks(phrases),
        lay = bestRows(tokens, KIN_SIZES, maxw, maxh, 7) || {
          rows: rowsOf(tokens, min[0], maxw),
          size: min[0],
          lh: min[0] * 1.3,
        },
        words = phrases.flatMap((ph, j) =>
          ph.words.map((w, q) => ({ ...w, ph: j, q, of: ph.words.length })),
        );
      return { phrases, words, ...lay, start: p ? phrases[0].s - 0.1 : -1 };
    });
    kinCache.set(key, out);
    return out;
  }
  function drawKinetic(i, box, t, a) {
    const pages = kinetic(i, box);
    if (!pages.length) return;
    let p = 0;
    while (p < pages.length - 1 && t >= pages[p + 1].start) p++;
    const pg = pages[p],
      maxw = box.x1 - box.x0,
      total = pg.rows.length * pg.lh,
      top = box.y0 + Math.max(0, (box.y1 - box.y0 - total) * 0.42),
      wmax = Math.max(...pg.rows.map((r) => r.width));
    // yazı bloğunun köşe işaretleri: sahne açılırken çizilir (bilgi taşımaz, dekordur)
    brackets(
      Math.max(box.x0 - 20, CX - wmax / 2 - 40),
      top - 30,
      Math.min(box.x1 + 20, CX + wmax / 2 + 40),
      top + total + 34,
      ramp(t, Math.max(a, pg.start) + 0.02, 0.45),
      38,
      0.55,
    );
    // kenar notu: sayfa işareti (uzun cümle birden çok sayfaya bölünür)
    if (pages.length > 1)
      text(`${p + 1} / ${pages.length}`, box.x1, box.y0 - 8, 22, {
        font: MONO,
        weight: 500,
        align: 'right',
        alpha: 0.6,
      });
    pg.rows.forEach((row, r) => {
      const base = top + pg.lh * r + pg.size * 0.92,
        left = CX - row.width / 2;
      for (const it of row.items) {
        const w = pg.words[it.i],
          nxt = pg.words[it.i + 1],
          ph = pg.phrases[w.ph];
        let prog, alpha, glow;
        if (SP.captionMode === 'word') {
          prog = ramp(t, w.s - 0.04, 0.14);
          const live = t >= w.s - 0.04 && t < (nxt ? nxt.s - 0.04 : w.e + 0.25);
          alpha = live ? 1 : 0.86;
          glow = live ? 9 : 0;
          if (live && prog >= 1)
            ink(
              [
                [left + it.x, base + pg.size * 0.2],
                [left + it.x + it.w, base + pg.size * 0.2],
              ],
              WT.d,
              1,
              { nib: false },
            );
        } else {
          // satır modu: parça, başladığı anda soldan sağa yazılır
          const sweep = ramp(t, ph.s, Math.min(0.45, 0.06 * w.of + 0.12));
          prog = clamp(sweep * w.of - w.q);
          const liveP = t >= ph.s && t < ph.e;
          alpha = liveP ? 1 : 0.72;
          glow = 0;
        }
        if (prog > 0)
          drawTok(it.tok, left + it.x, base, pg.size, {
            p: prog,
            alpha,
            glow,
            maxw,
          });
      }
    });
  }

  // ---------- kartlar (yapılandırılmış senaryodan) ----------
  function brackets(x0, y0, x1, y1, p, len = 46, alpha = 1) {
    for (const [x, y, dx, dy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x1, y1, -1, -1],
      [x0, y1, 1, -1],
    ])
      ink(
        [
          [x + dx * len, y],
          [x, y],
          [x, y + dy * len],
        ],
        WT.d,
        p,
        { nib: false, alpha },
      );
  }
  const CARDS = {
    phrase(card, box, t, a) {
      const maxw = box.x1 - box.x0 - 90,
        tokens = card.text.split(' '),
        noteH = card.note ? 70 : 0,
        lay = bestRows(
          tokens,
          [128, 112, 98, 86, 76, 66, 58],
          maxw,
          box.y1 - box.y0 - 80 - noteH,
          3,
          1.18,
        ) || {
          rows: rowsOf(tokens, 58, maxw).slice(0, 3),
          size: 58,
          lh: 58 * 1.18,
        },
        h = lay.rows.length * lay.lh,
        cy = (box.y0 + box.y1 - noteH) / 2,
        top = cy - h / 2,
        wmax = Math.max(...lay.rows.map((r) => r.width)),
        p = ramp(t, a + 0.15, 0.55),
        count = tokens.length;
      brackets(
        CX - wmax / 2 - 44,
        top - 26,
        CX + wmax / 2 + 44,
        top + h + 30,
        ramp(t, a + 0.02, 0.4),
      );
      lay.rows.forEach((row, r) => {
        for (const it of row.items)
          drawTok(
            it.tok,
            CX - row.width / 2 + it.x,
            top + lay.lh * r + lay.size * 0.9,
            lay.size,
            { p: clamp(p * count - it.i), glow: 7, maxw },
          );
      });
      if (card.note) {
        const n = fit(card.note, 34, 24, maxw, MONO);
        text(n.str, CX, top + h + 96, n.size, {
          font: MONO,
          weight: 500,
          align: 'center',
          alpha: 0.85,
          p: ramp(t, a + 0.6, 0.5),
          nib: false,
        });
      }
    },
    number(card, box, t, a) {
      const maxw = box.x1 - box.x0 - 120,
        cy = (box.y0 + box.y1) / 2,
        v = fit(card.value, 230, 96, maxw, MONO),
        p = ramp(t, a + 0.2, 0.5);
      if (card.label) {
        const l = fitLine(card.label, 52, 34, maxw + 60);
        drawLine(l.str, CX, cy - v.size * 0.5 - 56, l.size, {
          align: 'center',
          p: ramp(t, a + 0.05, 0.45),
          alpha: 0.92,
        });
      }
      text(v.str, CX, cy + v.size * 0.34, v.size, {
        font: MONO,
        weight: 500,
        align: 'center',
        p,
        glow: 8,
      });
      const y = cy + v.size * 0.34 + 62;
      dim(
        box.x0 + 70,
        y,
        box.x1 - 70,
        y,
        card.unit ? fit(up(card.unit), 40, 26, maxw - 120, MONO).str : null,
        ramp(t, a + 0.45, 0.6),
      );
    },
    steps(card, box, t, a, b) {
      const n = card.items.length,
        head = card.title ? 84 : 0,
        avail = box.y1 - box.y0 - head,
        gap = 46,
        bh = Math.min(112, (avail - gap * (n - 1)) / n),
        bw = 700,
        x0 = CX - bw / 2 + 30,
        top = box.y0 + head + (avail - (bh * n + gap * (n - 1))) / 2,
        step = Math.min(1.1, Math.max(0.25, (b - a - 0.9) / n));
      if (card.title) {
        const h = fit(up(card.title), 44, 30, bw, MONO);
        text(h.str, CX, box.y0 + 52, h.size, {
          font: MONO,
          weight: 500,
          align: 'center',
          p: ramp(t, a + 0.05, 0.4),
          nib: false,
        });
      }
      card.items.forEach((item, k) => {
        const tk = a + 0.2 + k * step,
          p = ramp(t, tk, 0.4),
          y = top + k * (bh + gap);
        if (p <= 0) return;
        ink(
          [
            [x0, y],
            [x0 + bw, y],
            [x0 + bw, y + bh],
            [x0, y + bh],
            [x0, y],
          ],
          WT.d,
          p,
        );
        balloon(k + 1, x0 - 56, y + bh / 2, x0, y + bh / 2, p, 28);
        const lab = fitLine(item, 50, 30, bw - 48);
        drawLine(lab.str, x0 + bw / 2, y + bh / 2 + lab.size * 0.34, lab.size, {
          align: 'center',
          p: ramp(t, tk + 0.12, 0.35),
        });
        if (k < n - 1)
          arrow(
            x0 + bw / 2,
            y + bh + 6,
            x0 + bw / 2,
            y + bh + gap - 8,
            WT.d,
            ramp(t, tk + 0.3, 0.25),
            { head: 18 },
          );
      });
    },
  };

  // ---------- pafta mobilyası ----------
  function topBand() {
    const k = fit(SP.kindLabel, 40, 26, 560);
    text(k.str, X0, 168, k.size, { alpha: 0.9 });
    text(
      SP.episodeLabel ? up(SP.episodeLabel) : `${T_.sheet} 01`,
      X1,
      166,
      26,
      { font: MONO, weight: 500, align: 'right', alpha: 0.85 },
    );
    ink(
      [
        [X0, 196],
        [X1, 196],
      ],
      WT.h,
      1,
      { nib: false, alpha: 0.7 },
    );
    for (let i = 0; i <= 12; i++) {
      const x = X0 + i * 78;
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
    const sub = fit(
      SP.seriesName ? up(SP.seriesName) : T_.sub,
      17,
      13,
      X1 - X0,
      MONO,
    );
    text(sub.str, X0, 248, sub.size, { font: MONO, weight: 500, alpha: 0.55 });
  }
  function header(t, k, outro) {
    const a = outro ? OUTRO : S[k],
      p = !outro && k === 0 ? 1 : ramp(t, a + 0.02, 0.4),
      label = outro
        ? T_.sources
        : SP.beats[k].heading || (k === 0 ? T_.intro : SP.title),
      h = fitLine(up(label), 40, 24, 900 - 244);
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
    text(`${T_.fig} ${outro ? N + 1 : k + 1}`, 147, 334, 30, {
      font: MONO,
      weight: 500,
      align: 'center',
    });
    drawLine(h.str, 244, 337, h.size, { p });
    for (const [y, al] of [
      [372, 0.8],
      [378, 0.45],
    ])
      ink(
        [
          [72, y],
          [900, y],
        ],
        WT.h,
        1,
        { nib: false, alpha: al },
      );
  }
  const mmss = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function progress(t) {
    text(T_.progress, X0, 1322, 24, { font: MONO, weight: 500, alpha: 0.85 });
    text(`${mmss(t)} / ${mmss(END)}`, X1, 1322, 24, {
      font: MONO,
      weight: 500,
      align: 'right',
      alpha: 0.85,
    });
    ink(
      [
        [X0, 1334],
        [X1, 1334],
      ],
      WT.h,
      1,
      { nib: false, alpha: 0.7 },
    );
    const y = 1430,
      x = (s) => X0 + ((X1 - X0) * s) / END;
    ink(
      [
        [X0, y],
        [X1, y],
      ],
      WT.h,
      1,
      { nib: false, alpha: 0.6 },
    );
    S.concat(SP.outro > 0 ? [OUTRO] : []).forEach((s, i) => {
      ink(
        [
          [x(s), y - 14],
          [x(s), y + 14],
        ],
        WT.t,
        1,
        { nib: false, alpha: 0.8 },
      );
      if (N <= 14)
        text(String(i + 1), x(s) + 8, y + 44, 20, {
          font: MONO,
          weight: 500,
          alpha: 0.6,
        });
    });
    ink(
      [
        [X0, y],
        [x(t), y],
      ],
      WT.o,
      1,
      { nib: false },
    );
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x(t), y, 9, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  function titleBlock(k, outro) {
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
    for (const x of [420, 640, 820])
      ink(
        [
          [x, 1678],
          [x, 1744],
        ],
        WT.h,
        1,
        { nib: false, alpha: a },
      );
    const cell = (lab, val, x, y, w, o = {}) => {
      text(lab, x + 12, y + 22, 15, { font: MONO, weight: 500, alpha: 0.6 });
      if (o.hand) {
        const v = fitLine(val, o.size || 26, 14, w - 24);
        drawLine(v.str, x + 12, y + 54, v.size, { alpha: 0.92 });
      } else {
        const v = fit(val, o.size || 26, 14, w - 24, MONO);
        text(v.str, x + 12, y + 54, v.size, {
          font: MONO,
          weight: 500,
          alpha: 0.92,
        });
      }
    };
    const total = N + (SP.outro > 0 ? 1 : 0);
    cell(T_.project, up(SP.title), x0, y0, 700, { hand: true, size: 30 });
    cell(T_.sheet, '1 / 1', 760, y0, 260);
    if (SP.seriesName) cell(T_.series, up(SP.seriesName), x0, 1678, 360);
    else cell(T_.kind, SP.kindLabel, x0, 1678, 360);
    cell(
      T_.episode,
      SP.episodeLabel ? SP.episodeLabel.replace(/\D+/g, '') || '1' : T_.single,
      420,
      1678,
      220,
    );
    cell(T_.voice, T_.synthetic, 640, 1678, 180);
    cell(T_.figure, `${outro ? total : k + 1} / ${total}`, 820, 1678, 200);
    cell(
      T_.source,
      SP.sources.length ? up(SP.sources.join(' · ')) : '—',
      x0,
      1744,
      960,
      { size: 24 },
    );
  }

  // ---------- altyazı kutusu (kartlı vuruşlarda) ----------
  function caption(t, k) {
    const ph = PHR[k].find((q) => t >= q.s && t < q.e);
    if (!ph) return;
    const tokens = ph.words.map((w) => w.w),
      lay = bestRows(tokens, [46, 42, 38, 34, 30], 640, 400, 2, 58 / 46) || {
        rows: rowsOf(tokens, 30, 640).slice(0, 2),
        size: 30,
        lh: 38,
      },
      wmax = Math.max(...lay.rows.map((r) => r.width)),
      bw = Math.min(720, wmax + 72),
      bh = lay.rows.length * lay.lh + 40,
      bx = CX - bw / 2,
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
    text(`${T_.note} / ${String(ph.n).padStart(2, '0')}`, bx + 52, by - 8, 19, {
      font: MONO,
      weight: 500,
      align: 'center',
      color: '#0F2350',
    });
    const count = tokens.length,
      sweep = ramp(t, ph.s, 0.35);
    lay.rows.forEach((row, r) => {
      const base = by + 20 + lay.lh * (r + 1) - 14,
        left = CX - row.width / 2;
      for (const it of row.items) {
        const w = ph.words[it.i],
          nxt = ph.words[it.i + 1];
        let p = clamp(sweep * count - it.i),
          alpha = 1,
          glow = 0;
        if (SP.captionMode === 'word') {
          const live = t >= w.s - 0.04 && t < (nxt ? nxt.s - 0.04 : ph.e);
          p = 1;
          alpha = live ? 1 : t >= w.s ? 0.8 : 0.45;
          glow = live ? 8 : 0;
        }
        if (p > 0)
          drawTok(it.tok, left + it.x, base, lay.size, {
            p,
            alpha,
            glow,
            maxw: 640,
          });
      }
    });
  }

  // ---------- sahneler ----------
  function titleCard(t, box) {
    const maxw = box.x1 - box.x0 - 40,
      tokens = SP.title.split(' '),
      lay = bestRows(
        tokens,
        [104, 92, 82, 72, 64, 56, 50],
        maxw,
        box.y1 - box.y0 - 110,
        3,
        1.14,
      ) || {
        rows: rowsOf(tokens, 50, maxw).slice(0, 3),
        size: 50,
        lh: 57,
      },
      h = lay.rows.length * lay.lh,
      top = box.y0 + 70 + (box.y1 - box.y0 - 110 - h) / 2,
      over = SP.seriesName
        ? [up(SP.seriesName), SP.episodeLabel ? up(SP.episodeLabel) : '']
            .filter(Boolean)
            .join(' · ')
        : SP.kindLabel,
      o = fit(over, 30, 20, maxw, MONO);
    text(o.str, CX, box.y0 + 44, o.size, {
      font: MONO,
      weight: 500,
      align: 'center',
      alpha: 0.85,
    });
    // başlık ilk karede tamdır: videonun kapak karesi budur
    lay.rows.forEach((row, r) => {
      for (const it of row.items)
        drawTok(
          it.tok,
          CX - row.width / 2 + it.x,
          top + lay.lh * r + lay.size * 0.9,
          lay.size,
          { glow: 6, maxw },
        );
    });
    const wmax = Math.max(...lay.rows.map((r) => r.width)),
      y = top + h + 26,
      p = ramp(t, 0.05, 0.7);
    for (const [dy, wt] of [
      [0, WT.d],
      [10, WT.h],
    ])
      ink(
        [
          [CX - wmax / 2, y + dy],
          [CX + wmax / 2, y + dy],
        ],
        wt,
        p,
        { nib: dy === 0 },
      );
  }
  function beatScene(k, t, a, b) {
    const card = SP.beats[k].card;
    let top = 420;
    if (k === 0) {
      titleCard(t, { x0: 96, x1: 984, y0: 400, y1: card ? 690 : 760 });
      top = card ? 720 : 800;
    }
    if (card && CARDS[card.type])
      CARDS[card.type](card, { x0: 96, x1: 984, y0: top, y1: 1010 }, t, a, b);
    else drawKinetic(k, { x0: 110, x1: 970, y0: top + 20, y1: 1190 }, t, a);
  }
  function sourcesScene(t) {
    const list = SP.sources,
      top = 470,
      gap = Math.min(96, 560 / Math.max(1, list.length));
    list.forEach((name, i) => {
      const p = ramp(t, OUTRO + 0.1 + i * 0.12, 0.4),
        y = top + i * gap,
        n = fitLine(name, 46, 28, 760);
      balloon(i + 1, 130, y - 14, 176, y - 14, p, 26);
      drawLine(n.str, 196, y, n.size, { p });
    });
    const y = top + list.length * gap + 60;
    ink(
      [
        [X0 + 24, y - 44],
        [X1 - 24, y - 44],
      ],
      WT.h,
      ramp(t, OUTRO + 0.3, 0.5),
      { nib: false, alpha: 0.7 },
    );
    [T_.credit1, T_.credit2].forEach((line, i) =>
      text(line, CX, y + i * 46, 26, {
        font: MONO,
        weight: 500,
        align: 'center',
        alpha: 0.8,
        p: ramp(t, OUTRO + 0.5 + i * 0.15, 0.5),
        nib: false,
      }),
    );
  }

  function draw(t) {
    t = clamp(t, 0, END - 0.001);
    ctx.setTransform(SS, 0, 0, SS, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(PAPER_C, 0, 0, W, H);
    const outro = t >= OUTRO;
    let k = 0;
    while (k < N - 1 && t >= S[k + 1]) k++;
    const a = outro ? OUTRO : S[k],
      b = outro ? END : k < N - 1 ? S[k + 1] : Math.min(OUTRO, END),
      since = t - a,
      bump = k || outro ? 7 * Math.exp(-since * 14) * Math.cos(since * 38) : 0,
      z = 1 + 0.025 * ramp(t, a, Math.max(0.1, b - a)); // sahne boyunca yavaş yaklaşma
    topBand();
    header(t, k, outro);
    ctx.save();
    ctx.translate(CX, 720 + bump);
    ctx.scale(z, z);
    ctx.translate(-CX, -720);
    SC = z;
    if (outro) sourcesScene(t);
    else beatScene(k, t, a, b);
    SC = 1;
    ctx.restore();
    progress(t);
    titleBlock(k, outro);
    // Kinetik yazı zaten cümlenin kendisidir; ikinci bir transkript katmanı açılmaz
    if (!outro && SP.beats[k].card) caption(t, k);
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
})();
