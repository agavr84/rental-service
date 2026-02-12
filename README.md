# Rental Service (Notepub + Yandex Cloud Function)

Static rental catalog website powered by Notepub, deployed to GitHub Pages.

Lead form submissions are sent to Telegram through a serverless function:
- `functions/telegram-lead/`

## Architecture

- Static site: Notepub build output (`dist/`)
- Hosting: GitHub Pages (GitHub Actions)
- Lead API: Yandex Cloud Function (HTTP endpoint)
- No VPS required

## Project structure

- `content/` - markdown pages and media (`/media/*`)
- `theme/` - templates and assets
- `config.yaml`, `rules.yaml` - Notepub config
- `scripts/build.sh` - local/CI build script
- `.github/workflows/deploy.yml` - GitHub Pages deploy
- `functions/telegram-lead/` - serverless lead endpoint

## Local run

1. Download `notepub` binary (recommended from release `v0.1.3`):

```bash
curl -L -o ./notepub "https://github.com/cookiespooky/notepub/releases/download/v0.1.3/notepub_darwin_arm64"
chmod +x ./notepub
```

2. Build:

```bash
NOTEPUB_BIN=./notepub ./scripts/build.sh
```

3. Serve:

```bash
./notepub serve --config ./config.yaml --rules ./rules.yaml
```

Open `http://127.0.0.1:8080/`.

## Deploy

- Push to `main`.
- Workflow `Deploy Rental Site to GitHub Pages` builds and deploys `dist/`.
- `base_url` and `media_base_url` are adjusted automatically for GitHub Pages.

## Lead form

- Frontend form is on `content/home.md`.
- Endpoint URL is stored in form attribute `data-endpoint`.
- Request payload:
  - `name`
  - `phone`

If needed, update endpoint in `content/home.md`.
