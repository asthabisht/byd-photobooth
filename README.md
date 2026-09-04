# Hollister Hangouts — Photobooth

A single-page kiosk photobooth. Flow: **Start → live camera + 5·4·3·2·1 countdown → review (Retake / Next) → Scan to download (QR) + Print → auto-reset home.**

Each photo is uploaded to Cloudflare R2 by a Netlify Function; the returned URL is what the QR encodes, so guests scan to download. Printing is silent when the kiosk browser is launched with `--kiosk-printing`.

## Structure

```
.
├── anf_photobooth.html        # the whole app (served at site root)
├── assets/
│   ├── HOLLISTER_HANGOUTS_*.svg   # event lockups (Cloud Dancer used)
│   ├── gradient.svg               # event sunset gradient (reference)
│   └── fonts/                     # Garamond Premier Pro + Trade Gothic (.otf)
├── netlify/functions/
│   └── upload.js              # POST {imageBase64,name} -> uploads to R2 -> { url }
├── netlify.toml              # serves the app at "/", functions dir, esbuild bundler
├── package.json             # function dependency: @aws-sdk/client-s3
├── .env.example            # the R2 vars you must set in Netlify (names only)
└── .gitignore
```

## Deploy (git → Netlify)

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import from Git →** pick the repo. No build command needed; publish dir is `.` (already in `netlify.toml`).
3. **Set environment variables** (Site settings → Environment variables) — from `.env.example`:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_BASE`  (public base URL of the bucket, no trailing slash — an `r2.dev` domain or a custom domain)
4. Make the R2 bucket's objects publicly readable (enable the `r2.dev` public URL or attach a custom domain) so scanned links open.
5. Deploy. The site root (`https://<site>.netlify.app/`) is the booth.

> Until the R2 vars are set the app still runs — the QR just falls back to `hollisterco.com` (change `QR_FALLBACK_URL` in the HTML if you want a different placeholder).

## Run on the kiosk (silent printing)

`window.print()` only prints silently when Chrome/Edge is launched with `--kiosk-printing`. Set the **photo printer as the OS default** (and its default paper to your print size), then launch:

**Windows** (shortcut Target):
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --noerrdialogs --disable-infobars --disable-session-crashed-bubble --incognito https://<site>.netlify.app
```

**macOS**:
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --kiosk --kiosk-printing --incognito https://<site>.netlify.app
```

Camera: allow the camera for the site once (or add `--use-fake-ui-for-media-stream` to auto-allow in kiosk).

## Configuration (top of `anf_photobooth.html`, `CONFIG`)

| key | default | meaning |
|-----|---------|---------|
| `COUNTDOWN_FROM` | `5` | countdown seconds |
| `PRINT_SECONDS` | `18` | how long "Printing…" shows before auto-reset |
| `CAPTURE_W` / `CAPTURE_H` | `1080` / `1440` | photo pixels (3:4) — match to your print paper |
| `QR_FALLBACK_URL` | hollisterco.com | QR link when the upload backend is unavailable |

## Branding

Palette: Cloud Dancer `#F2F0EC`, Big Dipper `#253746`, event sunset gradient. Fonts and lockups are bundled in `assets/`. All colors are CSS variables at `:root`.
