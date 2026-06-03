# BYD Ti 7 × Al-Futtaim — Photobooth (Netlify + Bria)

Static kiosk page + two Netlify Functions. The browser never sees any secret: the Bria token and
R2 keys live only inside the functions as environment variables.

```
byd_ti7_photobooth.html        the kiosk (open at the site root)
netlify.toml                   serves the html at "/", points to the functions
package.json                   function dependency (@aws-sdk/client-s3)
.env.example                   copy to .env for local dev (never commit .env)
netlify/functions/
  cutout.js                    POST {imageBase64,name} -> Bria -> {png: dataURI}
  upload.js                    POST {imageBase64,name} -> R2  -> {url}
```

## Flow
begin → name → capture (countdown + stand guide) → **review the raw shot** (Retake / Continue) →
Continue fires Bria (loading) → **compose**: cut-out over the BYD plates with the 4-way switcher
(Retake / Continue) → done (uploads to R2, shows the QR) → **Print** (silent) → auto-reset.

If Bria is unreachable it retries once, then (with `RAW_FALLBACK:true` in the HTML's CONFIG) delivers
the raw photo so the guest still gets a print + QR. Set `RAW_FALLBACK:false` to force a Retry instead.

## 1. Environment variables
Set these in **Netlify → Site configuration → Environment variables** (and in a local `.env` for testing).
Never put them in the HTML or commit them.

| Variable | What it is |
|---|---|
| `REPLICATE_API_TOKEN` | Replicate token (replicate.com/account/api-tokens). Runs `bria/remove-background`. Requires billing set up on Replicate. |
| `R2_ACCOUNT_ID` | Cloudflare account id (the `<id>.r2.cloudflarestorage.com` part). |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token credentials. |
| `R2_BUCKET` | Bucket name. |
| `R2_PUBLIC_BASE` | Public base URL for the bucket — the `pub-xxxx.r2.dev` URL or a custom domain. No trailing slash. The QR links to `${R2_PUBLIC_BASE}/<key>`. |

> The bucket must be **publicly readable** (enable the r2.dev URL or attach a custom domain) so phones
> can open the QR link. No CORS config is needed — the kiosk never reads R2 directly; the function does.

## 2. Smoke-test the cut-out first (isolate it from the app)
The cut-out runs `bria/remove-background` on Replicate via the official `replicate` client (it reads
`REPLICATE_API_TOKEN` from the environment). Quick check that the token + billing work:
```bash
export REPLICATE_API_TOKEN=your-token
curl -s -X POST https://api.replicate.com/v1/models/bria/remove-background/predictions \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: wait" \
  -d '{"input":{"image":"https://replicate.delivery/pbxt/sample.jpg"}}'
```
A response with `"status":"succeeded"` and an `output` URL means you are good. (The kiosk passes the
photo as a base64 data URI instead of a URL — Replicate accepts both.)

> **Licensing flag:** Bria RMBG is licensed for *non-commercial* use; commercial use needs a Bria
> agreement. A BYD x Al-Futtaim activation is commercial, so confirm your Replicate usage is covered
> (or swap the model). Switching is one line: set `REPLICATE_MODEL` to a commercially-cleared
> background-remover (e.g. `851-labs/background-remover`) — no code change.

## 3. Run locally
```bash
npm install
cp .env.example .env      # fill in real values
npx netlify dev           # serves the page AND the functions at http://localhost:8888
```
Open `http://localhost:8888/` — the full capture → Bria → compose → R2 → QR flow runs against your real keys.

## 4. Deploy
Push the folder (or drag it into Netlify). With the env vars set in the dashboard, the live site at
`https://<your-site>/` is the kiosk. HTTPS gives the camera a secure context automatically.

## 5. Kiosk + silent printing (the Windows booth laptop)
1. In **Windows → Printers & scanners**, set the photo printer as the **default**, and set its paper
   to your print size (e.g. 4×6) so it matches the portrait composite.
2. Launch Chrome in kiosk mode with silent printing:
   ```
   chrome.exe --kiosk --kiosk-printing --noerrdialogs --disable-pinch ^
     --autoplay-policy=no-user-gesture-required ^
     "https://<your-site>/"
   ```
   `--kiosk-printing` makes the **Print** button fire straight to the default printer with no dialog.
3. First run only: allow camera access for the site (Chrome remembers it). To prep ahead of time you
   can add `--use-fake-ui-for-media-stream` while testing.

The print layout is handled by a print-only `@page` block in the HTML — only the final composite prints,
full-bleed, nothing else. If you ever need a *specific* printer rather than the default, that's the one
thing kiosk-printing can't do, and we'd switch that piece to the Electron exe.

## Notes
- Composite is 860×1305 JPEG (~150 KB) — well under Bria's 12 MB limit and Netlify's function payload limit.
- Bria sync removal returns in a few seconds, inside the function timeout. The kiosk also auto-retries once.
- `qrcode` still loads from the jsDelivr CDN (needs internet — which the booth has anyway for Bria/R2).
  Say the word if you want it vendored locally too.
