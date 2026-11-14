# Optional local tools

For editing tasks, use the creator's existing project and editor first. These helpers are for a
fresh local workspace or repeatable media preparation; no helper is required
for a small revision. Resolve `<skill>` to the directory containing this skill's
`SKILL.md`, not the creator's working directory. Helpers require Node 22+.

## Create an edit

```bash
node <skill>/scripts/new-edit.mjs --workspace /path/to/project --slug topic
```

This creates `.favstash-studio/edits/YYYY-MM-DD-HHMMSS-topic-<id>/` with `input/`,
`references/`, `analysis/`, `assets/`, `work/`, `previews/`, `exports/`, `reports/`,
a small `edit.json` and an empty `asset-ledger.json`. No installation, style
selection or separate setup is required. Resume the existing run for revisions.

Keep raw media in `input/`, analysis copies in `references/`, prepared output
assets in `assets/` and editable source in `work/`. Use the existing brief or short
notes in `analysis/` for creative decisions; no extra planning form is required.
Record the selected export, source/project and review status in `edit.json`.
Number exports instead of overwriting. Leave existing creator folder conventions
intact; the reference helper needs `edit.json` and `asset-ledger.json` in its run.

## Check or install tools only when needed

```bash
node <skill>/scripts/doctor.mjs --workspace /path/to/project
```

FFmpeg/FFprobe handle media preparation and encoded-file checks. URL analysis
needs yt-dlp. The doctor reports each dependency separately; a missing renderer
or downloader does not block work that does not use it.

For a coded composition (every style builder uses one), the optional setup installs
the pack's pinned HyperFrames 0.8.32 runtime and GSAP 3.14.2:

```bash
node <skill>/scripts/init-workspace.mjs --workspace /path/to/project --install
```

It creates `.favstash-studio/runtime/` and a short optional preferences file,
preserving existing preferences and existing HyperFrames or GSAP versions.
Without `--install`, it prepares files only. Use the installed CLI's `--help` to
find the commands for that version. Keep a composition seekable, use local media
and retain source beside the export. Do not vendor renderer source into the pack.

Existing native timelines or other working renderers remain valid. Use the
editor's available connector/API for timeline operations, verify the exact
project before mutation, and retain its editable package. Install only tools
needed by the task and check their applicable licenses.

## Render reliably

- Render one composition per section, such as each opening and the shared body,
  instead of one long reel. A crash or a fix then costs one section, and the
  sections join back to back in the editor or with FFmpeg.
- Do not animate CSS `filter` (grayscale, blur, brightness) on a layer that holds
  large video. It can crash headless Chrome mid-render, repeatedly at the same
  frame. Fade a plain overlay instead.
- Set frame-0 state with `gsap.set` or a real tween. A zero-duration `tl.set` at
  time 0 can revert on seek and leave frame 1 blank or wrong. Hide anything that
  enters later in CSS or inline. Run `node --check` on generated scripts and
  `hyperframes check` before rendering.
- Inspect frame 0 of every raw render. If it is black while frame 1 is correct,
  fix the composition or replace that frame before assembly.
- After stopping a render, confirm no orphaned process is still writing its
  output. Delete a partial file and render again before trusting it.
- Before any frame-by-frame processing (a person matte, tracking, stabilization),
  convert the cut to a constant frame rate (`ffmpeg -i cut.mp4 -vf fps=30 …`). Cut
  points often carry one-frame timestamp gaps that silently put the result out of sync.

## Find retakes before cutting

Creators often restart a line and say it again in full; the later complete
attempt is normally the keeper. A single transcription of the whole take can
smooth a restart into one clean sentence, so split the take at pauses first:

```bash
ffmpeg -i take.mp4 -af silencedetect=noise=-40dB:d=0.15 -f null - 2>&1 | grep silence_
```

Cut chunks at the detected pauses and transcribe each one separately, for example
with the runtime's `hyperframes transcribe <chunk> --model base.en --json`. A
repeated fragment then shows up as its own chunk. Record the retakes found and the
ranges kept in the run, and confirm the convention with the creator when unsure.

## Reuse footage

For a reusable footage library, put descriptively named files in
`.favstash-studio/broll/` and optionally run:

```bash
node <skill>/scripts/index-broll.mjs --workspace /path/to/project
```

The index records file descriptions, hashes and technical metadata; filenames
and successful indexing do not establish rights or visual suitability. The
[SFX pack](../assets/sfx/manifest.json) is available directly from this
skill; there is no separate sound skill or required library-copy step. To put
each sound on the frame that shows its event, mix a cue sheet with
`scripts/sfx-sync.mjs` ([sound on the frame](sound-sync.md)).
