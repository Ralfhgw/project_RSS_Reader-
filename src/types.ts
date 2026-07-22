export type FeedConfig = {
  id: string
  name: string
  url: string
  topic: string
}

export type FeedItem = {
  id: string
  title: string
  summary: string
  link: string
  publishedAt: string
  source: string
  topic: string
}

export type FeedHealth = {
  id: string
  name: string
  topic: string
  status: "online" | "offline" | "error"
}

export type FeedLoadResult = {
  items: FeedItem[]
  health: FeedHealth[]
  message: string
}
