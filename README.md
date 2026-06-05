# ToolReel

ToolReel is an MVP CLI pipeline for generating AI tool recommendation short videos.

## Run

```bash
pnpm install
pnpm generate --name="Cursor" --url="https://cursor.com" --type="product_pick"
```

Remotion rendering uses a local Chrome process and a local render port. On macOS, the MVP expects Chrome at:

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

If you run this inside a restricted agent sandbox, allow local port access for the generate command.

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
outputs/YYYY-MM-DD-cursor/validation.json
outputs/YYYY-MM-DD-cursor/first-frame.png
```

## MVP Scope

This stage intentionally uses mock research, mock script data, mock assets, placeholder voice, and a HyperFrames placeholder. Remotion is initialized and renders the structured scene types through real Remotion compositions. The pipeline shape is real: CLI input, JSON artifacts, scene planning, renderer routing, scene MP4 output, cover image, validation, and final MP4 merge.
