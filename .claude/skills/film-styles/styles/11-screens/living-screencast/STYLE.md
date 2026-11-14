# Living Screencast

> A product walkthrough that looks like a real screen recording, where a low-resolution mascot lives inside a high-resolution interface and acts out what the software is doing. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only):
> - **Auto-zooming screen-recording tools:** auto-zoom to the cursor, cursor smoothing, click push-ins, and a window floating on wallpaper.
> - **Platform makers' guided-tour videos:** real interface, calm narration, one feature per sentence.
> - **The mascots of learning and meditation apps:** squash and stretch, anticipation, a character that performs inside the UI.
> - **Playful browser-startup launch videos:** playful tone and fast cutting.
>
> Never copy their characters, UI, music or footage, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Wallpaper bleeds to every edge; the camera lives inside the window at zoom ≥ 1.4, so one pane fills the tall frame. If your app has a phone layout, use its real phone UI full-bleed instead. Must-read UI, the mascot and the element under discussion stay inside the safe box (x 72–900, y 269–1248). Chapter pill top left at x 72, y 290; keystroke HUD centred on x 540 around y 1060; caption pill centred on x 540, at most 720 px wide, baseline near y 1190, with a text-free lane above it for the mascot. Stack, don't shrink: side-by-side panes become a vertical whip from one to the other, a split-window reframe stacks top and bottom, a follow along a list scrolls down it.
- **The first 3 seconds.** Frame 1 is mid-task: a half-typed prompt in your app's input box, caret blinking, the mascot already standing on the box's top edge. By 0.5 s it crouches and jumps onto the send button as the cursor clicks with a push-in; by 3 s the UI changes state because of it (a result arrives, a test turns green).
- **Length and pace.** 30–45 s at 30 fps, one continuous take, at most two chapter seams. One feature per spoken line, a push-in or a whip every 3–5 s, one spotlight freeze with a short drop to room tone.
- **Captions.** Frosted-glass pills in the spoken language, never over the element being discussed and never under the mascot; keystrokes live on the HUD, not in captions.
- **Sound.** `thock` on keystrokes, `ui-click` on cursor clicks, `ui-pop` on popups, `zoom-swish` on whips, `sparkle` on the mascot's landings and cheers, `clean-ding` on a success state. The hi-fi band and the chiptune voice come from a free sample library or the user's music; the mascot's 8-bit steps and jumps too.

### YouTube (1920×1080)

