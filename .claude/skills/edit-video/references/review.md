# Review the encoded cut

A successful render is only a technical starting point. Inspect the candidate
that will actually be delivered, not just the composition preview.

- Watch the opening, each layout change, critical proof and ending. The hook
  should agree with the payoff, and trimmed speech should retain its meaning.
- Inspect frame 1 and the first 3 seconds of every variant on their own. Frame 1
  must already show the hook's subject or motion: never a black or blank frame,
  an empty panel or a heading over unreadable UI. The steepest drop-off usually
  happens here, so a weak opening outweighs polish later in the cut.
- At normal speed, can a viewer follow speech and proof without reading a second
  explanation? Remove redundant titles, labels and footers. Paused readability
  alone is not enough; check the hook's movement and sound as one timed event.
- Compare the opening's first/peak frames and a representative body sequence.
  Did source movement cancel the push? Does the body demonstrate a state change
  rather than a slide or oversized icon? Verify overlays in the encoded pixels;
  an editor's diagnostic grid is not an exported effect, and transparent assets
  can contain invisible lines even when their RGB channels look correct.
- Inspect at phone size, including the longest caption, both sides of transitions
  and animated extremes. Follow the main skill's [safe-area guidance](../SKILL.md#compose-for-a-phone).
  Measure complete text/backing/shadow bounds; check face crops, ghost faces in
  blurred fills, legible UI and collisions between captions and evidence.
- Listen when playback is available: missing syllables, cut clicks, duplicated
  voice, unwanted demo soundtracks, music masking and overlapping SFX. Align
  audible transients to events. Do not claim a listening check from signal data.
- Probe dimensions, frame rate, duration and streams; decode the whole file.
  Check changing frames in moving shots and investigate unexpected black frames,
  freezes or silence. H.264, yuv420p and fast-start MP4, with AAC when audio is
  present, are useful delivery defaults. Verify destination-specific limits
  from current official information when those limits matter.
- Measure loudness and peaks after encoding; preserve intelligibility and
  headroom rather than forcing a universal loudness number.
- Confirm output assets have recorded reuse rights and required attribution.
  Check redactions in moving footage, not only a thumbnail.

Fix material errors before calling a cut finished. If a check cannot be done,
name it as a remaining limitation. Keep a short report in `reports/` identifying
the exact candidate/version, checks performed and open issues. Technical checks
do not constitute the creator's taste approval or permission to publish.

Keep the source/project and previous exports. Confirm linked assets exist and
state which layers are editable versus flattened. Show the actual local video
and a concise change summary. Clean up only task-created temporary files,
processes or tabs; verify a retained copy before removing duplicate media.
