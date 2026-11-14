# Third-party notices

This repository provides instructions and media helpers. Apart from the fonts marked **bundled**, it does not vendor the projects below; setup or the creator installs them.

| Project | Role | License note |
| --- | --- | --- |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Optional HTML-to-video renderer and local transcription | Apache-2.0 upstream at time of integration; verify the installed release |
| [GSAP](https://gsap.com/) | Animation runtime copied into generated style compositions | GSAP Standard "no charge" license; installed from npm by setup, not redistributed here |
| [FFmpeg](https://ffmpeg.org/) | Media probing, extraction, encoding, and QC | LGPL/GPL configuration varies by build; review the binary you install |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | User-authorized reference download and metadata | Unlicense upstream at time of integration; platform terms and media rights remain separate |
| [FavStash CLI](https://www.npmjs.com/package/@sketric/favstash-mcp) | Optional sign-in, MCP bridge and local uploads for FavStash | MIT on npm at time of integration; the FavStash service has its own terms |
| [Montserrat](https://github.com/JulietaUla/Montserrat) | Caption and graphics font **bundled** in `skills/3-styles-on-camera/breakout-card/assets/fonts/` | SIL Open Font License 1.1; the license text ships beside the fonts |
| [Inter Tight](https://github.com/rsms/inter), [Instrument Serif](https://github.com/Instrument/instrument-serif), [Geist Mono](https://github.com/vercel/geist-font) | Type for animated-explainer and 3d-character, **bundled** in each skill's `assets/fonts/` | SIL Open Font License 1.1; the license text ships beside the fonts |
| [three.js](https://github.com/mrdoob/three.js) 0.168.0 | 3D rendering for 3d-character; edit-video's setup installs it into the workspace runtime and the builder copies it, with its license, into each 3D reel | MIT |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via `hyperframes tts` | Optional free local voice for animated reels | Apache-2.0 upstream; HyperFrames downloads the model, not distributed here |
| [Chatterbox](https://github.com/resemble-ai/chatterbox) | Optional free local voice that clones the creator's own voice | MIT; archived by Resemble AI in August 2026; installed by the creator with pip; its output carries Resemble's Perth watermark |
| [ElevenLabs](https://elevenlabs.io) | Optional hosted voice, set up by the creator's agent with the creator's own account; this pack never calls it | A paid service with its own terms |
| [PDQ](https://github.com/facebook/ThreatExchange/tree/main/pdq) via `pdqhash` | Frame hashing for the optional duplicate check | BSD-style upstream license; installed with pip, verify the installed package |
| [NumPy](https://numpy.org/), [SciPy](https://scipy.org/), [OpenCV](https://opencv.org/) | Optional duplicate check, breakout-card plates, voice and lip-sync timing, and building a cartoon rig | BSD / Apache-2.0 upstream; installed with pip |
| [Playwright](https://playwright.dev/python/) | Optional page captures and layout snapshots for paper-grid | Apache-2.0; installed with pip, uses the local Chrome |
| Apple Vision | Built-in person matte for breakout-card on macOS | Part of macOS; not distributed here |

The adaptive glass CSS is an original implementation informed by the optical-layer model in [liquid-glass-css](https://github.com/turtiesocks/agent-skills/tree/main/liquid-glass-css); no code from it is included.

Every sound in the pack is original synthesis from edit-video's sound definitions, covered by Apache-2.0; no recordings ship. edit-video makes each sound on first use.

The `product-motion-ads` method is informed by [brag](https://github.com/latent-spaces/brag) (MIT); no text or code from it is included. Its preview image shows an ad an agent built with the skill from brag's MIT-licensed "Horse Tinder" example site, a fictional app; its artwork was drawn in code.

The other style preview images in `assets/previews/` come from the maintainer's own reels, with the speaker replaced by a placeholder figure, and are included with his permission; they are not covered by the code license for reuse as stock footage.

The sample characters in `skills/3-styles-characters/cartoon-character/characters/` (a cartoon of Ali, the maintainer, and Stashy, the FavStash mascot) are included at the maintainer's request for trying the skills. They are not covered by the code license; their [terms](skills/3-styles-characters/cartoon-character/characters/README.md) say how they may be used.

The `animated-explainer` preview image is three frames of a reel the skill built from its worked example, with the Ali sample as the cursor and a Kokoro voice. The `cartoon-character` preview is composed from the two sample rigs.

Many of the style guides in `skills/3-styles-animated/film-styles/styles/`, and its `references/directing.md`, are adapted from material under the MIT License; the notice that license requires travels with the skill in its [`NOTICE.md`](skills/3-styles-animated/film-styles/NOTICE.md).

The README's gallery tiles and the strip of ten looks at its top are single frames cut from the style previews above. The `film-styles` tile and the YouTube explainers image are typographic samplers drawn for the README, not frames of a video.

The `3d-character` preview image shows frames of the worked example built by the skill.
