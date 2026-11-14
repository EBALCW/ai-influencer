# Printed Long Take

> A three-dimensional world rendered as a scratchboard print, ink and paper with one red, crossed by one unbroken camera move. Depth, weather and light are all cut lines; the camera travels through the print instead of the print being turned page by page. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): wood engraving and scratchboard illustration (tone made by the width of parallel cuts), Japanese shin-hanga landscapes (layered planes of mountain, forest, water), and the single-take tracking shot of documentary nature films (a move that never cuts). Take the cut line, the layering and the unbroken move; never copy a print, an illustrator's figures or a film's route.

## Formats

### Reel (1080×1920)

- **Layout.** A tall frame stacks the layers: sky at the top, the mountain or forest band, the middle ground where the subject lives (about y 300–1050), and the foreground ink silhouettes (branches, fences, posts) along the bottom, under the app's buttons, where nothing needs reading. Horizon on the upper third; the taller field of view keeps the sky in a steep high wide longer (§6). Carved words and sky plates land inside x 72–900, y 269–1248 for their whole hold; the subtitle bar is centred on x 540, at most 720 px wide, its bottom edge above y 1240, with the subject above it. Lateral pans become sinks, rises and tilts; a before-and-after is the peel, never two prints side by side.
- **The first 3 seconds.** Frame 1 is already mid-take: low over cut water or snow, all three layers and the red subject in frame. By 0.5 s a foreground ink silhouette sweeps past and the layers slide apart; by 3 s the red wakes (a head lifting, a window lit) or the take bursts through steam into a new scale, and the count is carved on a board.
- **Length and pace.** 25–45 s as one take, cut only by a designed transition. The camera decelerates into every hold (≥ 1.8 s, longer to read); passes through steam last under half a second; one silence before the verdict.
- **Captions.** The subtitle bar in the language spoken, one or two lines; words in the world carry only keywords and numbers.
- **Sound.** `zoom-swish` through steam or a structure, `tick` for each letter cut into a board, `thock` as a seal or block is pressed, `sub-impact` for the heavy low stroke after the silence. The world's matter, the knife and torn sheet, animal calls (CC0 or CC BY) and the chamber score come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 4 as written; the subtitle bar's bottom edge sits above y 950 (the player's controls cover the bottom 12 %), and carved words stay inside the 5 % margins.
- **Length and structure.** 3–8 min in chapters, each one unbroken take of 40–90 s joined to the next by a designed transition (a pass through a structure, a steam whiteout, a peel, a seal), which is also where separately rendered chapters join. Each chapter opens on a plate of type cut into the sky. Re-hook every 30–60 s: a gate into another time, the red waking, a rise until the place becomes a map. 30 fps, the style's own.
- **The first 10 seconds.** The high wide with the red in it first; the question by 5 s; the promise by 10 s, carved into the sky. A channel sting (a seal pressed) comes after that.
- **Captions.** The subtitle bar burned in, plus an `.srt`.
- **Thumbnail.** The high wide with three layers and the red, up to three words cut into the sky.

### Good for

Journeys and routes, wildlife and conservation counts, landscapes, rivers from source to sea, a place across the years.

## 1. Essence, and what it is not

- **Only ink, paper and one red.** Every value is either ink or paper; grey exists only as a density of lines. One red is reserved for one small subject. A warm yellow may appear for the sun, a lamp or one material, never as a second accent.
- **Tone is cut, not shaded.** Shadow sides of hills carry knife lines that run down the fall line; skies are parallel horizontal cuts whose width makes the light; snow is paper with a few drift strokes; water is ink with cut ripples.
- **Real depth, flat marks.** The scene is built in 3D (terrain, rivers, thousands of trees, buildings), but every surface is drawn with flat marks fixed in world space, so the layers slide past each other like a printed diorama.
- **At least three layers in every held frame:** sky / a mountain or forest band / a middle ground of fields, water or snow / a foreground of branches, fences or posts. Ink and paper roughly half and half. A pass through steam or a structure is exempt for its half second; an opening inside one material (a cloud, the dark) finds its layers in that material (near wisps rushing past, the body, a gap to what lies beyond) within about a second.
- **One continuous move** carries the story; cuts are rare and designed.

Not woodcut (flat printed blocks, a mostly static camera, one block per image). Not ukiyo-e (flat colour fields, no depth travel). Not a toon-shaded 3D game (no smooth shading, no gradients, no specular). Not a pencil sketch (no hatching that follows form loosely; every line is a knife cut with a blunt entry and a tapered exit).

## 2. Materials & rendering

- **Render model:** three.js scene at 2× supersampling, box-filtered down in a final print pass. Every material is a small shader that decides "ink or paper" per pixel; there is no lighting except one direction used to choose lit and shadow faces.
- **Two kinds of field.** Every surface is either a paper field carrying ink cuts (lit faces, snow, sand, cloud, foam, steam) or an ink field carrying paper cuts (shadow faces, sky, water, forest, night). A cloud is paper with a few horizontal ink cuts on its underside, not a reversed sky as densely cut. Tone inside a field comes only from the width and density of the cuts.
- **Faceted terrain:** mountains and volcanoes are low-poly cones with flat facets. Lit facets are paper with a few fine ink cuts near the terminator; shadow facets are ink with paper cuts running down the slope. Cut spacing is fixed in world units so lines never swim when the camera moves.
- **Sky in direction space:** a sphere that travels with the camera; cuts are rows of constant elevation, so they stay horizontal and never slide with translation. Night = sparse wavy wind cuts and square stab stars; day = dense parallel cuts, thicker near the horizon. Words in the sky are plates hung in the same direction space.
- **Billboard atlases drawn on canvas:** trees (pines, frosted deciduous trees), animals, steam. Cylindrical billboards for anything standing, spherical with a screen rotation for anything flying. Sample the atlas with a negative mip bias and alpha-test so thin shapes survive at distance.
- **Water** is a ribbon cut into the snow (the ground is discarded inside a river mask), with bank walls and a paper snow lip. Ripples are short cuts across the flow, faded to solid ink where they would turn grey with distance.
- **Print pass (screen space):** paper fibre, ink mottling in the darks, soft grey blotches near the top of the sheet, a two-frame flicker, a light vignette. Nothing else lives in screen space except transitions made of paper (a whiteout, a sheet being peeled).
- **Props with words** (plates, boards, notices) are canvases on meshes: carved letters in paper on an ink ground, or ink on a pasted paper label. They sit at a 3/4 angle with thickness, a snow cap or a rim.

## 3. Colour logic

- Two values carry everything: ink (a warm black) and paper (a warm off-white). Never pure black or pure white, never a third grey fill.
- **One red, reserved for one subject**, kept small (a crown, a lamp, a flag) and never smaller than about 3 px at 1080p (about 4 px in a reel); enlarge it a little rather than lose it. It may carry into the subject's own trace (its ripple, its trail), never onto another object. A flat stab: no outline, highlight or gradient, a thin paper ring only where it sits on ink. When the take follows the red through steam or a whiteout, the red stays on top of the paper.
- A warm yellow is allowed for light itself (sun disc, its road on water, warm cuts in a dawn sky, a lamp) and one material at most. It never fills a large area except that one material.
- Value order by depth: far mountains paper with ink shadow facets; forest bands solid ink; the middle ground paper; foreground ink silhouettes. Keep the subject on the opposite value of what lies behind it.
- Example palette: ink `#16171b`, paper `#ede5cd`, red `#c4332b`, yellow `#dfa443`.

## 4. Type & subtitles

- One serif typeface, bold (e.g. Noto Serif, OFL), subset to the characters used. One language, the one spoken.
- **Type lives in the world:** carved into a board, cast on a plate, printed on a pasted notice, or cut as a plate of type into the sky. Words in the world carry only keywords and numbers; no centred title cards, no headers.
- Sizes at 1080p: at most three sizes per frame; nothing smaller than 22 px (about 36 px in a reel); every word at least 5 % inside the frame. Left-aligned blocks, aligned by optical edge.
- Words appear the way the medium makes them: cut left to right with chips at the knife, pressed by a seal, revealed under a peeled sheet.
- Reading time: hold every piece ≥ max(1.8 s, characters ÷ 15 + 1.5 s); judged comparisons hold still ≥ 2.5 s before the verdict lands.

### Narration & subtitles

When the video tells a story with a narrator:

- **Speech and picture move together.** Each line is spoken while the shot shows what it names; the long take keeps going under the voice, and the silent stretches (a hold to read, a pass through a structure, a flock taking off) are left without words.
- **Words in the world carry only keywords and numbers** (a count on a board, a date on a seal). The sentence is in the voice and the subtitle, not on the props.
- **One subtitle bar per spoken line**, at the bottom inside the 5 % safe area: one line in 16:9 (two at most in a reel), never wrapped mid-phrase, in the video's serif, paper letters on an ink band about 80 % opaque (thinner bands vanish over paper). It appears with the line and leaves with it; keep the subject of each shot above it.
- A second-language version swaps the voice and the bar's words only: the same picture, each line starting at the same moment, finished before the next one starts.

## 5. Motion quality

- **Output 30 fps**, in both formats. The camera and the world move on every output frame. Separately, the print pass steps its paper flicker and blotches at 12 Hz inside the shader (`floor(t*12)/12`), whatever the output rate, so the image breathes like a worn sheet.
- Easing: long monotone curves; the camera keeps momentum through key positions and decelerates into every hold. No bounce, no shake except one frame for an impact.
- Animals are flat silhouettes with three or four poses per action (sleep, wake, call, peck, walk, run, three wing frames, land, leap, bow). Wings cycle on fixed frames; never morph between poses.
- Steam, snow and splashes are paper marks: horizontal cut wisps, square stabs, short arcs.
- Mountains, horizon and sky texture never move; trees never sway.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| High wide establishing frame, sinking and pushing | the whole place at once; the layers separate as it moves | a valley; a coastline; a city seen from its hills |
| Low glide over water or snow | speed, intimacy with the ground; foreground marks rush past | a river journey; a road; a migration |
| Hold on a prop with words, long lens | reading time inside the take | a sign; a plaque; a gauge; a date |
| Pass through a structure (bridge, gate, arch, tunnel) | a threshold, a change of time or light | night to day; outside to inside; then to now |
| Locked frame | a document, a comparison, a count | the same place in four years; before and after |
| Rise and pull back to the opening angle | the place again, changed | a return; a conclusion; an epilogue |
| Follow a flying or falling subject | the subject leads the camera to the next place | birds, a kite, a leaf, a paper plane |

Framing: the horizon sits on a third; the subject is never smaller than 1/20 of the frame height when it must be recognised; words stay inside the frame with a margin of 5 % and never cross another object. Allowed transitions: through a structure, through steam or snow (under half a second of white paper), a match on a falling or rising subject, a sheet peeled from the corner, a seal. Forbidden: fades to black, cross-dissolves, slides, page flips, zoom cuts.

Fitting the high wide to the terrain (options, not a recipe). The sky is in frame only while the camera's pitch plus half its vertical field of view stays above the horizon, so a steep look down at a valley right below loses the sky (a portrait frame's taller field of view helps). Ways round it: stand the camera farther back and higher on a longer lens, so the subject sits at a shallower angle below the horizon; take the printmaker's licence and stretch horizontal distances or compress heights, since each layer is a plane; break a far plane that fills the frame (a sea, a plain) into bands with headlands, islands, boats or tiers of cut density. When the sky is out of frame and words are needed, carve them into something in the world that faces the lens (rock, board, hull, a mark on the water), let the take tilt up into a hold where the sky returns, or keep the words for a later shot where the sky is in frame.

