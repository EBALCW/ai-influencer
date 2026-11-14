# Reference media

Inspect the visual reference when treatment matters: shot order, crop, caption
changes, movement, holds and sound-cue placement. Record transferable decisions
in brief notes. Use creator-owned or licensed material for the resulting edit.

For a supplied URL, the optional helper downloads an analysis copy, samples
frames, extracts audio when present, and records provenance and technical data:

```bash
node <skill>/scripts/reference-analyze.mjs --url "https://example.com/reel" --edit /path/to/run
```

`<skill>` is the directory containing the main `SKILL.md`. This needs yt-dlp,
FFmpeg/FFprobe and the run metadata from the [local helper](local-tools.md).
Inspect additional frames around fast cuts; a periodic sample is not a full
visual review. Extracted audio is for analysis, not automatic reuse.

The default rights status is `analysis-only`, excluded from output. Reusable
statuses are `owned`, `licensed`, `public-domain`, `cc0` and `cc-by`, within their
actual terms. Keep license evidence for `licensed` and attribution for `cc-by`.
The script requires `--confirm-rights` for reusable status, `--rights-note` for
licensed media and `--attribution` for CC BY. Pass these only when the user's
instructions or supplied evidence support them. `--reuse-video` / `--reuse-audio`
copy material into assets only under those recorded rights.

Log source and allowed use for other imported assets too, including music,
fonts and generated assets. Keep unknown rights out of the final composition.
A download or saved inspiration does not establish permission to reuse it.

Use `--cookies-from-browser` only when explicitly authorized. Do not expose
cookies, bypass access controls or upload private material for analysis without
an authorized need. Preserve source files; keep analysis copies inside the run.
