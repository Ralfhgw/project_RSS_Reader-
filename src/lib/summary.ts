import { appConfig } from './config'
import type { DigestResult, DigestSection, FeedHealth, FeedItem } from '../types'

type LlamaChannelPayload = {
  theme?: unknown
  summary?: unknown
}

export type ChannelDigestResult = {
  section: DigestSection
  mode: 'llama' | 'fallback'
}

function asText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}...`
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function buildCoverageLabel(items: FeedItem[], feedHealth: FeedHealth[]) {
  const possibleItems = Math.max(feedHealth.length, 1) * Math.max(appConfig.maxItemsPerFeed, 1)
  const ratio = Math.min(100, Math.round((items.length / possibleItems) * 100))
  return `${Math.max(ratio, items.length > 0 ? 12 : 0)}%`
}

function getTopTopics(items: FeedItem[]) {
  const counts = new Map<string, number>()

  items.forEach((item) => {
    counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([topic]) => topic)
}

function getChannelItems(items: FeedItem[], channelName: string) {
  return items.filter((item) => item.source === channelName)
}

function translateFeedStatus(status: FeedHealth['status']) {
  if (status === 'online') {
    return 'online'
  }

  if (status === 'error') {
    return 'Fehler'
  }

  return 'offline'
}

function buildPromptItems(channelItems: FeedItem[]) {
  const primaryItems = channelItems.slice(0, 4).map((item) => ({
    title: clampText(compactWhitespace(item.title), 160),
    summary: clampText(compactWhitespace(item.summary), 420),
    publishedAt: item.publishedAt,
    topic: item.topic,
  }))

  let serialized = JSON.stringify(primaryItems, null, 2)

  if (serialized.length <= 5000) {
    return serialized
  }

  const reducedItems = channelItems.slice(0, 3).map((item) => ({
    title: clampText(compactWhitespace(item.title), 120),
    summary: clampText(compactWhitespace(item.summary), 220),
    publishedAt: item.publishedAt,
  }))

  serialized = JSON.stringify(reducedItems, null, 2)

  if (serialized.length <= 3200) {
    return serialized
  }

  return JSON.stringify(
    channelItems.slice(0, 2).map((item) => ({
      title: clampText(compactWhitespace(item.title), 90),
      summary: clampText(compactWhitespace(item.summary), 120),
    })),
    null,
    2,
  )
}

function buildFallbackChannelSummary(channel: FeedHealth, channelItems: FeedItem[]) {
  if (channelItems.length === 0) {
    return channel.status === 'online'
      ? 'Dieser Feed ist online, hat für den aktuellen Digest-Durchlauf aber keinen lesbaren Beitrag geliefert.'
      : 'Für diesen Kanal sind aktuell keine Feed-Einträge verfügbar, daher gibt es im Moment noch nichts Sinnvolles zusammenzufassen.'
  }

  const leadStory = channelItems[0]?.title ?? 'Der neueste Artikel'
  const nextStory = channelItems[1]?.title
  const thirdStory = channelItems[2]?.title
  const storyCountLabel = `${channelItems.length} aktuelle${channelItems.length === 1 ? 'r Artikel' : ' Artikel'}`
  const leadSummary = channelItems[0]?.summary
  const secondSummary = channelItems[1]?.summary

  return clampText(
    nextStory
      ? `${storyCountLabel} aus ${channel.name} kreisen derzeit um ${leadStory}. ${
          leadSummary ?? 'Dieser Leitartikel zeigt am deutlichsten, worauf diese Quelle aktuell den Schwerpunkt legt.'
        } ${nextStory} ist das nächste auffällige Update und erweitert das Bild, indem es dasselbe Thema aus einer anderen Perspektive weiterführt. ${
          secondSummary ?? 'Zusammen deuten die ersten beiden Artikel auf eine klare redaktionelle Linie in diesem Feed hin.'
        } ${
          thirdStory
            ? `${thirdStory} fügt eine weitere Ebene hinzu und zeigt, dass es sich nicht um eine einmalige Schlagzeile, sondern um einen groesseren Strom zusammenhängender Berichte handelt.`
            : 'Selbst mit nur wenigen Einträgen zeigt der Kanal bereits eine gut erkennbare redaktionelle Richtung.'
        }`
      : `${storyCountLabel} aus ${channel.name} kreisen derzeit um ${leadStory}. ${
          leadSummary ?? 'Der verfügbare Eintrag zeigt am klarsten, was diese Quelle im Moment in den Vordergrund stellen will.'
        } Weil es nur wenige frische Einträge gibt, bleibt das Bild noch begrenzt, aber der Kanal ist aktiv genug, um bereits eine erste Richtung der kommenden Berichterstattung erkennen zu lassen.`,
    1400,
  )
}

function createChannelTheme(channel: FeedHealth, channelItems: FeedItem[]) {
  if (channelItems.length === 0) {
    return `${channel.topic} · ${translateFeedStatus(channel.status)}`
  }

  return `${channel.topic} · ${channelItems.length} Artikel`
}

function buildDigestTakeaway(items: FeedItem[], feedHealth: FeedHealth[]) {
  if (items.length === 0) {
    return 'Sobald erste Artikel eintreffen, bekommst du hier eine kurze Einordnung der wichtigsten Entwicklungen über alle Kanäle hinweg.'
  }

  const topTopics = getTopTopics(items)
  const leadTopic = topTopics[0]
  const uniqueSources = new Set(items.map((item) => item.source)).size
  const newestTitle = items[0]?.title
  const activeChannels = feedHealth.filter((channel) => channel.status === 'online').length

  if (!leadTopic) {
    return `Heute liegen ${items.length} aktuelle Artikel aus ${uniqueSources} Quellen vor. Die Übersicht zeigt dir vor allem, welche Quellen gerade aktiv sind und welche Themen sich daraus bereits abzeichnen.`
  }

  return clampText(
    `Heute steht vor allem ${leadTopic} im Fokus. ${items.length} aktuelle Artikel aus ${uniqueSources} Quellen und ${activeChannels} aktiven Kanälen zeigen, wo sich die Berichterstattung gerade verdichtet.${newestTitle ? ` Ein prägender Aufhänger ist derzeit „${newestTitle}“.` : ''}`,
    280,
  )
}

function buildDigestWatchlist(items: FeedItem[], feedHealth: FeedHealth[]) {
  if (items.length === 0) {
    return 'Sobald Feeds antworten, siehst du hier, welche Themen oder Quellen du beim nächsten Refresh besonders im Auge behalten solltest.'
  }

  const topTopics = getTopTopics(items)
  const secondaryTopic = topTopics[1]
  const missingChannels = feedHealth
    .filter((channel) => channel.status !== 'online')
    .map((channel) => channel.name)
    .slice(0, 2)

  if (secondaryTopic && missingChannels.length > 0) {
    return `Behalte im nächsten Schritt besonders ${secondaryTopic} im Blick und prüfe außerdem, ob fehlende Quellen wie ${missingChannels.join(' und ')} wieder neue Einträge liefern.`
  }

  if (secondaryTopic) {
    return `Behalte im nächsten Schritt besonders ${secondaryTopic} im Blick. Daran erkennst du schnell, ob sich neben dem dominanten Thema bereits ein zweiter Schwerpunkt etabliert.`
  }

  if (missingChannels.length > 0) {
    return `Achte beim nächsten Refresh darauf, ob fehlende Quellen wie ${missingChannels.join(' und ')} wieder Beiträge liefern und das Gesamtbild verbreitern.`
  }

  const latestSource = items[0]?.source
  return `Beobachte beim nächsten Refresh vor allem, ob ${latestSource ?? 'die führende Quelle'} den aktuellen Schwerpunkt weiter bestätigt oder ob sich die Themenlage spürbar verschiebt.`
}

function createBaseDigest(items: FeedItem[], feedHealth: FeedHealth[]): DigestResult {
  return {
    headline: 'Ein Digest, getrennt nach Feed-Kanälen.',
    intro: `Auf Basis von ${items.length} Artikeln erklären die Zusammenfassungen unten jeden konfigurierten Feed-Kanal einzeln, damit du Quelle fuer Quelle lesen kannst.`,
    takeaway: buildDigestTakeaway(items, feedHealth),
    watchlist: buildDigestWatchlist(items, feedHealth),
    storyCount: items.length,
    coverageLabel: buildCoverageLabel(items, feedHealth),
    engineLabel: 'Llama-Digest',
    statusNote: 'Kanalzusammenfassungen werden vorbereitet.',
    sections: feedHealth.map((channel) => ({
      title: channel.name,
      theme: createChannelTheme(channel, getChannelItems(items, channel.name)),
      summary: 'Für diesen Kanal wird gerade eine Zusammenfassung erstellt...',
    })),
  }
}

export function createEmptyDigest(): DigestResult {
  return {
    headline: 'Lade Feeds, um den ersten Digest zu erzeugen.',
    intro: 'Sobald Artikel eintreffen, bekommt jeder Feed-Kanal seine eigene kurze, von Llama erstellte Zusammenfassung.',
    takeaway: 'Hier erscheint eine kurze Tages-Einordnung, sobald mindestens eine konfigurierte Quelle antwortet.',
    watchlist: 'Hier siehst du anschließend, welche Themen oder Quellen du beim nächsten Refresh besonders im Blick behalten solltest.',
    storyCount: 0,
    coverageLabel: '0%',
    engineLabel: 'Warte auf Feeds',
    statusNote: 'Noch sind keine Feed-Einträge verfügbar.',
    sections: [
      {
        title: 'Warte auf Quellen',
        theme: 'Noch keine Live-Artikel',
        summary: 'Konfiguriere Feeds und lade die App neu, dann erstellt der Digest eine zusammenhängende Zusammenfassung pro Feed-Kanal.',
      },
    ],
  }
}

export function createDigestScaffold(items: FeedItem[], feedHealth: FeedHealth[]): DigestResult {
  if (items.length === 0) {
    return createEmptyDigest()
  }

  return createBaseDigest(items, feedHealth)
}

function buildChannelPrompt(channel: FeedHealth, channelItems: FeedItem[]) {
  const serializedItems = buildPromptItems(channelItems)

  return `
