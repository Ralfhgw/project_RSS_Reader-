# Pulseboard

A lean RSS reader built with Vite and React. It stores RSS feeds in local storage, loads the latest entries, and lets users filter the stream by topic or keyword before opening full articles.

## Why this MVP works

- Feed management lives directly in the interface and persists locally in the browser.
- Search and topic filters make large RSS streams easier to scan.
- Import and export keep the saved channel list portable.
- Responsive panels are designed for mobile, tablet, and desktop from the start.

## Quick start

1. Install dependencies:

    npm install

2. Create a local env file from the example:

    cp .env.example .env

3. Start the app:

    npm run dev

4. Add feeds directly in the feed management panel. They are saved in local storage.

## Environment variables

VITE_RSS_PROXY

- Optional.
- In local development, the app defaults to /api/rss?url= to avoid browser-side CORS issues.
- For static deployment, point this to your own backend or RSS proxy endpoint if remote feeds do not send browser-safe CORS headers.
- After changing .env, restart npm run dev so Vite reloads the proxy settings.

VITE_MAX_ITEMS_PER_FEED

- Optional.
- Controls how many entries are pulled from each feed.
- Default: 6

## Notes

- If feeds are blocked by CORS or a proxy issue, the app falls back to demo content instead of breaking the experience.
- Feed URLs are stored locally in the browser, not in a backend service.

## Scripts

- npm run dev starts the Vite dev server.
- npm run build builds the production bundle.
- npm run lint runs ESLint.
