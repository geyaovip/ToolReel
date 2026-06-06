# ToolReel

ToolReel is an MVP CLI pipeline for generating AI tool recommendation short videos.

## Run

```bash
pnpm install
pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"
```

## TTS

The pipeline uses MiniMax TTS when `MINIMAX_API_KEY` is configured. Without a key,
it falls back to the local mock voice so the MVP pipeline can still finish.

```bash
cp .env.example .env
```

Then fill:

```text
MINIMAX_API_KEY=your_api_key
MINIMAX_TTS_VOICE_ID=Chinese (Mandarin)_Radio_Host
```

TTS output metadata is written to:

```text
outputs/YYYY-MM-DD-cursor/voice.json
```

Recommended male voices for AI tool recommendation videos:

```text
Chinese (Mandarin)_Radio_Host
Chinese (Mandarin)_Male_Announcer
Chinese (Mandarin)_Reliable_Executive
male-qn-jingying
```

Generate voice previews:

```bash
pnpm tts:preview
pnpm tts:preview --voices="Chinese (Mandarin)_Radio_Host,Chinese (Mandarin)_Male_Announcer"
```

## Assets

The pipeline collects first-pass production assets automatically:

```text
outputs/YYYY-MM-DD-cursor/assets/homepage.png
outputs/YYYY-MM-DD-cursor/assets/cursor-logo.ico
outputs/YYYY-MM-DD-cursor/assets.json
```

`assets.json` records homepage metadata, downloaded official-site assets,
image candidates, video candidates, and social profile/video links discovered
from the official page. It does not invent quotes or third-party endorsements.

To add curated materials such as X/Twitter quotes, third-party videos, official
demo videos, or local screen recordings, create:

```text
outputs/YYYY-MM-DD-cursor/assets.manual.json
```

Use `docs/manual-assets.example.json` as the template, or point to another
manual asset file with:

```text
TOOLREEL_MANUAL_ASSETS=/absolute/path/to/assets.manual.json
```

Remotion rendering uses a local headless Chrome process and an available local render port. By default, the MVP lets Remotion use its managed `headless-shell` browser. Override it only when you need a specific local Chrome binary:

```text
REMOTION_CHROME_EXECUTABLE=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

Runtime controls:

```text
REMOTION_CHROME_MODE=headless-shell
REMOTION_RENDER_PORT=39777
REMOTION_RENDER_CONCURRENCY=1
REMOTION_RENDER_TIMEOUT_MS=120000
REMOTION_RENDER_ATTEMPTS=2
```

If you run this inside a restricted agent sandbox, allow local port access and network access for the generate command so Remotion can download or launch its browser.

## Git Commit Messages

If an IDE or agent cannot generate a commit message automatically, use the deterministic fallback:

```bash
pnpm commit:message
```

The repository also includes `.gitmessage` as a local commit template.

This repo also uses `.githooks/prepare-commit-msg` as a click-to-commit fallback. If the commit UI opens with an empty message because automatic generation failed, the hook fills a deterministic message before Git creates the commit.

The hook is installed automatically by `pnpm install`.

The generated files are written to:

```text
outputs/YYYY-MM-DD-cursor/
```

The final video is:

```text
outputs/YYYY-MM-DD-cursor/final.mp4
```

The pipeline also writes a media validation report:

```text
outputs/YYYY-MM-DD-cursor/run.json
outputs/YYYY-MM-DD-cursor/validation.json
outputs/YYYY-MM-DD-cursor/first-frame.png
```

## MVP Scope

This stage uses real first-pass official-site research, dynamic script planning, real first-pass asset collection, MiniMax TTS with local mock fallback, and a HyperFrames website-demo scene. Remotion is the core renderer for structured scenes. The pipeline shape is real: CLI input, JSON artifacts, research, asset collection, scene planning, renderer routing, scene MP4 output, cover image, validation, and final MP4 merge.
