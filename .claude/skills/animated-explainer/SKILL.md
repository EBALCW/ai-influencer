---
name: animated-explainer
description: "Style for edit-video: a fully animated reel with no camera. A locked voice (yours, a free local voice or ElevenLabs), one lit colour field and one big hero card per spoken beat, the spoken line word-lit at the top, and an optional cartoon character as a cursor that drives the UI. Use for tool, product and idea explainers, two-voice conversations and story reels when the creator doesn't want to film."
---

# Animated explainer

> **Bu projede (ai-influencer):** `cartoon-character` skill'i alınmadı, bu yüzden `CHARACTER = None` kullan (imleç rozeti ve dudak senkronu yok). Paketteki yazı tipleri Türkçe harfleri (İ Ş ş Ğ ğ) içermediği için tam sürümleriyle değiştirildi. Ses: `anlatim-videosu/scripts/edge_takes.py` + `voice.py --engine files`. `Timing.find()` Türkçe harfleri atarak eşleştirir ("uçar" ile "uar" aynı sayılır); nadiren yanlış kelimeye düşerse `T.W(satır, sıra)` kullan. Kaynak ve yapılan değişiklikler: `.claude/skills/edit-video/KAYNAK.md`.

A style on top of `edit-video`, which owns the sound mix, safe areas and review. The
whole reel is animation keyed to a voice: every scene starts on a spoken line, every
card pops on the word that names it, and every sound lands on the frame that shows
its event. No camera, no footage. Add the `cartoon-character` skill to put a
lip-synced character in it.

## What makes it look premium

- **The voice is the clock.** Lock the voice first and key everything to its word
  times. Never time animation by ear or by reading speed.
- **A lit world, one field per beat.** Each scene is a full-bleed colour field with
  a soft radial light (night, ultra, forest, clay, ink, and cream, lilac or peach for
  light beats). Neighbours differ, so the reel moves even with the sound off. Every
  scene pushes in slowly; nothing is ever a still.
- **One big hero object per beat**, with real content: a calendar, a terminal, a
  chat, a receipt, a timeline. Size it from its content, about 864 px wide, never a
  small card in an empty field. Show rows still to come dimmed rather than leaving a
  card half empty. Label anything illustrative that looks like data.
- **Type:** one heavy sans, one serif italic for the single accent word, one mono
  for labels. The hook and the spoken line are 84–112 px, at most three lines.
- **Motion:** entrances rise or pop and are fully visible within 0.07 s, so they
  never arrive after their sound. Stamps land on their word. Counters roll once to
  their true value. Transitions come from the medium: an iris from where the cursor
  clicked, a scroll for a turn, a cut on the same field. No dissolves, no blank frame.
- **A character is small and busy.** As a cursor badge it moves to what is being
  said, clicks it and rests beside it. It never covers text being read.
- **Frame 0 already shows the hook and the hero.** Something changes every few
  seconds.

These are defaults. A creator's brand, palette and reference win; keep the method.

## Workflow

Work in a run folder from `edit-video` (`scripts/new-edit.mjs`). Each reel is a
folder `work/<reel>/` that holds its `spec.py`, its `voice/` and the built
HyperFrames project. Start by copying [the worked example](example/spec.py).

1. **Script.** One idea, 15–40 s. A line that starts with `[Agent] ` (or the
   spec's `GUEST` name) is the second voice. Check every name, number and feature
   against its source; a first-person claim needs a real run.
2. **Voice.** `edit-video`'s `scripts/voice.py work/<reel> --engine files|hyperframes`
   writes `voice/vo.wav` and `voice/timing.json` (every word's start and end). Which
   engine, and how to clone your own voice for free, is in `edit-video`'s voice
   options (`references/voice.md`). Listen to the takes: timings can't catch a
   mispronounced word. After this the words are locked; change only ` | ` phrase
   breaks and `*accents*`.
3. **Spec.** Write `build(T)` in `spec.py`: one scene per beat starting on a line
   or a word (`T.L(i)`, `T.find('word', line=i)`), its hero markup, the timeline JS
   using the helpers in `assets/explainer.js` (`pop`, `rise`, `fade`, `nudge`,
   `count`, `type`, `draw`, `push`), the cursor path, the character's poses, and
   one sound cue per visible event. The full contract is in the docstring of
   [`scripts/build.py`](scripts/build.py).
4. **Build:** `python3 <skill>/scripts/build.py work/<reel>`. It writes
   `index.html`, `cues.json` and `assets/`, and stops if the script and the voice
   disagree on a line's words.
5. **Look before rendering.** `hyperframes snapshot work/<reel> --describe false --at …`
   at frame 0, each scene's first spoken word, every click and the last second.
   Look at every frame: text readable and inside the safe area, nothing overlapping,
   the character never on text. Fix and repeat.
6. **Render** with `hyperframes render work/<reel> --fps 30 --quality high --output previews/<reel>-v01.mp4 < /dev/null`.
7. **Sound.** Mix the voice and the cues with `edit-video`'s
   `scripts/sfx-sync.mjs mix work/<reel>/cues.json --voice work/<reel>/voice/vo.wav --out work/mix-v01.wav --video previews/<reel>-v01.mp4 --mux exports/<reel>-v01.mp4`,
   then check it with `sfx-sync.mjs check … --strips reports/sync-v01` and look at the
   strips.
8. **Review and deliver** with `edit-video`: frame 0 and the first 3 seconds, a 4 fps
   sheet of the whole reel, phone-size safe areas, loudness. Say what you could not
   judge, such as a listening pass.

## Layout at 1080×1920

| Zone | Where |
|---|---|
| Spoken line | x 128–928, from y 330. The hook can be bigger (`BIG`) |
| Hero card | x 108–972, y 650–1250; its text above y 1248 |
| Cursor badge at rest | about x ≤ 740, y ≥ 1290; arrive, click and leave within about 0.6 s when it clicks inside a card |
| Bottom | Can stay field: the platform's caption sits there |

`STYLE = 'rail'` switches to white grid paper with the character's head riding a
progress rail down the left edge and a chip naming each chapter; cards then start
at x 340.

## Sound map

All from `edit-video`'s SFX pack. Gains in the spec are relative to each sound's
suggested level.

| Visible event | Sound |
|---|---|
| Frame 1 of the hook | `ui-pop` |
| Card or panel arrives; button appears | `ui-pop` |
| The cursor clicks | `ui-click` |
| A row, step or marker appears | `tick` |
| Something lands or a stamp slams | `thock` |
| Approved, connected, done | `latch` |
| Progress or a counter running | `ratchet` |
| Typing | `typing-tick` |
| Scene change | `zoom-swish`, about 0.12 s before the line |
| Earned completion, once | `clean-ding` |

No bass hits, and leave one or two quiet beats.

## Pitfalls already paid for

- A sound cued at a scene's very first frame plays before the transition shows its
  element; cue it once the element can be seen.
- A cursor that leaves for its next click too early flies across the previous
  scene's card. Start a move after the new scene has opened.
- A number word in the script ("six") and a digit in the transcript ("6") are
  matched; other mismatches are placed between their neighbours and reported. Fix
  the take or the script when that happens.
- Element ids in a spec must be unique; prefix them with the scene number.
- Don't rebuild between the reviewed render and the delivery render.
