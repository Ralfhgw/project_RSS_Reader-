import { appConfig } from "./config"
import type { FeedConfig, FeedHealth, FeedItem, FeedLoadResult } from "../types"

const demoItems: FeedItem[] = [
  {
    id: "demo-tech-1",
    title: "Device makers tighten focus on smaller, faster on-device models",
    summary:
      "Hardware vendors are shifting attention toward lightweight assistants that handle quick notifications and local tasks directly on the device.",
    link: "#",
    publishedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    source: "Tech Radar",
    topic: "Tech",
  },
  {
    id: "demo-product-2",
    title: "News apps lean into briefings instead of infinite article lists",
    summary:
      "Product teams are redesigning home screens so readers start with a compact overview before opening full stories.",
    link: "#",
    publishedAt: new Date(Date.now() - 1000 * 60 * 96).toISOString(),
    source: "Product Watch",
    topic: "Product",
  },
  {
    id: "demo-world-3",
    title: "Publishers experiment with topic bundles to fight information overload",
    summary:
      "Editors are packaging related stories into single explainers so audiences can keep up without hopping across multiple sites.",
    link: "#",
    publishedAt: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    source: "World Desk",
    topic: "World",
  },
]

function stripMarkup(value: string) {
  const doc = new DOMParser().parseFromString(value, "text/html")
  return doc.body.textContent?.replace(/\s+/g, " " ).trim() ?? ""
}

function parsePublishedAt(value: string | null) {
  if (!value) {
    return new Date().toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function getText(parent: Element, selectors: string[]) {
  const normalizedSelectors = selectors.map((selector) => selector.toLowerCase())

  for (const selector of selectors) {
    let match: Element | null

    try {
      match = parent.querySelector(selector)
    } catch {
      continue
    }

    if (match?.textContent?.trim()) {
      return match.textContent.trim()
    }
  }

  const descendants = Array.from(parent.querySelectorAll("*"))

  for (const element of descendants) {
    const tagName = element.tagName.toLowerCase()
    const localName = element.localName.toLowerCase()

    if (normalizedSelectors.includes(tagName) || normalizedSelectors.includes(localName)) {
      const text = element.textContent?.trim()

      if (text) {
        return text
      }
    }
  }

  return ""
}

function getLink(parent: Element) {
  const atomLink = parent.querySelector("link[href]")
  if (atomLink) {
    return atomLink.getAttribute("href") ?? "#"
  }

  const rssLink = parent.querySelector("link")
  return rssLink?.textContent?.trim() || "#"
}

function normalizeItem(sourceFeed: FeedConfig, item: Element, index: number): FeedItem {
  const title = getText(item, ["title"])
  const summary = stripMarkup(
    getText(item, ["content:encoded", "description", "summary", "content", "encoded"]),
  )

  return {
    id: sourceFeed.id + "-" + index + "-" + title,
    title: title || "Unbenannter Artikel",
    summary: summary || "Die Quelle hat keine Kurzbeschreibung für diesen Eintrag geliefert.",
    link: getLink(item),
    publishedAt: parsePublishedAt(getText(item, ["pubDate", "published", "updated"])),
    source: sourceFeed.name,
    topic: sourceFeed.topic,
  }
}

async function fetchFeedXml(url: string) {
  const proxyCandidates = [
    appConfig.rssProxy ? appConfig.rssProxy + encodeURIComponent(url) : url,
    import.meta.env.DEV ? "/api/rss?url=" + encodeURIComponent(url) : "",
    url,
  ].filter((candidate, index, allCandidates) => {
    return candidate.length > 0 && allCandidates.indexOf(candidate) === index
  })

  const failures: string[] = []

  for (const endpoint of proxyCandidates) {
    try {
      const response = await fetch(endpoint)

      if (!response.ok) {
        failures.push(endpoint + " (" + response.status + ")")
        continue
      }

      return await response.text()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Anfrage fehlgeschlagen"
      failures.push(endpoint + " (" + message + ")")
    }
  }

  throw new Error("Feed-Anfrage für " + url + " ist fehlgeschlagen. Versucht: " + failures.join(", "))
}

async function loadSingleFeed(feed: FeedConfig) {
  const xml = await fetchFeedXml(feed.url)
  const parsed = new DOMParser().parseFromString(xml, "application/xml")
  const parserError = parsed.querySelector("parsererror")

  if (parserError) {
    throw new Error("Das Feed-XML konnte nicht verarbeitet werden.")
  }

  const entries = Array.from(parsed.querySelectorAll("item, entry"))
    .slice(0, appConfig.maxItemsPerFeed)
    .map((entry, index) => normalizeItem(feed, entry, index))

  return entries
}

export async function loadConfiguredFeeds(feeds: FeedConfig[]): Promise<FeedLoadResult> {
  if (feeds.length === 0) {
    return {
      items: [],
      health: [],
      message: "Füge einen Feed hinzu, um deinen RSS-Stream aufzubauen.",
    }
  }

  const settled = await Promise.allSettled(feeds.map((feed) => loadSingleFeed(feed)))

  const items: FeedItem[] = []
  const health: FeedHealth[] = []
  const failedNames: string[] = []

  settled.forEach((result, index) => {
    const feed = feeds[index]

    if (result.status === "fulfilled" && result.value.length > 0) {
      items.push(...result.value)
      health.push({
        id: feed.id,
        name: feed.name,
        topic: feed.topic,
        status: "online",
      })
      return
    }

    failedNames.push(feed.name)
    health.push({
      id: feed.id,
      name: feed.name,
      topic: feed.topic,
      status: "error",
    })
  })

  const sortedItems = items.sort((left, right) => {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  })

  if (sortedItems.length > 0) {
    return {
      items: sortedItems,
      health,
      message:
        failedNames.length > 0
          ? "Einige Feeds konnten nicht geladen werden: " + failedNames.join(", ") + "."
          : "",
    }
  }

  return {
    items: demoItems,
    health: feeds.map((feed) => ({
      id: feed.id,
      name: feed.name,
      topic: feed.topic,
      status: "offline",
    })),
    message:
      "Die Live-Feeds waren nicht erreichbar, deshalb werden Demo-Artikel angezeigt. Prüfe die gespeicherten Feed-URLs oder die aktive Proxy-Konfiguration.",
  }
}
