---
name: write-script
description: "Write or critique hooks and scripts for Reels, TikToks and YouTube Shorts from an idea, saved reel or reference. Adapt proven openings, write one opening or several to test plus one shared body in the creator's voice, and hand the editor a filmable brief."
---

# Short-form scripting

> **Bu projede (ai-influencer):** senaryo Türkçe yazılır ve her olgu iki kaynaktan doğrulanır (`anlatim-videosu` bölüm 1); kanca ne kadar sert olursa olsun bu kural geçerlidir. Tercihler dosyası repo dışında: `~/ai-influencer-films/.favstash-studio/preferences.md`. FavStash servisi kullanılmaz. Kaynak ve yapılan değişiklikler: `.claude/skills/edit-video/KAYNAK.md`.

Write for reach first. The first three seconds stop the scroll, the body keeps
the viewer and the ending earns a save, share or comment. Hype, FOMO, reverse
psychology and bold claims are welcome. Truth is the hard line: real numbers,
real names and nothing invented about the creator.

## Start from what exists

- Read the creator's voice and facts before writing: `.favstash-studio/preferences.md`
  when the pack's setup created it, plus any brief or notes. If voice notes are
  missing, learn from transcripts of their recent videos or ask two short
  questions: who the video is for, and how they talk. Never invent the creator's
  background, results, customers, experiences or product capabilities.
- Resolve the angle, the reel's job (reach, saves, comments/leads or a product
  action), platform and length. Default to an Instagram Reel of about 30 seconds.
  Note whether it is spoken to camera or text over footage.
- Get the reference's actual words: a supplied transcript, or an analysis copy from
  `edit-video`'s reference helper. A transcript alone does not show the edit; note
  the first frame, proof and pacing when the visual treatment matters.
- Know how strong the reference is. `find-ideas` decides whether it is **proven**
  (at least 3× its creator's median views) or only a **format reference**, and
  records the evidence. Saved content is taste and structure, not factual proof.

## Lock one viewer

Write, before any hook:

```text
Viewer: [one specific person, sharp enough to think "that's me"]
Wants: [the result, understanding or feeling]
Fears: [the cost, time, risk or shared frustration]
Creator's link: [one true line connecting the creator's experience to theirs]
```

Describe the problem in the viewer's own words, not industry language. A personal
story can connect through recognition instead of advice.

## Write the openings

Write one opening, or several when the creator wants to test hooks. Each opening is
filmed on its own and joins the same body, so every one becomes a separate variant
to post and compare. Two to four is a practical test; more is fine when the
creator wants it.

**The copy rule.** When adapting a proven original, Opening A is its opening,
copied. Keep the words, rhythm, energy, second line and open loop. Change only
what would be false from this creator: their numbers, personal claims, product
names and features this creator's thing does not have. Never reuse the original's
footage, graphics, voice or identity. If the original hook looks weak, say so and
still deliver it as A.

Every extra opening uses a different [hook lever](references/hook-levers.md) and
must be at least as aggressive as A. A calmer variant is a downgrade. For an
original idea, every opening should read as scroll-stopping as a copied hook.

Build each opening as one unit of about five seconds:

1. **Hook:** emotion, not information. One person, something they care about and
   a question they need answered.
2. **Super hook:** a reason to listen, such as a real number, star count, adoption
   figure or checkable attribution.
3. **Open loop:** foreshadow the payoff ("And the crazy part is…"). Test it: does
   the viewer ask "wait, what?" or "wait, why?" within three seconds? Rewrite
   closed openers like "Here's how to…" or "5 tools that…".

Layer the spoken line, first frame, on-screen text and caption so each adds
something different. Verify every number in a hook and keep it. A material caveat
goes in the body or caption, never in the hook. For each opening, record the
spoken words, the first visual or proof and its seam into the shared body. The
openings are production inputs, for example one Trial Reel each, not a shortlist
to collapse into one.

## Write one shared body

Every opening flows into the same body:

- **Click confirmation:** prove the promise immediately with a visible result.
- **Value:** each beat adds something new for the locked viewer.
- **Second conflict:** new information raises the stakes. Escalate; don't just
  delay with "stay tuned".
- **Payoff:** answer what every opening promised.
- **Earned ending:** a CTA only when the reel's job needs one.

Re-hook after every two or three sentences of value: "It gets worse." "But here's
what's insane." "That's not even the best part." A real limitation can become one:
"One catch." A body that states facts in an even tone is a slide, not a wave.

Make it work muted: key claims appear on screen, and every important line has a
real action, capture or clearly labeled illustration. Estimate 2.5–3 spoken words
per second plus pauses. A 15-second reel can be hook, proof and payoff.

For a comment-to-DM gate, gate a free, useful resource such as a repository,
prompt, template or guide, not a bare product link. Use one keyword that names the
resource, say it once at the end and repeat it on the caption's first line.
Offer only automation the creator has set up. A personal reflection can end on a
real question, or on nothing at all; don't force a tutorial or resource into it.

## Attack it once, rewrite once

Review every opening and the shared body with six lenses. Record the one or
two strongest objections for each lens:

| Lens | Asks |
| --- | --- |
| Skeptic | Why would anyone care? What is new? |
| Expert | Is a claim, name, number or version wrong? |
| Scroller | Muted, does it still land? Would the viewer stop at second three? Does each beat add value? Is there a save moment and a share moment? |
| Competitor | Could any creator post this? What only this creator can say? |
| Hater | What will comments call fake, sponsored, obvious or cringe? |
| Editor | What can go without losing meaning? First drafts usually lose 20%. |

Rewrite once to fix the serious objections, then stop. Reviewers make hooks more
scroll-stopping, never calmer; only a factual error changes a copied hook.

Then read it aloud in the creator's voice. Keep their personality: excitement,
humour, swearing and honest uncertainty. Cut empty setup ("Here's the thing",
"let's dive in"), vague promises without a fact behind them and repetition. Hype
words stay when a real fact sits next to them.

## Hand the editor a filmable brief

Save `analysis/reel-brief.md` in the edit run. With `edit-video` installed, its
`new-edit` helper creates the run; otherwise save it beside the footage.

```text
Viewer / promise:
Reference: URL, evidence level (proven with baseline | format reference | original)
Opening A (lever): spoken words only
  First visual / proof / seam:
Further openings (B, C, …): same fields, each with its lever
Shared body: spoken words only, including any CTA
Timing: words and estimated seconds for each opening plus the body
Must keep: approved claims, caveats, keyword, attributions
Proof map: beat → what the viewer must see → source or capture → owner → fallback
Recording notes: each opening as its own take, then the body, then the CTA again
```

Scripting owns the words, promise, proof needs and overall feel. The editor
chooses takes, layouts, style, crops, motion, captions and sound after seeing
the footage, so suggest rather than prescribe shots. Then use `$edit-video` for
the edit. A finished script does not authorize filming
schedules, uploads or publishing.
