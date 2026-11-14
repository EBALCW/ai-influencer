# Desktop Flythrough

> App screens and tools lie on a sunlit desk as printed paper cards; small pixel characters, popped up into voxel toys, carry the work from card to card, while one unbroken camera flies after them, whips between stops and finally pulls back over the whole desk. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): one-take desktop tours in software launch videos (windows laid flat as places, a small helper as the guide); macro toy photography (low warm sun, long soft shadows); pixel-art sprites (the cast's look). Never copy their characters, layouts, icons or music.

## Formats

### Reel (1080×1920)

- **Layout.** The desk and its props bleed to every edge. Lay the stops out along the depth of the desk (a column or a zigzag away from the lens), so the tall frame sees the route recede and the closing wide fills at least 70 % of its height. The vertical view offset keeps the subject around y 640, the upper middle of the safe box (x 72–900, y 269–1248); text meant to be read (badges, screens, tent cards) is framed between y 300 and 1100; the subtitle bar is centred on x 540, at most 720 px wide, its baseline near y 1190. Stack, don't shrink: whips run along the route or crane over it rather than pan sideways; a slow-against-fast comparison puts one half of the desk near, the other far.
- **The first 3 seconds.** Frame 1 is a macro glide over a pixel sticker lying on a phone card in low sun, its long shadow already across the print. By 0.5 s it pops into a voxel toy on a 16th; by 3 s it hops off the card and the camera whips after it towards the next stop: the journey has begun.
- **Length and pace.** 25–45 s at 30 fps in one take, 110–130 BPM. Three or four stops, 6–10 s each, whips of 0.3–0.5 s, a closing pull-back of about 4 s. No dead hold over 1.5 s.
- **Captions.** The quiet ink bar, one line in the spoken language, bold sans at about 44 px; in-world text stays keywords and numbers.
- **Sound.** `ui-pop` on each sticker pop, `tick` on hops, `thock` on landings and slams, `typing-tick` as UI types itself, `clean-ding` on a delivered notification, `zoom-swish` on whips, sized by camera speed. The marimba score and the press's crumble come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** The body as written, but raise the subtitle bar's bottom edge above y 950 (the player's controls cover the bottom 12 %) and the vertical view offset to about 150 px. Tent cards, step pills and the closing title stay inside the 5 % margins.
- **Length and structure.** 2–5 min at 30 fps. A chapter is one stop or one tool; its title card is a paper tent card standing beside the next stop, or a step badge with its digit and one word. Between chapters the camera pulls back over the desk to show the route so far, then whips to the next stop: that change of scale is the re-hook, with a new pop, messenger or data run every 30–60 s.
- **The first 10 seconds.** The whole desk alive first, every stop hopping once; by 5 s the camera falls onto the first card and the question (how does this get from here to there?); by 10 s the promise, the route lighting across the desk in the accent. Any channel sting after that.
- **Captions.** The subtitle bar burned in, plus an `.srt`.
- **Thumbnail.** A macro frame of the hero toy mid-hop over a phone card in low sun, its long shadow across the print; at most three words on a standing tent card.

### Good for

App explainers, workflow and integration tours, "how it works" pieces, onboarding, data-flow explainers, YouTube product walkthroughs.

## 1. Essence, and what it is not

- **The desk is the world.** A matte paper mat with a regular dot grid lies on a light wooden desk, lit by one low warm sun through a window. Everything sits on it and casts a long, soft shadow. A few everyday desk things (a pen, sticky notes, a mug, earbuds) sit around the edges as foreground and background layers.
- **Interfaces are paper cards.** Phones, tools and dashboards are rounded slabs a few millimetres thick with the interface printed on top. They are places: characters stand and hop on them, and parts of the interface rise out of them as small 3D objects.
- **The cast are pixel sprites made solid.** One bevelled cube per pixel, thicker inside than at the edge, eyes standing proud. They lie on a card as flat stickers and pop up into toys; they blink, wait on the beat, get squashed and spring back.
- **Every stop is busy.** At each station something small moves besides the main action: debris bursts, data cubes hop, a lamp blinks, marks vibrate.
- **One take.** No cuts. The camera glides, orbits, cranes and whips between stops; it closes on the whole desk.
- **Everything lands on the beat.** Hops, pops, ticks and slams sit on the 16th-note grid of one steady tempo, and every action has a sound.

Not **Living Screencast** (no cursor, no glowing monitor, no real app chrome or logos); not **Brick Toy** or a clay toy video (pixel voxels on printed paper); not **Isometric Infographic** (perspective camera, real light); not flat motion graphics (everything has thickness and a shadow).

## 2. Materials & rendering

- three.js, physically based, neutral tone mapping. Scale: a card is 0.3–0.7 units wide (1000 canvas px per unit); dots 0.03 apart. A character must be big enough to show its eyes: about 1/5–1/3 of the card it stands on (0.006–0.0075 units per pixel, so a 16-pixel sprite is about 0.1 wide); smaller casts lose their faces in a medium shot. A character may be scaled for a moment when the story needs it; it reads best on a beat, with a pop's overshoot.
- **Light**: one directional sun low from the back-left (about 20° up, so a toy's shadow is two or three times its height), a 4096 soft shadow map that follows the camera target and resizes with distance; a cool-sky / warm-ground hemisphere fill, so shadows read blue and lit faces warm; a faint room environment for highlights; exponential fog thinned as the camera pulls back.
- **Desk**: a dotted paper mat (a thin rounded slab whose size is a multiple of two dot spacings, so the printed dots line up with any 3D dots) on a procedural light-oak plane (planks, long soft grain). Soft window-light patches (blurred four-pane shapes, warm, additive, low opacity) lie under the cards. Props are plain primitives in matte or satin materials, placed so each close shot has something soft in front of or behind its subject.
- **Cards and screens**: a rounded slab plus a canvas texture on top with a faint deterministic grain. Print is flat: one ink, mono labels in spaced caps, bold numerals, thin rules; a card head carries two lines (a mono-caps label over a bold name). A phone is a card with a dark bezel and a whole interface of whatever app the story needs: a status bar, a header that names the screen, content filling the screen, controls at the bottom. Redraw a canvas only when its state changes; quantise continuous changes.
- **Voxel cast**: instanced bevelled cubes per pixel; depth grows with distance from the silhouette; pure-black pixels are eyes, which protrude and blink (they take the colour of the pixel above). Rig: root (feet, yaw) → hinge (lying flat ↔ standing) → squash (scaled at the feet) → spin. State: extrusion (0 flat sticker … 1 full toy), hinge, squash. The same picture at half resolution is the same character, smaller and chunkier.
- **Props**: the same voxel recipe (crosses, ticks, bells) or plain rounded primitives (bricks, presses, drawers, towers, tent cards, stamps). Data that rises out of a card is extruded from its printed shape, so it still reads from above.
- **Impact ring**: a thin accent-coloured ring spreads over the paper from an impact and fades in about a second.
- **Post, per frame**: 16–24 sub-frames with Halton sub-pixel jitter (anti-aliasing, and a little motion blur on fast moves) → depth of field on each sub-frame, behind the focus plane only → bloom on highlights only → grade (light vignette, slight warmth, a little contrast and saturation). Subtitles are DOM on top.

## 3. Colour logic

- **One light ground** (the mat) with a slightly darker dot, cool-tinted so the warm sun leaves it fresh; a warm wooden desk around it; cards in a near-white of the same temperature; **one dark ink** for print; **one accent reserved for what matters now**: the route, the current step's badge, the send button, the lit window, the key word.
- Two or three support hues for the cast and props, mid-saturated, never neon; one warm cast colour against the cool ground. **Red only for failure or trouble** (an error, a weak signal), **green only for success**; data in motion may take one bright support hue so it reads apart from the route.
- Judge the rendered frame: avoid grey on grey; keep the vignette light and the shadows tinted by the sky fill.
- Brand use: the brand colour becomes the accent; the brand's interface colours print on the cards; the ground stays light.
- Two example palettes (starting points, not a menu; the names are the keys of the one palette that cards, mat, dots and route all read):
  - *Lilac and violet* (creative tools, music, learning): paper `#e7e4f3`, dot `#cbc5e2`, card `#fcfbff`, ink `#1d1a2e`, mute `#807a96`, line `#e2dfee`, accent `#6b4ce6`; support apricot `#f39a5b`, sky `#5fb4e8`, lemon `#f2c94c`; red `#e2483d`, green `#3fa57a`; haze `#e8e4e6`.
  - *Cool grey and amber* (money, logistics, energy, food): paper `#e5e9ed`, dot `#c8cfd7`, card `#fdfdfc`, ink `#20252b`, mute `#7f8790`, line `#e0e4e8`, accent `#e8890c`; support teal-blue `#2f8fb0`, plum `#8a5a9e`, cream `#f4e3b5`; red `#d23a3a` (keep it clearly apart from the amber), green `#3c9c6e`; haze `#e6e4e1`.

## 4. Type & subtitles

- **In the world, only keywords and numbers**: step badges (a camera-facing accent pill with a digit and one word), sizes, a name on a screen, a banner, a title card. Text meant to be read is framed above the subtitle area, held still for its reading time, and large enough at the angle it is seen: flat print reads from 55–70° down; a low camera reads a standing tent card.
- **Titles are objects on the desk**: an opening tent card beside the first stop; at the end a large paper card dropped onto open desk in the final frame. Where depends on the layout: wherever it covers no station, route or character and sits clear of the subtitle bar (a row of stops may leave the middle free; a zigzag layout may leave the front edge). Leave that space when laying out the desk.
- Every face on screen comes from the video's own font files (cards, pills, subtitles), never a system face.
- Three roles: a mono for labels and numbers (spaced caps), a sans with a heavy weight for pills, titles and subtitles, and, when the spoken language is not in Latin script, a face for that script that both fall back to. The families are free (e.g. DM Mono or JetBrains Mono, Manrope or Space Grotesk, the Noto Sans of the video's language); the roles are not. Pixels belong to the cast, so no pixel font on the print.

### Voice-over and subtitles

- When the video explains something, a voice tells it: short spoken lines, one idea each; the picture shows what the voice is saying at that moment, and the words on cards are only the keywords of the line.
- **One subtitle cue per spoken line**, in a quiet bar at the bottom centre (a rounded ink box at about 72 % opacity, about 64 px above the frame edge in 16:9 before the YouTube lift): the spoken line in bold, about 40 px, at most about ten words, never wrapped. The cue appears with the line and leaves with it.
- The camera keeps its subject about 110 px above centre (a fixed vertical view offset), so nothing that matters sits under the bar.
- A version voiced in another language starts each line on the same second, so picture, subtitles and timing do not change.

## 5. Motion quality

- 30 fps. One steady tempo (110–130 BPM); every action on the 16th grid, big moments on downbeats.
- **Hops**: an arc with squash and stretch (stretch about 14 % in the air, squash about 30 % for 0.2 s on landing, a small anticipation squash before take-off). Groups move follow-the-leader, each a 16th behind the one ahead, so they never close up.
- **Characters act**: they blink every couple of seconds, bounce on the beat while they wait, squint when they are squashed, lean towards what they look at.
- **Pop**: sticker → toy in 0.25–0.5 s (hinge up with overshoot, cells extrude from the centre, a small jump, squash on landing). **Reverse pop**: toy → sticker or print when it is stored, delivered or taped down.
- **Slam**: drops from above with ease-in, lands on a downbeat, squashes, jolts the card, sends out a ring.
- **UI comes alive in sequence**: digits, bars, ticks, typed characters appear on 16ths with an overshooting ease.
- Idle is a small bounce or a blink, never a dead hold of more than about 1.5 s. Paper and cards never move except for a jolt or a curtain-call hop.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| Macro glide with a slow orbit (close, 20–45° down) | being there, small scale | a character at work; one detail of an interface; a title standing on the desk |
| Whip from card to card (0.3–0.5 s, banking into the turn) | the next step, cause → effect | a process moving on; a hand-off between tools |
| Rise to near top-down (55–70° down) | reading, one card as a whole | a screen, a counter, a table; any verdict |
| Ride along, low behind the subject | travel, momentum, pursuit | a route; a delivery; a download |
| Pull back over the desk | the whole system, scale | a recap; the route so far; many stations at once |
| Hold with a shake | impact | a press, a stamp, a ring |

- One take, no cuts, no dissolves. Targets are live subjects; between keys the target follows a Hermite path with live end points; drift is a breath, not a handheld wobble.
- At a key where a whip starts, the target rests first (or the camera stutters). A character's take-off is the natural start of a whip. A whip between far-apart stops arcs up mid-way so the stops in between stay in frame.
- Wide shots frame the stations to fill at least 70 % of the frame width. **The video closes on the whole desk**: every stop and the route in one frame, everything moving once, the title landing in open space.

## 7. Sound palette

- **Score**: bright and warm, acoustic in feel: marimba (with vibraphone under long notes), plucked bass, a soft synthetic kick (a short sine sweep), claps, shaker, a quiet string pad. One key, diatonic chords, about one chord per bar. Under a voice the score is a light bed ducked about 16 dB while someone speaks; the full mallet theme plays where nobody speaks.
- **Foley**: every action has a sound. Pop: a marimba note from the current chord plus an upward sweep. Hop: a soft tick. Landing: a felt thump. Press or stamp: a low thump with a crumble. Typing: dry key clicks. Ding: two bell notes from the chord. Camera whip: a whoosh sized by the measured camera speed. Pitched foley takes its notes from the score's chord table and sits on the 16th grid.
- **Mix**: the voice leads (one warm narrator, unhurried; about −16 LUFS before delivery); music 15–18 dB under the voice and lifted in the gaps; foley under the voice; the mix peaks under −1.5 dBFS and is mastered to −14 LUFS, true peak −1.2 dBTP. The final chord holds to the last half-second.

## 8. Native moves

- **Sticker pop.** A flat pixel sticker on a card stands up and extrudes into a toy on a 16th. *Fits content like:* a new user, file or job appearing; a feature switched on; an order placed.
- **Reverse pop.** A toy lies back down into a sticker or a print. *Fits content like:* a photo delivered into a chat; a snapshot saved; a task archived.
- **Press.** A heavy plate drops on a toy; pixel debris bursts out and rolls away; the same character pops out at half resolution beside a counter that runs down. *Fits content like:* compression; a budget cut; a summary of a long report.
- **Drawer.** A slab of a stacked tower slides open, a toy hops in, it closes and one window lights; small data cubes hop into the windows. *Fits content like:* storing something in the cloud; a queue; an archive.
- **Messenger.** A small voxel object (a bell, an envelope) flies an arc between two cards leaving a dotted trail, taps the target twice, and a banner drops on its screen. *Fits content like:* a notification; a hand-off; an alert.
- **Data run.** A stream of small bright cubes runs along the route between two stations. *Fits content like:* a download; a sync; a payment going through.
- **Blurry, then sharp.** A picture on a screen card is printed blurred, then snaps sharp as the toy lands in it. *Fits content like:* loading; focus; a draft becoming final.
- **UI rises.** Part of the printed interface grows into 3D out of its printed shape. *Fits content like:* progress; a metric climbing; a step badge.
- **Curtain call.** The closing pull-back frames every stop; each hops once, left to right, the characters pop back up, and a title card drops into open space. *Fits content like:* a recap; a team; a pipeline shown whole.

## 9. Pitfalls of the medium

- **Softness**: depth of field and motion blur easily turn a subject or its words to mush. Blur only what lies behind a focus plane set a little beyond the subject, lightly (≤ 5 px), never anything in front; let the shutter shrink with camera speed so a streak never exceeds about 8 px; draw card and screen canvases at 3–3.4× (pills at 3×) so print stays crisp when a card fills the frame; no CSS or canvas blur on anything meant to be read.
- **Flat print read at a low angle**: text on a card seen from 20° is unreadable. Rise to 55–70° to read a card; put text the low camera must read on a standing object.
- **A standing toy hides the row behind it**: place characters beside or behind the text being read, or off the card, and check every reading frame for overlap.
- **Text under the subtitle bar or cut at the frame edge**: keep the fixed vertical offset; show name plates and labels only in the shots that frame them whole; take camera-facing pills away before the camera moves on.
- **Screens that read as blank**: a phone card without a whole interface reads as an empty white slab in close-up.
- **Shadows of floating labels**: with the sun at 20°, a pill a few centimetres up throws a long shadow across the card and greys out its print. Labels and pills cast no shadow (turn shadow casting off on them); a real floating object (a bell) may, but no shadow falls across text being read.
- **Characters lost in the wide**: on screen a character is about `width × frame height / (2 · dist · tan(fov / 2))` px wide (fov vertical). In the closing wide view keep every character at least about 35 px wide; otherwise frame closer, bring it forward, or scale it up for the curtain call.
- **Voxels seen edge-on**: a standing sprite seen from far to the side reads as stripes and its eyes vanish; turn it towards the camera for its key moments, and give a large picture-like sprite a thinner depth factor (0.6–0.9).
- **Whips over bare paper**: a fast move between far-apart cards crosses empty desk; arc it up so the stops in between pass through frame.
- **Dead stations**: a stop where only the main action happens looks static; give it one or two small moving things that do not compete with what the voice says.
- **Bars and ticks seen from above**: upright 3D bars and standing checkmarks turn into blobs in a top-down view; extrude them along the card or lay them flat.
- **Interpenetration**: characters at the same depth overlap; followers move one 16th apart; a knocked-flat pile goes back to sticker thickness before it stacks; check props against card edges, gates and drawers.
- **Ripples as pegs**: lifted 3D dots read as pegs from above; use a flat expanding ring.
- **Slow renders**: canvas redraws on every sub-frame; redraw on state change only.
- **A score made of fragments**: write whole phrases and put the accents on top.
- **Phone-sized print**: in a reel, a card's labels read at phone size only when the card fills most of the frame width; rise and push in for every reading moment.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js (r170 works) with Canvas 2D textures, the whole frame drawn from `t`; three.js can be vendored next to the page and imported through an import map, as the pack's 3d-character style does. Space: 1 unit = 1000 canvas px; the mat's top is y = 0 and its size a multiple of 0.06 (two dot spacings); a card's top sits at its thickness; card print reads upright from the +z side, the canvas top pointing to −z.
- Cards are rounded-box slabs with a canvas texture drawn at 3–3.4× (pills at 3×), redrawn only when their state changes. One palette object feeds cards, mat, dots and route. Camera-facing pills turn to the camera every frame and cast no shadow. Preload every font and glyph the cards and subtitles use, and hold the render until they are ready.
- The voxel cast comes from a pixel grid (row 0 is the top; pure-black cells are eyes) built as instanced bevelled cubes; the rig's root sits at the centre of the feet, and at hinge 0 the sprite lies face up with its head towards −z, so it reads as print. Hops are a time-ordered list of arcs (start, end, from, to, height), each starting where the last ended; evaluating it at `t` gives the position, air state, landings and take-offs that drive squash. Pops and beat bounces add their offsets on top. Beat and bar lengths come from the score's tempo.
- The camera is a list of keys (time, target, distance, azimuth, elevation, fov, vertical offset, an optional rest), where a target is a point or a live subject evaluated at `t`, joined by Hermite paths; shakes are (time, amplitude, decay). Measure the camera's speed each frame: it sizes the whip's whoosh and shrinks the shutter.
- Post per frame: 16–24 Halton-jittered sub-frames, depth of field behind the focus plane only, bloom on highlights, grade; subtitles as DOM on top. Report the world corners of every text meant to be read with its time window, project them, and check each against the subtitle bar and the format's must-read area.
- Lock the voice first and place every action on the 16th grid near its word. One cue per visible event in `cues.json`: pops, hops, landings, presses, typing, dings and whips; pitched foley takes its notes from one chord per bar of the score. A minimal start: a to-do card and a calendar card; a ticket sticker pops on beat 1, blinks, hops to the calendar on beat 3 while the camera whips after it, and drops into a day as a printed tag.

## 11. Variation space

The agent decides for each video: which apps or tools the cards are and how they lie on the desk, the cast (your mascot drawn as pixel art), the route, the props at each stop, the palette within §3, the tempo within §5, the language of the voice.

- **Structures**: one item travels card to card and changes at each stop; the same job on two halves of the desk, slow against fast; one tiny detail that grows out to a desk of many cards.
- **Openings**: a terminal types a command and its cursor becomes a character; the camera falls onto the desk and lands on beat 1; a title tent stands beside the first card while the hero pops up.
- **Endings**: the curtain call over the whole desk; the cast reverse-pops into a saved record; the camera rises until the cards become part of the dot pattern.