Du schreibst eine prägnante RSS-Zusammenfassung fuer eine Dashboard-Karte mit dem Namen "Heutiger Digest".

Gib ausschliesslich gültiges JSON in genau dieser Form zurück:
{
  "theme": "kurzes Themen- und Statuslabel",
  "summary": "ein etwas ausführlicher erklärender Absatz"
}

Regeln:
- Schreibe ausschliesslich über den unten gezeigten einzelnen Feed-Kanal.
- Antworte komplett auf Deutsch.
- Erstelle keine Aufzählungspunkte oder nummerierten Listen.
- Die Zusammenfassung soll ein gut lesbarer Absatz sein, der hilft, den allgemeinen Inhalt dieses Feed-Kanals schnell zu verstehen.
- Die Zusammenfassung soll deutlich länger sein als ein kurzer Dashboard-Teaser und ungefähr 5 bis 7 Sätze umfassen.
- Erkläre die generelle Richtung des Feeds, wiederkehrende Themen und was über die jüngsten Einträge hinweg besonders auffällt.
- Formuliere sachlich und gut scanbar, aber nicht zu knapp.
- Stütze dich ausschliesslich auf die bereitgestellten Einträge.
- Wenn keine Einträge vorhanden sind, sage explizit, dass es aktuell nichts Sinnvolles zusammenzufassen gibt.