## 7. Sound palette

- Three layers. **The world:** the matter of the place (water under ice, frost cracking, wind in three weights, wings, steps on snow, small animal sounds). **The print:** knife through paper or wood, a block's thump, a sheet torn away, a seal pressed; used only on transitions and verdicts, never as a bed. **Music:** a small chamber group of real samples.
- Timbres that suit the medium: bowed vibraphone, harp, horn, low strings, pizzicato bass, xylophone, glockenspiel, timpani. Avoid synth pads and drum kits.
- A three-beat or slow pulse that can stop; silence before a verdict, then one heavy low stroke.
- A narrator, when there is one (one calm voice, unhurried), sits on top: music ducks about 17 dB under speech and comes back up in the silent stretches; foley ducks about 7 dB.
- Animal calls are recordings with a CC0 or CC BY licence or are synthesised; never CC BY-NC.
- Mix: music sits under the world; the print sounds are the loudest events. Mix with headroom (about −16 LUFS integrated, true peak under −3 dBTP), then master to −14 LUFS.

## 8. Native moves

- **The sky carved open.** The sky is cut from the horizon up, one row at a time, the newest row still running across; dawn as a carving, not a gradient. *Fits content like:* a factory's first shift; the first day after a war; a city's lights coming on in reverse at dawn.
- **One red waking.** In a field of ink and paper, the single red appears point by point (heads lifting, windows lighting, flags raised) across the frame. *Fits content like:* poppies opening on a hillside; lanterns along a river; the first lit windows of a rebuilt street.
- **Through the steam.** The take passes through a cloud of paper cuts that eats the frame for under half a second; the world on the other side is a different scale or place. *Fits content like:* a ship into fog and out at a harbour; a train through a tunnel's smoke; a balloon through cloud.
- **The same place printed again.** A locked frame of one place; the top sheet peels from the corner to show the next year's print beneath, with ink that has not quite taken. *Fits content like:* a coastline retreating; a forest replanted; a village growing into a town.
- **Words cut into the world.** A count or a date carved into a board, cast in a plate or stamped by a seal while the camera holds. *Fits content like:* a flood mark on a wall; a ship's name on the hull; a record on a mountain hut.
- **A plate of type in the sky.** The title or the sign-off is cut into the sky as an ink block with paper letters, part of the same direction-space sky. *Fits content like:* a title over a skyline; chapter names over a sea; a dedication over a valley.

