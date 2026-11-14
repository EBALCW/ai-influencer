---
name: edit-video
description: "Edit Reels, TikToks and YouTube Shorts from a brief, footage or reference: cut, captions, sound, motion graphics, safe areas and review of the encoded export. The base for every edit; add one style skill (animated-explainer or film-styles) for the finished look."
---

# Edit video

> **Bu projede (ai-influencer):** yalnızca `film-styles` ve `animated-explainer` stilleri kurulu; kamera önü stilleri, karakter skill'leri ve `publish-and-analyze` alınmadı. Çalışma klasörü repo dışında (`~/ai-influencer-films/`); Türkçe ses `edge-tts` ile üretilir, yayın panelden yapılır, FavStash kullanılmaz. Çalışan komutlar ve tuzaklar: `.claude/skills/anlatim-videosu/SKILL.md` bölüm 8. Kaynak ve yapılan değişiklikler: `.claude/skills/edit-video/KAYNAK.md`.

The base guide for every short-form edit. It owns the cut, captions, sound, motion
graphics, safe placement and review. A **style** skill on top decides the finished
look. Make the treatment fit the story and actual footage: a natural reflection can
stay simple; a product claim may need moving proof.

## Pick a style

| Style | Looks like | Fits |
|---|---|---|
| `animated-explainer` | Fully animated: a lit colour field and one big hero card per spoken beat, the line word-lit at the top, keyed to a locked voice | Tool, product and idea explainers and two-voice conversations when the creator doesn't film |
| `film-styles` | One of 99 film looks drawn in code: whiteboard, stick figures, tablet sketch, chalkboard, watercolour, cel anime, manga, newsreel, caption news, data stories, 3D maps, isometric, tilt-shift, brick toy, risograph, neon and more | A whole reel, or a 16:9 YouTube explainer in chapters, with no camera; each style says what goes first |

Use the creator's own brand and references when they have them. Without a style
installed, follow this guide alone with clean full-camera framing.

## Start from what exists

- Read the brief, supplied references and any creator preferences. A brief from
  `$write-script` carries the approved openings, body, proof map and
  must-keep claims. Resume the existing project for revisions and preserve prior
  cuts. Keep approved copy and the mix during a layout-only revision.
- Inspect representative frames and listen to the takes when playback is
  available. Transcribe speech when needed; preserve meaning, qualifiers and
  natural pauses. Do not invent spoken words or silently rewrite an approved claim.
