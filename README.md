# ToolReel

ToolReel is an MVP CLI pipeline for generating AI tool recommendation short videos.

## Run

```bash
pnpm install
pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"
```

The generated files are written to:

```text
outputs/YYYY-MM-DD-cursor/
```

The final video is:

```text
outputs/YYYY-MM-DD-cursor/final.mp4
```

## MVP Scope

This stage intentionally uses mock research, mock script data, mock assets, placeholder voice, and renderer placeholders. The pipeline shape is real: CLI input, JSON artifacts, scene planning, renderer routing, scene MP4 output, cover image, and final MP4 merge.

