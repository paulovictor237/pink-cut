# video-use skill

Conversational AI video editor for Claude Code. Drop raw footage → chat → get `final.mp4`. No timeline, no menus.

---

## Capabilities

| What | How |
|------|-----|
| Cut filler words, dead space, bad takes | LLM reads packed transcript, picks word-boundary cuts |
| Multi-take assembly | Sub-agent picks best take per beat across all clips |
| Color grade | `grade.py` → ffmpeg filter chains per segment |
| Subtitles | ffmpeg ASS burn-in, applied last in chain |
| Animation overlays | Parallel sub-agents, one per slot |
| Self-eval before showing preview | `timeline_view` on rendered output at every cut boundary |
| Session memory | Appends `project.md` each session |
| Download online sources | yt-dlp |

---

## Tech stack

| Capability | Tool / Library |
|------------|---------------|
| Transcription (word-level ASR) | ElevenLabs Scribe API (word timestamps + speaker diarization) |
| Transcript packing | `pack_transcripts.py` — custom Python |
| Visual drill-down (filmstrip + waveform) | `timeline_view.py` → matplotlib + librosa |
| Cut/render pipeline | `render.py` → ffmpeg (per-segment extract → concat → overlays → subtitles) |
| Color grading | `grade.py` → ffmpeg filter chains (ASC CDL model) |
| Subtitles | ffmpeg ASS force_style |
| Animation — web/kinetic | HyperFrames (HTML/CSS/GSAP, via npx) |
| Animation — React | Remotion (via npx create-video) |
| Animation — math diagrams | Manim (optional dep) |
| Animation — simple overlays | PIL + PNG sequence → ffmpeg |
| Source download | yt-dlp |
| Python deps | requests, librosa, matplotlib, Pillow, numpy |
| Package manager | uv (or pip) |

---

## Key design insight

LLM never watches frames. It reads a ~12KB packed transcript (`takes_packed.md`) — word boundaries, timestamps, speaker tags, audio events. Visuals (`timeline_view` PNG) fetched only at decision points.

> Naive approach: 30,000 frames × 1,500 tokens = **45M tokens of noise**
> video-use: **12KB text + a handful of PNGs**

---

## Pipeline

```
Transcribe → Pack → LLM Reasons → EDL → Render → Self-Eval
                                                     │
                                                     └─ issue? fix + re-render (max 3 passes)
```

---

## Hard rules (non-negotiable)

1. Subtitles applied **last** in filter chain — after every overlay
2. Per-segment extract → lossless `-c copy` concat (no double-encode)
3. 30ms audio fades at every segment boundary (no pops)
4. Overlays use `setpts=PTS-STARTPTS+T/TB` to shift frame 0
5. Master SRT uses output-timeline offsets
6. Never cut inside a word — snap to word boundary
7. Pad every cut edge: 30–200ms working window
8. Word-level verbatim ASR only (no SRT/phrase mode)
9. Cache transcripts per source — never re-transcribe unchanged files
10. Parallel sub-agents for multiple animations (never sequential)
11. Strategy confirmation before any execution
12. All outputs in `<videos_dir>/edit/` — never inside skill directory

---

## Animation engines

- **HyperFrames** — HTML/CSS/GSAP, best for UI motion and kinetic typography
- **Remotion** — React compositions, best when component state matters
- **Manim** — formal diagrams, equations, graph morphs
- **PIL + ffmpeg** — simple overlay cards, fast iteration

---

## Directory layout

```
<videos_dir>/
├── <source files, untouched>
└── edit/
    ├── project.md               ← session memory
    ├── takes_packed.md          ← primary LLM reading view
    ├── edl.json                 ← cut decisions
    ├── transcripts/<name>.json  ← cached raw Scribe JSON
    ├── animations/slot_<id>/    ← per-animation source + render
    ├── clips_graded/            ← per-segment extracts with grade
    ├── master.srt               ← output-timeline subtitles
    ├── downloads/               ← yt-dlp outputs
    ├── verify/                  ← debug frames / timeline PNGs
    ├── preview.mp4
    └── final.mp4
```
