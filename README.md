# Pulseboard

A lean RSS reader built with Vite and React. It stores RSS feeds in local storage, loads the latest entries, and lets users filter the stream by topic or keyword before opening full articles.

## Quick start

1. Install dependencies:

    npm install

2. Start the app:

    npm run dev

## Proxy behavior

- In development, the app uses the Vite proxy at `/api/rss?url=`.
- In production, the app uses the PHP endpoint at `/api/rss/?url=`.
- You only need `VITE_RSS_PROXY` if you want to override those defaults.

## Production deployment

After `npm run build`, make sure your webserver serves the contents of `dist/` and executes `dist/api/rss/index.php` as PHP.

If your server does not execute PHP inside the deployed app directory, the RSS proxy will not work and feeds will fail with CORS errors.

## Environment variables

VITE_RSS_PROXY

- Optional override for the RSS proxy URL.
- Default in development: `/api/rss?url=`
- Default in production: `/api/rss/?url=`

VITE_MAX_ITEMS_PER_FEED

- Optional.
- Controls how many entries are pulled from each feed.
- Default: `6`

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` builds the production bundle.
- `npm run lint` runs ESLint.