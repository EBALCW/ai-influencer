# Voice options

> **Bu projede (ai-influencer):** Türkçe ses için aşağıdaki seçenekler yerine `edge-tts` kullanılır (Kokoro'nun Türkçe sesi yok, ElevenLabs ücretli, Chatterbox birkaç GB model indirir). `.claude/skills/anlatim-videosu/scripts/edge_takes.py <reel>` satır başına kayıt ve `NN.words.json` üretir; ardından bu skill'in `voice.py <reel> --engine files` komutu Whisper indirmeden kelime zamanlarını yazar. Kaynak ve yapılan değişiklikler: `.claude/skills/edit-video/KAYNAK.md`.

An animated reel (`animated-explainer`, `3d-character`) is timed to its voice, so the voice
comes first. This skill's `scripts/voice.py` takes one take per line from any of the sources below and writes `voice/vo.wav` and
`voice/timing.json` with every word's start and end.

| Source | Cost | Your own voice? | Word times | Engine |
|---|---|---|---|---|
| **Your own recording** | Free | Yes | `hyperframes transcribe` | `files` |
| **[Chatterbox](https://github.com/resemble-ai/chatterbox)** (Resemble AI) | Free, on your machine | Yes: clones a ~10 s sample | `hyperframes transcribe` | `files` |
| **Kokoro** through `hyperframes tts` | Free, on your machine | No: preset voices | `hyperframes transcribe` | `hyperframes` |
| **[ElevenLabs](https://elevenlabs.io)** | Paid per character | Yes, with a voice clone | Exact, from its timestamps | `files` |

**The creator's own voice is the default.** Record each line as its own take, or
clone it. A cloned or synthetic voice is used only for the person whose voice it
is, with their OK. Never clone someone else's voice.

## Your own recording, or any other tool

Put one take per line in `work/<reel>/voice/takes/` as `00.wav`, `01.wav`, … in the
order of `LINES` (`.mp3` and `.m4a` work too), then:

```bash
python3 <edit-video>/scripts/voice.py work/<reel> --engine files --tempo 1.05
```

Each take is trimmed to its speech, levelled, sped up a little if asked (pitch kept)
and placed after the last with a short gap, longer at a change of speaker. Word
times come from `hyperframes transcribe` (Whisper, local) and are matched to the
script's words.

## Chatterbox: free, on-device, clones your voice

Chatterbox is MIT-licensed and runs locally. Resemble AI retired it in August 2026,
so the code no longer gets updates, but the models still work. Check that it runs on
the creator's machine before relying on it.

- **Chatterbox-Turbo** (350M parameters, English) is the one for narration. It
  takes a reference clip of about 10 seconds of the voice to clone, and understands
  tags such as `[chuckle]`.
- **Chatterbox-Multilingual** (500M parameters) covers 23 languages.
- `exaggeration` (default 0.5) makes delivery more expressive; `cfg_weight` around
  0.3 helps a fast or energetic read.
- Every file carries Resemble's inaudible Perth watermark.

```bash
pip install chatterbox-tts        # Python 3.11; downloads its model on first use
```

```python
import torchaudio as ta
from chatterbox.tts_turbo import ChatterboxTurboTTS

model = ChatterboxTurboTTS.from_pretrained(device="mps")   # "cuda" on NVIDIA, "cpu" otherwise
for i, line in enumerate(lines):                           # the spoken text of each line, in order
    wav = model.generate(line, audio_prompt_path="my-voice-10s.wav")
    ta.save(f"work/<reel>/voice/takes/{i:02d}.wav", wav, model.sr)
```

Then run `voice.py --engine files`. It is a download of a few gigabytes with PyTorch,
so ask before installing it.

## Kokoro through HyperFrames: free, no setup

The workspace runtime from `edit-video` includes `hyperframes tts`, which runs the
small Kokoro-82M model (Apache-2.0) locally. Pick a voice per speaker in the spec,
for example `VOICES = {'host': 'am_michael', 'guest': 'bf_emma'}`
(`hyperframes tts --list` shows them all), then:

```bash
python3 <edit-video>/scripts/voice.py work/<reel> --engine hyperframes --tempo 1.05
```

It needs the `kokoro-onnx` and `soundfile` Python packages; HyperFrames says so when
they are missing.

## ElevenLabs: the most natural read, exact timings

Recommend it when the creator wants the most natural read or a clone of their own
voice and is happy to pay per character. This pack doesn't call ElevenLabs and never
handles a key: the creator's agent sets ElevenLabs up with the creator's own account
(its API, CLI or MCP server, following ElevenLabs' docs), checks the credit balance,
and makes one take per line into `work/<reel>/voice/takes/` (`00.mp3`, `01.mp3`, …).

Ask the service for timestamps when it offers them, and save each line's words beside
its take as `NN.words.json`: `[{"text": "Hello", "start": 0.12, "end": 0.48}, …]` in
the take's own time. Then run `voice.py --engine files`: it uses those exact times
instead of transcribing.

## Making a voice sound right

- Speed takes up 5–7% with `--tempo`: synthetic reads tend to be slow.
- Spell tricky names for the voice in `SPOKEN = {'FavStash': 'Fave-stash'}`; the
  screen keeps the written word.
- Listen to every take. The timings follow the script, so they can't catch a word
  the voice said wrong.
