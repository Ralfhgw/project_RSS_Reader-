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

2. Create your base env file:

    cp .env.example .env

3. For local development, create .env.development with:

    VITE_RSS_PROXY=/api/rss?url=

4. Start the app:

    npm run dev

## Production build

Create a .env.production file and point VITE_RSS_PROXY to a real server-side RSS proxy before running the production build.

Example:

    VITE_RSS_PROXY=https://your-domain.tld/api/rss?url=

Without a real production proxy, many feeds will fail because browsers block direct RSS requests with CORS.

## Environment variables

VITE_RSS_PROXY

- Optional in development.
- In local development, the app can use /api/rss?url= through the Vite proxy.
- In production, this should point to your own backend or RSS proxy endpoint.

VITE_MAX_ITEMS_PER_FEED

- Optional.
- Controls how many entries are pulled from each feed.
- Default: 6

## Notes

- Feed URLs are stored locally in the browser, not in a backend service.
- A static webserver alone does not provide the /api/rss endpoint from vite.config.ts.

## Scripts

- npm run dev starts the Vite dev server.
- npm run build builds the production bundle.
- npm run lint runs ESLint.