Feed-Kanal:
${JSON.stringify(
  {
    name: channel.name,
    topic: channel.topic,
    status: channel.status,
  },
  null,
  2,
)}

Feed-Einträge:
${serializedItems}
`.trim()
}

function extractJsonObject(value: string) {
  const trimmed = value.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return ''
}

export async function createChannelDigestSection(
  channel: FeedHealth,
  items: FeedItem[],
): Promise<ChannelDigestResult> {
  const channelItems = getChannelItems(items, channel.name)

  if (channelItems.length === 0) {
    return {
      section: {
        title: channel.name,
        theme: createChannelTheme(channel, channelItems),
        summary: buildFallbackChannelSummary(channel, channelItems),
      },
      mode: 'fallback',
    }
  }

  try {
    const response = await fetch(appConfig.digestProxy, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: buildChannelPrompt(channel, channelItems),
      }),
    })

    if (!response.ok) {
      throw new Error(`Digest-Anfrage ist mit Status ${response.status} fehlgeschlagen.`)
    }

    const payload = (await response.json()) as { content?: string }
    const rawJson = extractJsonObject(payload.content ?? '')

    if (!rawJson) {
      throw new Error('Die Llama-Antwort enthielt kein JSON-Objekt.')
    }

    const parsed = JSON.parse(rawJson) as LlamaChannelPayload

    return {
      section: {
        title: channel.name,
        theme: asText(parsed.theme, createChannelTheme(channel, channelItems)),
        summary: asText(parsed.summary, buildFallbackChannelSummary(channel, channelItems)),
      },
      mode: 'llama',
    }
  } catch (error) {
    const reason =
      error instanceof Error
        ? `Kanal-Digest-Fallback fuer ${channel.name}: ${error.message}`
        : `Kanal-Digest-Fallback fuer ${channel.name}: unbekannter Fehler.`

    console.warn('[Digest] Wechsle auf lokale Kanalzusammenfassung zurück.', reason)

    return {
      section: {
        title: channel.name,
        theme: createChannelTheme(channel, channelItems),
        summary: buildFallbackChannelSummary(channel, channelItems),
      },
      mode: 'fallback',
    }
  }
}

export function formatDistanceFromNow(value: string) {
  const date = new Date(value)
  const deltaMs = Date.now() - date.getTime()

  if (Number.isNaN(date.getTime()) || deltaMs < 0) {
    return 'gerade eben'
  }

  const minutes = Math.floor(deltaMs / 60000)

  if (minutes < 1) {
    return 'gerade eben'
  }

  if (minutes < 60) {
    return `vor ${minutes} Min.`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `vor ${hours} Std.`
  }

  const days = Math.floor(hours / 24)
  return `vor ${days} Tg.`
}
