// Animated-explainer timeline helpers. Every time is absolute seconds on the root timeline and comes from voice word
// times (DATA). Seek-safe: start states with gsap.set, tweens to absolute values, never two tweens on one property
// of one element at the same time, no tl.set on an element at t=0 (use gsap.set).
gsap.defaults({ overwrite: false });
const D = window.DATA;
const tl = gsap.timeline({ paused: true });
const $ = (s) => document.querySelector(s);
const QA = (s) => Array.from(document.querySelectorAll(s));
const EZ = { in: 'expo.out', out: 'expo.in', settle: 'back.out(1.3)', glide: 'expo.inOut' };

// ---------- scenes: transitions come from the medium: an iris opening from the point the cursor just
// clicked, a feed-style scroll (whip), or a knife cut. No dissolves, no blank frames; start 0.12 s before the cut. ----------
const EZ_IRIS = 'expo.inOut';
function scenes() {
  D.SC.forEach((c, k) => {
    const el = '#' + c.id, cam = el + ' .cam';
    gsap.set(cam, { scale: 1 });
    if (k === 0) return;
    const kind = c.enter || 'iris', t = c.t0 - .12;
    if (kind === 'iris') {
      const [x, y] = c.at || [540, 960];
      gsap.set(el, { clipPath: `circle(0px at ${x}px ${y}px)` });
      tl.to(el, { clipPath: `circle(2300px at ${x}px ${y}px)`, duration: .62, ease: EZ_IRIS }, t);
    } else if (kind === 'scroll') {
      const prev = '#' + D.SC[k - 1].id;
      gsap.set(el, { yPercent: 100 });
      tl.to(el, { yPercent: 0, duration: .46, ease: 'expo.inOut' }, t);
      tl.to(prev + ' .cam', { yPercent: -28, duration: .46, ease: 'expo.inOut' }, t);
    } // 'cut': nothing, the clip boundary is the cut
  });
  if ($('#hud .bar i')) tl.to('#hud .bar i', { scaleX: 1, duration: D.END, ease: 'none' }, 0);
  (D.HUDDARK || []).forEach(([t, on]) => tl.set('#hud', { color: on ? 'rgba(21,22,26,.55)' : 'rgba(251,244,234,.6)' }, t));
}
// a reasoned camera move: push toward a focal point (spotlight), or ease back out
function push(scene, t, x, y, s = 1.08, d = .9) {
  const cam = '#' + scene + ' .cam';
  tl.set(cam, { transformOrigin: `${x}px ${y}px` }, t);
  tl.to(cam, { scale: s, duration: d, ease: 'expo.inOut' }, t);
}

// ---------- the spoken line: one phrase at a time, words light as spoken ----------
function say() {
  const LIT = D.LIT || '#FBF4EA', LITD = '#15161A', ACC = D.ACC || '#F4C95D';
  D.PH.forEach((p, i) => {
    const el = '#ph' + i;
    if (p.t0 <= .001) gsap.set(el, { opacity: 1 }); else {
      gsap.set(el, { opacity: 0, clipPath: 'inset(0% 0% 100% 0%)', y: 34 });
      tl.set(el, { opacity: 1 }, p.t0);
      tl.to(el, { clipPath: 'inset(0% 0% -20% 0%)', y: 0, duration: .42, ease: 'expo.out' }, p.t0);
    }
    if (p.t1 != null) tl.set(el, { opacity: 0 }, p.t1);  // knife cut
    p.words.forEach((w, j) => {
      const we = `#ph${i}w${j}`, col = w.acc ? (p.dark ? '#B4533D' : ACC) : p.who === 'guest' ? (p.dark ? '#7A3B26' : '#F6D5C2') : (p.dark ? LITD : LIT);
      if (w.s <= .001 || p.lit0) gsap.set(we, { color: col }); else tl.to(we, { color: col, duration: .09 }, w.s);
      if (D.RAIL && w.acc) { gsap.set(we, { backgroundSize: '0% 80%' }); tl.to(we, { backgroundSize: '100% 80%', duration: .28, ease: 'expo.out' }, Math.max(.001, w.s)); }
    });
  });
}

// ---------- small motion vocabulary ----------
const pop = (sel, t, o = {}) => { gsap.set(sel, { opacity: 0, scale: o.from || .86, y: o.y || 24 });
  tl.to(sel, { opacity: 1, scale: 1, y: 0, duration: o.d || .5, ease: o.ease || 'back.out(1.3)', stagger: o.stagger || 0 }, t); };