- **Layout.** The body as written: the window floating on wallpaper, camera inside at zoom ≥ 1, chapter pill top left, caption pill bottom centre. Keep the caption pill and the keystroke HUD above the bottom 12 % (the player's controls) and the mascot and anything to be read inside the 5 % margins.
- **Length and structure.** 3–8 min at 30 fps. A chapter is one feature; its title card is the chapter pill (01–04) wiping across with the feature's real name, the mascot landing on it on a downbeat. Re-hook every 30–60 s with a time-lapse tag, a theme switch, a cell division or a cursor-and-mascot gag.
- **The first 10 seconds.** The finished result first, the mascot standing on it; by 5 s a rewind to the empty state and the question (how did it get here?); by 10 s the promise, the chapter pills lining up. Any channel sting after that.
- **Captions.** The pills burned in as part of the look, plus an `.srt`.
- **Thumbnail.** A push-in frame with the mascot mid-jump over the key UI element, large, plus the feature's name in at most three words.

### Good for

Product tutorials, feature launches, onboarding, agent and developer-tool demos, changelog walkthroughs, YouTube how-to series.

## 1. Essence, and what it is not

A walkthrough of a piece of software: your app, whether it is a terminal tool, an editor, a web app or a phone app. A reel shows one or two features in 30–45 s; a YouTube tour takes them one chapter at a time. The user gives the product and the features; you decide the story, shots, choreography, sound and music.

The video looks like a **screen recording of the real product**, but it is not a recording. Every window, menu, diff line and button is **redrawn in 2D (HTML/CSS/SVG)**, so the camera can go anywhere, every pixel is controllable and text stays sharp at any zoom.

**Your mascot, made of big square pixels**, lives in that high-resolution world. The clash of two resolutions, a hard-edged low-res sprite against anti-aliased UI, is the look.

The mascot is the software's agency made visible: when the software reads, it runs along the rows it reads; when it plans, it holds a pixel pencil; when it tests, it stomps the button.

**Two actors, never a hand:** the **cursor** is the user; the **mascot** is the software.

Not **Dark Tech Keynote** (no black stage, no invented abstract UI: this is the real product), not **16-bit Pixel RPG** (the world is hi-res vector UI; only the mascot and its props are pixels), not a real capture (nothing is a screenshot).

## 2. Materials & rendering

- **Real UI, redrawn**: every label, mode name and shortcut matches the real product; no screenshots, no lorem ipsum. Sample content (code, data, test output) is coherent, and the app under test really changes.
- **Pixel grid is sacred**: the mascot, its props (pencil, "!", sparkles, heart, dust) and trails share one square-pixel grid with crisp edges. It scales with the camera; its position snaps to half-pixels, so its motion feels stepped.
- **Gravity = top edges of UI**: the mascot only stands on the top edge of a real element (input box, menu, list row, code line, button, status bar, the letters of a heading). Its position comes from **measuring the live DOM** every frame, never hand-placed coordinates.
- **Window on wallpaper**: the app floats on a desktop with a soft shadow; zoom never shows beyond the monitor.
- **Depth** only where it serves attention: rack focus (blur the pane that doesn't matter), a vignette spotlight. Never blur text the viewer must read.
- **Motion blur** is derived from camera speed and applied as an anisotropic blur on an **untransformed wrapper**, only on whips. Slow moves stay sharp.

## 3. Colour logic

- The product's own interface colours rule: follow its real light and dark themes exactly.
- The mascot keeps the product's or brand's mascot colour, or one saturated hue that no UI element uses, so it finds the eye in any frame.
- Overlays (chapter pill, key HUD, captions) are neutral frosted glass; one accent at most, taken from the product.
- A theme switch can be a story event: the whole video may change state with it.

## 4. Type & subtitles

- UI type follows the product (or licence-free look-alikes such as Inter, JetBrains Mono, a serif for editorial UIs).
- **Information layers only**: a chapter pill (01–04), a keycast-style keystroke HUD, frosted-glass caption pills, an optional "▶▶ 4×" time-lapse tag. Nothing else overlays the screen.
- Captions sit in a pill at the bottom, never over the element being discussed and never under the mascot; hold ≥ max(1.8 s, speech + 0.6 s), at most about eight words per pill.
- A title, if any, is diegetic: it appears as part of the UI (an empty-state heading, a window title, a notification).

## 5. Motion quality

- 30 fps; UI on ones; mascot position stepped to its pixel grid.
- **Mascot acting**: jumps with anticipation crouch, stretch on take-off, tucked legs, landing squash with a damped bounce and dust. Idle breathes (a tiny squash) on the score's beat and blinks irregularly. Walks by leg alternation, flipping the sprite for direction.
- **Eyes carry the acting** (neutral / left / right / up / down / wide / happy / shut / blink): they look at what matters. Arms: down / up (cheer) / wave.
- **Cursor**: smoothed, spring-eased paths, small push on click, never teleports.
- **Cause and effect**: every mascot action triggers a real UI state change; every user action is a cursor move, click or keystroke shown on the HUD.
- UI animates like the real product (its own menus, popovers, diff reveals); don't invent flourishes the product doesn't have.

## 6. Camera grammar

A recording-software camera: one continuous take inside the screen, zoom ≥ 1, cuts only under chapter transitions. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Push-in to the cursor or caret | "this is where it happens" | typing a prompt; choosing a menu item; a setting |
| Slow drift at rest | the app is alive while we listen | a line of narration; waiting for a result |
| Whip-pan between panes (with blur) | cause here, effect there | sending a message → a result appearing; code → preview |
| Push-in + vignette freeze | the one promise to remember | a safety guarantee; a price; an undo |
| Rack focus between panes | attention moves, nothing else does | reading files; logs scrolling while chat waits |
| Pull back to the full window | the whole workflow in view | a summary; parallel tasks; before/after |
| Follow the mascot along a list | the software working through items | scanning results; a checklist; a migration |
| Split-window reframe | two things at once | parallel sessions; compare two versions |

Framing: the thing being discussed and its caption never overlap; the mascot never covers text to be read. Transitions: chapter pill wipes, pixel wipes, a theme reveal circle; never dissolves or screenshots.

## 7. Sound palette

- **Two resolutions in the music**: a hi-fi layer (piano, upright or electric bass, brushed or tight kit, glockenspiel, real samples) is the world; a chiptune square or pulse voice is the mascot. They can trade, duet or merge.
- Options: a low-passed "night" version of the band for a dark theme; a tom fill and crash at chapter seams; dropping the drums to build tension; the mascot's notes on words it lands on; a stereo split for split screens; a single held pad under a freeze.
- **Foley**: keyboard (a thock plus a click, human timing jitter), trackpad clicks, pane swishes, popup pops, notification chimes, CI ticks, a shutter for screenshots. Mascot steps, jumps and landings are 8-bit.
- **Silence**: a short drop to room tone before the key promise makes it land.
- **Voice**: one calm narrator, one feature per line; product names verified with speech-to-text (whisper). Keep effects off word onsets. Duck music under voice; master −14 LUFS.

## 8. Native moves

A menu: use the ones your walkthrough needs.

- **Match-cut origin.** The mascot is born from something already in the UI (a logo's block characters, an icon, a loading spinner, a terminal prompt) and climbs out, leaving an outline. *Fits content like:* a chat bubble turning into a guide; an icon becoming an assistant; a spinner becoming a helper.
- **Diegetic title.** The name appears as a real UI element; the mascot lands on it on a downbeat. *Fits content like:* an empty state; a new-project dialog; a welcome email.
- **Moving floor.** The mascot rides a caret, a popup, a sent message, a progress bar. *Fits content like:* a message flying into a thread; an upload bar; a drag-and-drop.
- **Time-lapse with a tag.** Long work runs at N× with a flashing tag and rack focus. *Fits content like:* indexing a library; a data import; a build.
- **Spotlight freeze.** Push in and vignette the one badge that holds the promise. *Fits content like:* "Saved"; "Encrypted"; "No charges until…".
- **The video changes state.** A toggle's effect escapes the preview and takes over the whole video, and returns later. *Fits content like:* dark mode; a language switch; offline mode.
- **Cell division.** A new session or window splits the screen and the mascot splits with a pixel burst. *Fits content like:* parallel tasks; multiple accounts; team members.
- **Cursor and mascot as characters.** The cursor pets, pokes or drags the mascot, and it reacts. *Fits content like:* approving a suggestion; undoing; onboarding delight.
- **Karaoke-ball words.** The mascot hops from word to word as they are spoken. *Fits content like:* a slogan; a shortcut list; step names.

## 9. Pitfalls of the medium

- Invented features or renamed modes → check every button, mode and shortcut against the product's documentation; if it isn't in the docs, it isn't in the video.
- The mascot floats or drifts off its element → measure the DOM every frame, stand only on top edges.
- The mascot covers text or sits under a caption → reserve a text-free lane for it.
- Blur-filter "fake depth" on text you want read, or zooming out past the screen → rack focus only on panes not being read; zoom ≥ 1.
- A hand, arm or finger on screen → the cursor is the user.
- Motion blur applied to a transformed layer smears the pixel sprite wrong → blur an untransformed wrapper, and only on whips.
- A keypress or pop landing on a product name masks it → shift foley off word onsets; re-check with speech-to-text on the final mix.
- The synthetic voice mispronounces the product name → try voices and spellings, verify with speech-to-text.
- In a reel, UI shown at desktop zoom is unreadable on a phone → push in until body text is at least 28 px on the 1080-wide frame, or use the phone layout.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A DOM composition with one paused GSAP timeline: the interface as HTML/CSS/SVG rendered from a state per moment (a function from state to HTML for each screen), wrapped in a world element that carries the camera transform. Light and dark themes are two stacked layers; a theme switch is a `clip-path` circle reveal between them.
- Every visual beat hangs on a spoken word: look the word up in the voice's word timings and place the click, the jump or the state change on its start. Camera moves, cursor paths and mascot segments (walk, jump, ride, idle) are tweens on the same timeline.
- The mascot is a pixel sprite on its own grid: poses and props as small bitmaps drawn with `image-rendering: pixelated` (or a canvas scaled by an integer); swap in your mascot's sprite and keep the pose set (eyes, arms, crouch, stretch, squash).
- Each frame, measure the target element's top edge from the live DOM (`getBoundingClientRect` after the state for `t` is applied) and stand the mascot on it, snapped to half-pixels of its grid; never hard-code coordinates.
- Motion blur from the camera's speed between `t` and `t − 1/30`: an SVG `feGaussianBlur` with the blur only along the direction of travel, on an untransformed wrapper, only above a whip threshold. HUD layers (captions, keys, pixel wipes, spotlight vignette) sit outside the camera.
- One cue per visible event in `cues.json`: keystrokes, clicks, pops, whips, and every mascot step, jump and landing.

## 11. Variation space

You decide the features and their order, the mascot (the product's own, or an original pixel character), the story, the opening, the ending, the camera path, the chapters and the music. Vary them per video:

- Structures: **a bug hunt** (the mascot chases one error through logs, code and a fix, a single chapter); **a day of one user** (morning to evening in one app, the theme and music shifting with the hour); **a race** (two windows side by side, stacked in a reel, old way vs. new way, the mascot winning on the new one).
- Openings: **mid-task** (a half-written document; the mascot is already pushing the cursor's selection); **the notification** (a system toast lands; the mascot is inside it); **empty state** (a blank app, a caret blinking; the mascot drops from the menu bar).
- Endings: **the mascot goes to sleep** on the finished item as the window dims; **the app closes** and the mascot is left standing on the dock; **a real share** (the result is sent and the mascot rides it out of frame).
