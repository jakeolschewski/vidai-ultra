# VidAI Ultra (v2) — deployment-ready, compliance-first

## Headliners
- Client-side studio: script → scenes → procedural animation → WEBM + **MP4 conversion via ffmpeg.wasm**.
- Voice capture in-browser, **SRT export** + optional **burned captions** on video.
- Brand kit: logo upload, brand text, palettes (presets).
- FTC overlay & QR baked in. WCAG AA UI. PWA (offline) with Service Worker.
- CSP + security headers. No trackers. Strict-local by default.

## Deploy (Vercel)
1. Upload this folder to a new GitHub repo.
2. Vercel → New Project → Import → Framework: Next.js.
3. Env vars (Settings → Environment Variables):
   - `MODE=strict_local`
   - `AMAZON_AFFILIATE_URL=https://www.amazon.com/?tag=yourtag-20`
   - *(optional)* `WEBHOOK_URL`, `ULTRA_WEBHOOK_SECRET`, `ELEVENLABS_API_KEY`, `HUGGINGFACE_TOKEN`
4. Deploy. `/` = Studio, `/landing` = marketing, `/policies` = privacy/terms.

## Notes
- MP4 conversion runs on-device. If a device is underpowered, use the WEBM directly or convert on desktop.
- To enable autopost, forward `/api/sign` output to your automation system and HMAC-verify using `ULTRA_WEBHOOK_SECRET`.