- Find retakes before cutting. Creators often restart a line and say it again in
  full; keep the later complete attempt. One transcript of a whole take can hide
  a restart, so [split at pauses](references/local-tools.md#find-retakes-before-cutting)
  and transcribe the chunks separately.
- Use the existing editor and run structure when they work. For a fresh project,
  keep inputs, assets, editable source, previews, exports and review notes in one
  dated folder. The [local helpers](references/local-tools.md) can create this;
  they are optional, and editing does not require an onboarding questionnaire.
- Use the creator's brand and references to choose type, color, energy and
  composition, then the style that fits (above). Keep personal reflections simple.
  Don't force a split, panels or an editing app on material that doesn't need it.

## Build the cut

Find the strongest honest opening and the minimum context needed for its payoff.
Choose each shot for what the viewer needs to see at that moment:

| Material | Useful treatment |
| --- | --- |
| Personal delivery or emotion | Full camera; remove false starts while retaining meaningful breaths, humor and pauses |
| Voice plus a visible action/result | Speaker and proof together while both remain legible; expand the proof for detail |
| Desktop or phone demo | Crop to the actual action, preserve spatial continuity and hold the result long enough to inspect |
| Copy over footage | Match action or emotion to the line; give each phrase time to read without adding an unnecessary speaker |
| Relationship or idea that needs explanation | A purposeful animated insert; see [motion graphics](references/motion-graphics.md) |

Own the supporting work: source, capture, trim and inspect the footage available
within the task. Ask for a specific missing asset only when access or recording
requires the creator. Show real product behavior; label mockups and conceptual
graphics. Check screen captures for private data across moving frames.

Use a reference for timing, composition and sound patterns. A transcript alone
does not establish its visual treatment. See [reference media](references/reference-media.md)
when analyzing a URL or reusing third-party material. Keep source/rights notes
for output assets; downloadable does not mean reusable.

Design the opening's picture, emphasis and sound together. For a tension/reveal
hook, make the initial push visibly register and resolve the build at the payoff.
Check source movement: a speaker stepping back can cancel a digital zoom. A
framing grid or kinetic phrase can suit the reference, but is not a universal style.

## Compose for a phone

Default to 1080×1920, 9:16, normally 30 fps unless the brief or source calls for
something else. Keep faces proportionate and complete; inspect crops and blurred
fills for a second ghost face. Enlarge useful detail instead of fitting an
unreadable desktop into a tiny panel. Screen proof normally fills its pane;
decorative cards and headings should not shrink or obscure it. Use full-screen
proof when detail needs it. Change layout on meaningful beats.

For an unknown destination, use this **conservative working mask** at 1080×1920:
essential text, captions and demonstrated UI detail within **x=72..900,
y=269..1248**. Scale proportionally for another 9:16 resolution. This is a house
guide, not an official platform specification; check the intended app's current
preview before publication. Footage and decorative panels can extend beyond it.

Center main captions and cards on the **whole canvas, x=540**. A centered critical
box can be at most **720 px wide** under that mask. Inset or wrap essential contents
inside wider panels instead of shifting the whole design left. Measure the whole
text box, backing, outline and shadow, including animated extremes; a safe anchor
alone does not establish safe placement. Keep eyes, mouth and focal actions clear
of captions and expected app controls.

Use one coherent type hierarchy and colors that work with the real footage.
Start captions around 46–68 px on a 1080-wide export, usually one or two meaningful
lines, then inspect at phone size. Preserve the actual words and keep caption
changes aligned with speech. See [captions](references/captions.md) for detailed
timing, translations or caption revisions. Avoid competing transcript layers.
Alongside captions, normally use only one brief supplementary emphasis. Headings,
eyebrows and footers are optional, not a template to fill. Demonstrate the feature
through motion or actual caption behavior instead of explaining the edit in text.
Keep production notes in the report; disclose a mockup on screen when needed to
prevent it being mistaken for real evidence. When B-roll is absent, animate the
relevant idea rather than leave an empty pane or substitute a text-heavy slide.
Simplifying does not mean one oversized icon: show connected state changes with
relevant assets, such as footage entering a timeline and gaps closing. Carry an
object through related beats; keep compact object labels subordinate to speech.

## Sound and motion

Speech comes first. Trim with short fades, preserve natural tone and remove
unwanted source/demo audio. Duck music and SFX under speech; silence is valid.
Use owned or licensed music. If the creator will add native platform music,
deliver the appropriate cut without a music bed and note the intended timing.

Make SFX follow visible events: click for a UI action, pop for an element arrival,
shutter for a meaningful camera/cut change, swish for a motivated zoom, tick for a
step, thock when something settles, latch when it locks or connects. A short
riser can build into a reveal; resolve it at the visual payoff. Merge nearby cues
and keep ordinary caption changes silent. Prefer the creator's established sounds;
otherwise start with the [SFX pack](assets/sfx/manifest.json).
Copy only selected files, align audible transients rather than file starts, and
audition them against speech. The pack's other one-shots (ding, sparkle, impact,
typing tick, ratchet, shimmer) cover payoffs, typing and product moments.
Suggested gains are starting points, not a volume ceiling: a demonstrated click
or reveal build must be audible. Trim/time-stretch a riser to the reveal and check
the combined mix, not isolated cue levels.

Animated reels (`animated-explainer`, `film-styles`) start from a locked voice:
[`scripts/voice.py`](scripts/voice.py) places one take per line and writes every word's
time, from the creator's own recording, a free local voice or ElevenLabs. See
[voice options](references/voice.md), including how to clone your own voice for free.

When sounds follow on-screen events, put each one on the **first frame that shows
its event**: struck sounds on their attack, swells on their peak.
[Sound on the frame](references/sound-sync.md) explains the rules, and
`scripts/sfx-sync.mjs` measures sync points, mixes a cue sheet under the voice,
masters it with encoder headroom and draws strips that prove every hit on the export.

Keep editable source and separate audio/caption tracks when the editor supports
them. Use FFmpeg for straightforward trims/assembly and HyperFrames when a coded
composition helps; each style skill brings its own builder. Read
[local tools](references/local-tools.md) when setup, analysis or rendering
helpers are needed, including its [render reliability](references/local-tools.md#render-reliably)
notes. Render a representative treated sample, inspect it, then finish the
requested cut; do not multiply variants before it works.

## Review and deliver

Inspect the **encoded candidate**, following [review](references/review.md):
frame 1 and the first 3 seconds of every variant, changing layouts, longest
captions, moving proof, sound and ending. Verify streams and full decode as well
as visual quality. Report only checks actually performed; measurements do not
prove a listening pass.

Keep numbered exports and the recoverable project/source. Show the actual video,
summarize what changed and state remaining limitations. Technical validity,
creative acceptance and publication approval are separate.

Publishing is a separate step outside this skill (in this project: the panel).
Never publish, schedule or upload merely because a cut is finished or a service
is connected; obtain approval for the exact outward action.
