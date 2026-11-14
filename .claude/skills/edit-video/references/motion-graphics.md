# Motion graphics

Work inside the current edit, with its palette, typography, timing and source
files. An animated insert does not require a second project or a new editing
style. For a standalone request, start from the supplied brief and assets.

1. Decide what animation helps the viewer understand: reveal order, a relationship,
   a comparison, progress or an important change. Use real footage when the claim
   depends on actual product behavior; label conceptual UI and mockups.
2. Build connected states: a take enters a timeline, a gap closes and later clips
   ripple, or sampled colors recolor the same artwork. Use relevant thumbnails,
   controls and shapes at balanced scale, not an isolated giant icon in empty space.
   Carry an object or direction across related beats; use compact object labels
   instead of a second narrative. Avoid perpetual floating and identical pop-ins.
   Build in the active style's material and vocabulary; each style skill has its own
   components and motion rules.
3. Use the current editor when suitable. For coded graphics, use a seekable
   HyperFrames composition, consulting the installed CLI's help or current
   official documentation for APIs. Drive animation from timeline time; keep
   media/fonts local and loaded before rendering. Set frame-0 state explicitly
   and avoid animating CSS filters over large video; see
   [render reliability](local-tools.md#render-reliably). Do not invent renderer commands.
4. Fit the insert to the speech and edit: fast entrances for familiar labels,
   longer holds for unfamiliar diagrams or claims, deliberate stillness when
   needed. Keep text readable during movement and check extreme bounds as well
   as resting positions.
5. Use verified values and meaningful axes, units and source labels for data.
   Decorative charts must not imply measured evidence. Record asset provenance.
6. Render a short sample, watch at normal speed and phone size, then integrate it
   into the existing timeline. Check flashes, font loading, clipping, unexpected
   black frames, audio timing and first/middle/last states. Keep editable source.

Follow the [composition and safe-area guidance](../SKILL.md#compose-for-a-phone)
and the [final review](review.md). Deliver a local candidate; publication is a
separate user action.
