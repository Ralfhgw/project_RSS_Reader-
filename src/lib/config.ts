import type { FeedConfig } from "../types"

export const defaultFeeds: FeedConfig[] = [
  {
    id: "tech-radar",
    name: "Tech Radar",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    topic: "Tech",
  },
  {
    id: "product-watch",
    name: "Product Watch",
    url: "https://www.theverge.com/rss/index.xml",
    topic: "Product",
  },
  {
    id: "world-desk",
    name: "World Desk",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    topic: "World",
  },
]

function parseMaxItems(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6
}

export const appConfig = {
  rssProxy: import.meta.env.VITE_RSS_PROXY ?? (import.meta.env.DEV ? "/api/rss?url=" : "/api/rss/?url="),
  maxItemsPerFeed: parseMaxItems(import.meta.env.VITE_MAX_ITEMS_PER_FEED),
}