const rise = (sel, t, o = {}) => { gsap.set(sel, { opacity: 0, y: o.y || 40 });
  tl.to(sel, { opacity: 1, y: 0, duration: o.d || .45, ease: EZ.in, stagger: o.stagger || 0 }, t); };
const fade = (sel, t, to = 0, d = .25) => tl.to(sel, { opacity: to, duration: d, ease: 'power1.inOut' }, t);
const nudge = (sel, t, s = 1.04) => tl.to(sel, { scale: s, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out' }, t);
function count(sel, a, b, t, d, fmt = (v) => Math.round(v).toLocaleString('en-US')) {
  const o = { v: a }; $(sel).textContent = fmt(a);
  tl.to(o, { v: b, duration: d, ease: 'power2.out', onUpdate: () => { $(sel).textContent = fmt(o.v); } }, t);
}
function draw(sel, t, d = .9, ease = 'power2.inOut') {
  QA(sel).forEach((p) => { const L = p.getTotalLength(); gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
  tl.to(sel, { strokeDashoffset: 0, duration: d, ease }, t);
}
function type(sel, t, cps = 28) {
  const el = $(sel), txt = el.dataset.text; el.textContent = '';
  const o = { n: 0 };
  tl.to(o, { n: txt.length, duration: txt.length / cps, ease: 'none', onUpdate: () => { el.textContent = txt.slice(0, Math.round(o.n)); } }, t);
}

// ---------- the character as a cursor ----------
// moves: [[t, x, y, dur?, kind?]] kind: 'move' (default), 'click', 'press' (mouse down), 'release'
function ava() {
  const A = D.AVA; if (!A) return;
  const [t0, x0, y0] = A.path[0];
  gsap.set('#ava', { x: x0, y: y0, opacity: A.hidden0 ? 0 : 1 });
  // the name chip sits right of the badge; past x 660 it would leave the phone's visible area, so it slides to the left side
  const FLIPX = 660; let flip = x0 > FLIPX;
  gsap.set('#ava .name', { left: flip ? 14 : 172 });
  A.path.slice(1).forEach(([t, x, y, d = .55]) => {
    tl.to('#ava', { x, duration: d, ease: 'power2.inOut' }, t);
    tl.to('#ava', { y, duration: d, ease: 'sine.inOut' }, t);
    if ((x > FLIPX) !== flip) { flip = x > FLIPX; tl.to('#ava .name', { left: flip ? 14 : 172, duration: d * .8, ease: 'power2.inOut' }, t); }
  });
  (A.clicks || []).forEach(([t, rx, ry], i) => {
    tl.to('#ava .arrow', { scale: .82, duration: .07, ease: 'power2.out' }, t - .07);
    tl.to('#ava .arrow', { scale: 1, duration: .2, ease: 'back.out(3)' }, t);
    if (rx != null) {
      const r = '#rip' + i;
      gsap.set(r, { left: rx, top: ry, opacity: 0, scale: .3 });
      tl.set(r, { opacity: .95 }, t);
      tl.to(r, { scale: 1.6, opacity: 0, duration: .45, ease: 'power2.out' }, t);
    }
  });
  (A.size || []).forEach(([t, s, d = .45]) => tl.to('#ava .bw', { scale: s, duration: d, ease: 'back.out(1.6)' }, t));
  (A.show || []).forEach(([t, on, d = .3]) => tl.to('#ava', { opacity: on ? 1 : 0, duration: d }, t));
  // speaking ring: on while a line is voiced
  D.LN.forEach((l) => { if (l.who === 'guest') return; tl.to('#ava .ring', { opacity: 1, duration: .12 }, l.start); tl.to('#ava .ring', { opacity: 0, duration: .2 }, l.end); });
}

// ---------- rail look: the character's head rides the progress rail; a chip names the chapter ----------
// D.RAIL = { start: [x, y, scale], land: t, chapters: [[t, label, y]], end: [t, x, y, scale]? }
function rail() {
  const R = D.RAIL; if (!R) return;
  const RX = 158;  // rail x: the head (100 px) stays inside x 108..208, visible on 20:9 phones
  const [x0, y0, s0] = R.start || [RX, R.chapters[0][2], 1];
  gsap.set('#rhead', { x: x0, y: y0, scale: s0 });
  gsap.set('#rchip', { opacity: 0, x: -10 });
  gsap.set('#rail .prog', { height: 0 });
  const first = R.chapters[0];
  // hero: before the head lands, scene 1's card(s) sit centred and larger (the hook beat), then glide into their slot beside the rail
  if (R.hero && R.land != null) {
    const H = R.hero, els = H.sel.map((q) => document.querySelector(q)).filter(Boolean);
    if (els.length) {
      const e0 = els[0], cx = e0.offsetLeft + e0.offsetWidth / 2, cy = e0.offsetTop, s = H.s || 1.3, dy = H.dy || 0;
      els.forEach((el) => {
        gsap.set(el, { transformOrigin: `${cx - el.offsetLeft}px ${cy - el.offsetTop}px`, x: 540 - cx, y: dy, scale: s });
        tl.to(el, { x: 0, y: 0, scale: 1, duration: .7, ease: 'expo.inOut' }, R.land);
      });
    }
  }
  if (R.land != null) tl.to('#rhead', { x: RX, y: first[2], scale: 1, duration: .7, ease: 'expo.inOut' }, R.land);
  R.chapters.forEach(([t, label, y], i) => {
    if (i > 0 || R.land == null) tl.to('#rhead', { x: RX, y, scale: 1, duration: .6, ease: 'expo.inOut' }, t);
    tl.to('#rail .prog', { height: y, duration: .6, ease: 'expo.inOut' }, i === 0 && R.land != null ? R.land : t);
    tl.set('#rchip', { textContent: label }, (i === 0 && R.land != null ? R.land + .5 : t + .3));
    tl.fromTo('#rchip', { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: .3, ease: 'expo.out', immediateRender: false }, (i === 0 && R.land != null ? R.land + .5 : t + .3));
  });
  if (R.end) { const [t, x, y, s] = R.end; tl.to('#rchip', { opacity: 0, duration: .2 }, t); tl.to('#rhead', { x, y, scale: s, duration: .7, ease: 'expo.inOut' }, t); }
  (R.bounce || []).forEach((t) => { tl.to('#rhead .badge', { y: -12, duration: .11, ease: 'power2.out' }, t); tl.to('#rhead .badge', { y: 0, duration: .26, ease: 'bounce.out' }, t + .11); });
}


// ---------- hook hit: D.HOOK = { t, target, stamp, sub?, slash?: true, out?, x?, y?, size? } ----------
// On the hook's key word (t) a light streak crosses the hero card, the card flashes and wobbles, and a stamp slams onto it;
// the stamp leaves at `out`. Frame one is untouched (hook + hero).
function hookhit() {
  const H = D.HOOK; if (!H) return;
  const card = document.querySelector(H.target); if (!card) return;
  const t = H.t;
  const stamp = document.createElement('div'); stamp.className = 'hk-stamp';
  stamp.innerHTML = H.stamp + (H.sub ? `<small>${H.sub}</small>` : '');
  if (H.x != null) stamp.style.left = H.x; if (H.y != null) stamp.style.top = H.y;
  if (H.size) stamp.style.fontSize = H.size + 'px';
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  card.appendChild(stamp);
  if (H.slash !== false) {
    const sl = document.createElement('div'); sl.className = 'hk-slash'; card.appendChild(sl);
    tl.to(sl, { scaleX: 1, duration: .15, ease: 'none' }, t - .08);
    tl.to(sl, { opacity: 0, duration: .45, ease: 'power2.out' }, t + .3);
  }
  tl.fromTo(card, { filter: 'brightness(1.75)' }, { filter: 'brightness(1)', duration: .45, ease: 'power2.out', immediateRender: false }, t);
  tl.to(card, { keyframes: [{ rotation: -2.4, duration: .07 }, { rotation: 1.8, duration: .08 }, { rotation: -.8, duration: .08 }, { rotation: 0, duration: .1 }] }, t);
  tl.fromTo(stamp, { opacity: 0, scale: 2.3, rotation: -22, xPercent: -50, yPercent: -50 },
    { opacity: 1, scale: 1, rotation: -8, xPercent: -50, yPercent: -50, duration: .26, ease: 'back.out(2.2)', immediateRender: false }, t + .1);
  if (H.out != null) tl.to(stamp, { opacity: 0, scale: .85, duration: .25, ease: 'power2.in' }, H.out);
}
