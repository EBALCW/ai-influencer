# Sound on the frame

When a reel's sounds follow visible events, each sound should play on the **first
frame that shows its event**. A click one frame early reads as a glitch; a pop two
frames late feels sluggish. [`scripts/sfx-sync.mjs`](../scripts/sfx-sync.mjs) does
the arithmetic and the checks. It needs Node 22+ and FFmpeg, nothing else.

## The rules

1. **Cue the frame, not the second.** A change at time `t` is first drawn on frame
   `ceil(t × fps)`, so every cue time is snapped up to its frame. A fade-in shows on
   the frame after its tween starts; a hard switch shows on its own frame.
2. **Sync the right point inside the sound.** A sound file rarely starts with its
   hit. Struck sounds (clicks, pops, dings, shutters, hits) sync on their first
   strong attack: where the level first reaches half its maximum. Swells (whooshes,
   risers, shimmers) sync on their peak. A sound counts as struck when its level
   jumps 12 dB or more within 10 ms at that attack; swells climb more slowly. A
   two-note chime or a "ch-CHK" shutter synced on its loudest note plays its first
   note early, so the attack rule wins. Many sound files open with silence
   or hit late: trim each to just before its attack and keep it short and dry. The
   mixer measures the sync point either way (`points`); when you place sounds in
   another editor, put that point, not the file start, on the event's frame. A
   whoosh that leads a cut peaks a few frames before it; one on a camera move
   peaks mid-move.
3. **Beds start on their cue.** Music, typing loops and ambience have no single
   hit: mark the cue `"bed": true` and the file starts on the frame. The pack has no
   music; use the creator's licensed track, one they own, one generated for this
   reel, or none.
4. **Leave headroom for the encoder.** AAC overshoots sharp clicks, and some
   renderers turn the whole track down when its encoded true peak passes −1 dBTP.
   The mixer masters to −14 LUFS with a −2.5 dBTP ceiling by default.

The pack manifest's `transientLeadFramesAt30fps` is a rough hand-placement hint
for timeline editors; the mixer measures each file's exact sync point instead.

## Cue sheet

JSON with the reel's `fps`, optional `total` (seconds) and a `cues` list. Style
builds such as `product-motion-ads` write it as they go; otherwise write it from the edit:

```json
{
  "fps": 30,
  "total": 32,
  "cues": [
    { "t": 0, "sound": "hook-impact", "gain": -6, "label": "opening" },
    { "t": 9.6, "frame": 288, "sound": "ui-click", "gain": 2, "label": "send pressed" },
    { "t": 7.7, "sound": "typing-tick", "bed": true, "label": "typing" },
    { "t": 16.9, "sound": "../sounds/my-riser.wav", "pan": -0.3, "dur": 1.2 }
  ]
}
```

- `sound`: a pack id (`ui-pop`; older `curated/ui-pop.wav` names still work) or a path
  relative to the cue sheet.
- `gain`: dB relative to the pack's suggested gain (0 dB for your own files).
- Give each cue a `frame` (preferred: the first frame that shows the event) or a
  time `t` in seconds; `frame` wins when both are present. `pan` runs from −1
  (left) to 1 (right); `dur` trims the sound with a short fade.

## Commands

```bash
# Where each sound syncs (default: the whole pack)
node <skill>/scripts/sfx-sync.mjs points
node <skill>/scripts/sfx-sync.mjs points <run>/assets/sfx/*.wav

# Mix cues (and the voice) and put the mix on a silent render
node <skill>/scripts/sfx-sync.mjs mix <cues.json> --out <run>/audio/mix-v01.wav \
  [--voice <run>/audio/voice.wav] [--duck 6] [--lufs -14] [--true-peak -2.5] \
  [--video <run>/previews/v01.mp4 --mux <run>/exports/v01.mp4]

# Prove it on the export
node <skill>/scripts/sfx-sync.mjs check <run>/exports/v01.mp4 --mix <run>/audio/mix-v01.wav \
  [--cues <cues.json> --strips <run>/reports/sync-v01] [--min-gain -6] [--width 180] [--crop x,y,w,h]
```

`mix` writes the master (`mix-v01.wav`), the effects alone before ducking
(`mix-v01.sfx.wav`) and the plan with every file's start (`mix-v01.plan.json`).
It renders each struck cue alone to confirm its attack lands on its frame,
ducks the effects under the voice (6 dB by default) and masters the result.
With `--video` and `--mux` it puts the mix on the render and reports the encoded
true peak.

`check` measures the offset between the video's audio and the mix (want 0
samples) and its loudness. With `--cues` and `--strips` it writes contact sheets:
seven frames around each cue, with the frame the sound plays on boxed in red.
`--min-gain` skips quiet cues (it compares each cue's `gain`, which is relative to
the pack's suggested level, so −6 keeps everything at or above 6 dB under it).
Small events (a badge pop, one highlighted word) need a closer look: `--crop
x,y,w,h` zooms every strip to that region and `--width` sets each frame's size. In every strip, the red frame should be the first that
shows the event. If a strip shows the event a frame earlier, move that cue to
the earlier frame; if it shows later, the cue is early.

## Listening still decides

The numbers prove placement, not taste. Listen to the mix against the voice,
merge cues that fall within about 6 frames of each other, keep ordinary caption
changes silent and make demonstrated clicks audible.
