---
name: film-styles
description: "Style for edit-video: 99 film looks your agent draws in code, each as a 9:16 reel or a 16:9 YouTube explainer. Whiteboard, stick-figure and tablet-sketch explainers, chalkboard, watercolour, ink wash, 80s cel anime, rubber-hose cartoons, manga panels, pixel RPG, newsreel, caption news, data stories, 3D map explainers, isometric infographics, cutaways, tilt-shift miniatures, brick toys, risograph, neon tubes and more, grouped by what the picture looks like. Pick one, bring a story, and HyperFrames renders it on your machine: no camera, no video model, no stock footage."
---

# Film styles

> **Bu projede (ai-influencer):** bu yol uçtan uca denendi (Blueprint stili, Türkçe, 1080×1920). Çalışan komutlar, Türkçe yazı tipi seçimi ve tuzaklar `.claude/skills/anlatim-videosu/SKILL.md` bölüm 8'de; kopyalanacak çalışan örnek `.claude/skills/anlatim-videosu/ornek/planor-stil/`. Yazı tipini seçmeden önce Türkçe harfleri (İ ı Ş ş Ğ ğ) içerdiğini doğrula. Kaynak ve yapılan değişiklikler: `.claude/skills/edit-video/KAYNAK.md`.

A library of 99 finished looks. Each style is one `STYLE.md`: what the picture is made
of, its colour logic, type, motion, camera, sound, the moves only that medium can do,
its pitfalls, and its two formats:

- **Reel (1080×1920)**: how the look fills a phone screen, what is on frame 1 and what
  makes people stay by three seconds.
- **YouTube (1920×1080)**: the landscape layout, how the look carries a 2–8 minute
  explainer in chapters, the first ten seconds and the thumbnail frame.

Your agent reads one, writes a treatment, and draws every frame in code. `edit-video`
owns the voice, the sound mix and the review; this skill owns the look.

## Pick a style

The [style index](styles/README.md) lists all 99 by group. Name a style by its name or
its folder, and say the format if it isn't a reel:

> Make a 30-second reel in the **Whiteboard** style about how a credit score works.

> Make a 5-minute **Stick-figure Explainer** for YouTube on why planes fly, in chapters.

> Make a **Caption News** reel about this report: <link>. Sound off has to work.

> Make a 3-minute **3D Map Explainer** for YouTube on how the Panama Canal works.

| Group | Folder | What the picture looks like |
|---|---|---|
| Edit & documentary | `styles/01-edit-documentary/` | real footage cut with big captions, newsreels, montage, broadcast graphics |
| Painting & illustration | `styles/02-painting/` | crayon, watercolour, oil, pen and wash, coloured pencil |
| Sketch & board | `styles/03-sketch-board/` | whiteboard, chalk, marker, sketchnotes, stick figures, tablet sketches |
| Traditional crafts | `styles/04-traditional-crafts/` | ink wash, shadow puppets, ukiyo-e, paper-cut, stained glass, gold leaf |
| Print | `styles/05-print/` | risograph, halftone, woodcut, engraving, screen print, pop art, collage |
| Graphic & type | `styles/06-graphic-type/` | Swiss grids, spy titles, art deco, pictograms, Bauhaus, scale zooms, text flash cuts |
| Line diagrams | `styles/07-line-diagrams/` | blueprints, isometric infographics, teardowns, cutaways, manuals, pen plotter |
| Cartoons | `styles/08-cartoons/` | 1930s rubber hose, 80s cel anime, sitcom toons, comic history, manga panels |
| Games | `styles/09-games/` | 16-bit RPG, 2.5D pixel art, microgames, game shows |
| Film & tape | `styles/10-film-tape/` | CRT terminal, silent film, found footage, scratch film, double exposure |
| Screens & interfaces | `styles/11-screens/` | keynotes, live app screens, HUDs, desktop flythroughs, spreadsheets, 1-bit dither |
| Light & lines | `styles/12-light-lines/` | circuit traces, fireflies, flow lines, an oscilloscope beam, neon tubes |
| 3D & miniature | `styles/13-3d-miniature/` | brick toys, pop-up books, tilt-shift towns, low-poly islands, glass, dioramas |
| Instruments & evidence | `styles/14-instruments/` | satellite, LiDAR, microscope, archive, X-ray, radar, thermal camera |
| Data & maps | `styles/15-data-maps/` | data stories, white models, physical data, transit maps, 3D maps, simulations |

**For YouTube explainers**, start with the sketch-and-board group (whiteboard, stick
figures, tablet sketch, sketchnote, marker on paper, chalkboard), Scale Zoom, 3D Map
Explainer, Isometric Infographic, Line-Art Cutaway and Data Storytelling: they are built
to hold a long explanation.

## Workflow

Work in a run folder from `edit-video` (`scripts/new-edit.mjs`), one folder per video
under `work/<name>/`.

1. **Brief.** Style, topic, format (reel or YouTube), length, voice, and whether the
   user has their own footage, photos, data, logo or music. Ask once.
2. **Read the style**, then write `TREATMENT.md` with [directing](references/directing.md):
   three structures, the one you chose, the opening frame by frame, a shot list (and
   chapters for YouTube), a cue map and a sound table.
3. **Lock the voice** with `edit-video`'s `scripts/voice.py`. Its word timings are the
   clock for every cut, caption and sound.
4. **Prove the look**: two or three style frames drawn with the real code, checked at
   the format's real size against the `STYLE.md`. A storyboard only if the user asked.
5. **Build** the composition with [building](references/building.md): DOM and GSAP,
   or canvas and WebGL drawn from `t`, with a `cues.json` of one sound per visible event.
6. **Render** with `hyperframes render` (a long YouTube video chapter by chapter), then
   **mix and review** with `edit-video` (`sfx-sync.mjs`, the opening, the must-read
   area, reading time, −14 LUFS).

## Make a style yours

Change a library style instead of starting blank. Sort what you change into three:

- **Safe to change**: palette, typefaces, pace, sound, which native moves you use.
- **Changes its character**: materials and rendering, the colour logic, camera grammar.
- **Can't change**: the style's essence (section 1). Change that and it's a different style.

Make at most five changes at a time, render one style frame next to the original,
then a 15-second test. Save a kept style next to your videos as
`styles/<your-style>/STYLE.md`, in the same shape, so later videos can use it by name.

## Pitfalls already paid for

- A title card or logo on the first frame loses the scroll. Every style's formats say
  what goes first instead.
- A 16:9 composition shrunk into the middle of a 9:16 frame reads as a letterbox.
  Stack the layout; let pictures bleed.
- In a reel, text right of x 900 or below y 1248 sits under the app's buttons and
  caption; on YouTube, the bottom 12 % sits under the player's controls.
- A long YouTube video at one pace loses people halfway. Chapters and a re-hook every
  30–60 s keep them.
- A style's rules are a vocabulary, not a script: the opening, the ending and the
  signature shot come from the topic, not from the style's own examples.