## 9. Pitfalls of the medium

- **Close-ups expose the flat shading.** 3D props pushed close to the lens look like toys. Keep living subjects to mid shot as flat silhouettes; give close props real materials (carved wood, concrete formwork, cast iron).
- **Empty paper.** A field of snow without layers goes blank. Keep three layers in frame; add drift strokes, reed ticks, thickets, belts.
- **Grey sludge.** Fine cuts at distance average to grey; fade them to solid ink or paper with distance and use negative mip bias for thin sprites.
- **Sliding lines.** Any cut spaced in screen space swims as the camera moves; anchor cuts to world space (or direction space for the sky).
- **The road look.** A dark river with a pale bank lip and regular dashes reads as asphalt. Break the rhythm of bank marks and keep the lip narrow.
- **Small subjects vanish.** Real-scale animals disappear in a wide frame; draw distant ones up to 3× larger (a printmaker's scale), keep the red at its minimum size.
- **Camera through solids.** Clear trees and posts from the camera path before placing scenery; check every low pass frame by frame. The same holds for every small scatter (reeds, stones, fence posts, grass): one within a metre or two of the lens fills the frame with ink. Sample the camera path and clear every instance inside a radius of it, give near sprites a dithered fade, then step stills through the low passes every 0.1 s, lay them on a contact sheet, and look for frames that are nearly all ink or all paper.
- **Empty paper close up.** A lit facet near the lens becomes a blank sheet. Make facets smaller near the camera path and give near lit faces their few ink cuts, grit or tufts.
- **Words on a moving take.** A check that only asks whether a word is in frame counts the first stretch it is fully visible and knows nothing of occlusion or size. Count each word as read only inside its planned hold, when it is in frame, unobstructed and large enough to read; ease the camera into a hold or slow the clock for it.
- **Too many greys from post.** Vignette and blotches darken the paper and make the print look dirty; keep them light.
- **Words under the app's buttons.** In a reel, a board that drifts below y 1248 or right of x 900 during its hold is unread; plan the hold's camera key so the word lands inside the safe box.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **three.js, drawn from `t`, through one print pass.** Render the scene at 2× into a render target and box-filter it down in a final print shader: paper fibre, ink mottling in the darks, top blotches, the 12 Hz flicker (`floor(t*12)/12`), a light vignette. The same pass carries the paper transitions: a steam whiteout amount; a peel that reveals a second render target (the next year's print) under a sheet curling from the corner; a "fresh ink" amount for ink not quite taken; and the subtitle canvas, laid on last. A whiteout normally eats the red too (a cut); when the take follows the red through it, mask the red out of the whiteout. A clock warp that slows one stretch of time must move the words' holds, the events and the subtitles with it.
- **A small set of ink-or-paper materials** sharing the inks and a few uniforms (the one light direction, warm, sun, camera position): a carve material for any faceted solid (fall-line cuts from the face normal: mountains, cliffs, rocks, dunes, roofs); a sky material (rows of constant elevation, a front that carves the dawn upward, a density for day, stab stars, and two type plates placed by azimuth and elevation in radians with a reveal amount; below the horizon it draws paper); a billboard material with distance fade and an optional warm tint; and simple toon, wood, concrete, ink, paper and hull materials. Wood and concrete written for a winter valley paint top faces as snow and carry a frozen splash band: change both for a dry or snowless place.
- **World pieces**: canvas textures with mips; instanced billboards (pivot at the bottom for anything standing) filled from a list of position, size, atlas tile and rotation; a faceted cone generator (centre, height, radius, seed, crater) for headlands and volcanoes. Everything drawn on canvas (trees, animals, mist, sun, moon, carved type for sky plates and boards) uses one knife-stroke function, so canvas marks match the shader cuts. Keep the red at a minimum pixel size as a point sprite (`gl_PointSize = max(px, uMin)`). A river material needs along/across coordinates, so it draws a channel, not a sea; a sea or lake is its own material in world `xz`, with cuts along the wave crests.
- **What each topic writes itself**: the ground and terrain (a heightfield or faceted meshes under the carve material), its water, its subject and scatter atlases, its red mark, its props with words, the world, the camera keys and the list of words with their holds. A workable order: a style frame of terrain and sky through the print pass, then the subject and its red, then the camera path, then clearing and near-lens checks, then words. Minimal example: a lighthouse on a headland at night, a faceted cone (height 120, radius 400) under the carve material, a cylinder under the concrete material without its snow and ice lines, one red lamp as a minimum-size point, a new sea material (ink, paper cuts along the swell, fading to solid ink with distance), the sky with its dawn front rising.
- **Rules for a new material** (the look depends on them): choose its field first (§2), paper with ink cuts or ink with paper cuts. Cuts follow the matter: down the fall line on slopes, horizontal in sky, cloud and still water, across the flow in running water, along the crests for waves, along the grain or course for wood and stone, along drifts or furrows on flat ground. Spacing is in metres (or radians for the sky), anchored to world or object coordinates; moving matter may slide along its own coordinate with time. The light chooses lit or shadow per face with a threshold; no gradient inside a face. Fade with distance: once a quarter of a row or more passes in one pixel (`fwidth` of the row coordinate), let the cuts go to the field's value (`k *= 1. - smoothstep(.25, .7, aa)`). Flat ground carries sparse, irregular marks; a regular rhythm reads as a road or a grid. The red never enters a material; it is its own mark on top (§3), and the yellow only for light or the one material.
- **Timing and cues**: camera keys come from the voice's word timings (the take arrives at a prop as the line names it, and decelerates into the hold). Cues in `cues.json`: each pass through steam or a structure, each carved word, each seal or block, the peel, the low stroke after the silence; the world's ambience runs as a bed under them.

## 11. Variation space

The agent decides the place, the subject that gets the red, the route of the take, where the cuts fall, the words and where they are carved, the pacing and the score.

- **Three structures:** a river followed from source to sea in one take, with the dates carved on bridges; a street at night, one window lit per year, ending on the full street; a mountain hut's logbook, each page a different season of the same view.
- **Three openings:** a single red lamp in a field of cut-ink water that turns out to be a ship far out at sea; a close cut of frost on a window that the camera passes through into the valley; a title cut into a night sky over a harbour.
- **Three endings:** the camera rises until the place becomes a printed map; a final seal pressed onto the scene itself; the sheet peeled away to show blank paper with the first line of the next story cut in.
