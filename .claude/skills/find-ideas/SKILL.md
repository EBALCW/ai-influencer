---
name: find-ideas
description: "Find what to make next: proven reels to adapt, outliers in a niche, saved inspiration and the creator's own results. Use before scripting, when asked what to post, to judge whether a reference is proven, or to turn saved reels into a short list of ideas."
---

# Find ideas

> **Bu projede (ai-influencer):** FavStash servisi kullanılmaz; kaydedilmiş içerik ve analitik için ona bağlanma. Bu skill'in "kanıtlanmış = kendi kanalının medyanının en az 3 katı izlenme" kuralı, `anlatim-videosu` akışının konu önerisi adımında kullanılır (bkz. `.claude/skills/anlatim-videosu/SKILL.md`). Kaynak ve yapılan değişiklikler: `.claude/skills/edit-video/KAYNAK.md`.

Start every reel from evidence: a reference that already worked for someone with a
similar audience, or a result from the creator's own posts. The output is a short
list of ideas, each with its reference, why it's worth copying and the angle that's
true for this creator. Hand the chosen one to `write-script`.

## Where ideas come from

- **References the creator supplies:** a reel URL, a saved post or a screen recording.
- **The creator's saved inspiration:** links, transcripts and notes the creator has
  already collected. Read the saved transcript and on-screen text instead of guessing them.
- **Niches and competitors:** recent posts from creators the audience already follows.
  Compare each post with that creator's own baseline, not with other accounts.
- **The creator's results:** from their own channel statistics, their own outliers and their
  weakest openings are the best guide to the next test.

Work from supplied URLs, transcripts and public view counts.

## Is the reference proven?

Call a reference **proven** only against its own creator's baseline: views at least
3× the median of a comparable recent sample of their posts. Record the views,
publish date, capture date and sample size. Without a baseline it is a **format
reference**: useful for structure, not proof that the hook works.

- A high comment count on a comment-to-DM post shows the gate converted, not that
  the hook earned reach.
- Performance shows association. Topic, timing and distribution stay confounded.
- Saved content is taste and structure, never factual proof for the creator's claims.

## What to record for each idea

```text
Idea: one line, in the viewer's words
Reference: URL, creator, views vs their median (proven | format | original)
Why it worked: the hook lever, the first frame, the payoff
True for this creator: what they can honestly say or show; what must change
Proof available: footage, screen capture, real numbers (or what's missing)
```

Look at the reference itself when the treatment matters: the first frame, the cuts,
the captions and where sounds land. A transcript alone doesn't show the edit;
`edit-video`'s reference helper samples frames from a URL into an analysis copy.

Give the creator three to five ideas, strongest first, and say which one you'd make.
Rights don't transfer with an idea: adapt the hook, structure and pacing, and make
the video from the creator's own footage.
