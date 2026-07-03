# Pulseboard

A clean, summary-first RSS reader built with Vite and React. It stores RSS feeds in local storage, groups the latest stories, and turns them into a Llama-backed digest so users can understand the day before opening full articles.

## Why this MVP works

- Feed management lives directly in the interface and persists locally in the browser.
- The summarized digest is the primary screen, with raw feed entries pushed lower in the layout.
- A local or remote Llama endpoint can convert the latest feed items into a compact editorial briefing.
- Responsive panels are designed for mobile, tablet, and desktop from the start.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the example:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm run dev
```

4. Add feeds directly in the Source Health panel. They are saved in local storage.

## Environment variables

`VITE_RSS_PROXY`

- Optional.
- In local development, the app defaults to `/api/rss?url=` to avoid browser-side CORS issues.
- For static deployment, point this to your own backend or RSS proxy endpoint if remote feeds do not send browser-safe CORS headers.
- After changing `.env`, restart `npm run dev` so Vite reloads the proxy settings.

`VITE_MAX_ITEMS_PER_FEED`

- Optional.
- Controls how many entries are pulled from each feed.
- Default: `6`

`VITE_SUMMARY_MODE`

- Optional label for the summary engine card.
- Default: `Smart digest`

`VITE_SUMMARY_MODE_DESCRIPTION`

- Optional short description for the summary engine card.

`VITE_DIGEST_PROXY`

- Optional.
- Default: `/api/llama-digest`
- Lets the browser call a local proxy route instead of talking to the model endpoint directly.

`LLAMA_API_URL`

- Optional.
- Default: `http://127.0.0.1:11434/api/generate`
- Expected to point to an Ollama-compatible generate endpoint.

`LLAMA_MODEL`

- Optional.
- Default: `llama3.2`
- Controls which Llama model the digest proxy uses.

## Notes for interviews

- The feed service and digest proxy are isolated, so swapping the summarizer model or backend later is straightforward.
- If feeds are blocked by CORS or a proxy issue, the app falls back to demo content instead of breaking the experience.
- If the Llama endpoint is unavailable, the digest falls back to a compact local briefing instead of leaving the panel empty.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` builds the production bundle.
- `npm run lint` runs ESLint.
