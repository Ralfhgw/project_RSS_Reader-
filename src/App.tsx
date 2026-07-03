import { useEffect, useDeferredValue, useRef, useState, useTransition } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'
import { appConfig } from './lib/config'
import { createFeedId, loadStoredFeeds, parseStoredFeeds, saveStoredFeeds} from './lib/feedStorage'
import { loadConfiguredFeeds } from './lib/rss'
import {
  createChannelDigestSection,
  createDigestScaffold,
  createEmptyDigest,
  formatDistanceFromNow,
} from './lib/summary'
import type { DigestResult, FeedConfig, FeedHealth, FeedItem } from './types'

function App() {
  const articlesPerPage = 30
  const collapsedSummaryLength = 190
  const [feeds, setFeeds] = useState<FeedConfig[]>(() => loadStoredFeeds())
  const [articles, setArticles] = useState<FeedItem[]>([])
  const [feedHealth, setFeedHealth] = useState<FeedHealth[]>([])
  const [digest, setDigest] = useState<DigestResult>(() => createEmptyDigest())
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('Alle')
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null)
  const [expandedArticleIds, setExpandedArticleIds] = useState<string[]>([])
  const [currentArticlePage, setCurrentArticlePage] = useState(0)
  const [draftFeedName, setDraftFeedName] = useState('')
  const [draftFeedUrl, setDraftFeedUrl] = useState('')
  const [draftFeedTopic, setDraftFeedTopic] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDigestLoading, setIsDigestLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const digestRequestIdRef = useRef(0)
  const streamPanelRef = useRef<HTMLElement | null>(null)
  const hasMountedArticlePaginationRef = useRef(false)

  async function refreshFeeds(activeFeeds: FeedConfig[]) {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await loadConfiguredFeeds(activeFeeds)

      startTransition(() => {
        setArticles(result.items)
        setFeedHealth(result.health)
        setLastUpdated(new Date().toISOString())
        setErrorMessage(result.message)
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Beim Aktualisieren der Feeds ist ein Problem aufgetreten.'

      startTransition(() => {
        setArticles([])
        setFeedHealth([])
        setErrorMessage(message)
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshFeeds(feeds)
    })
  }, [feeds])

  useEffect(() => {
    if (!hasMountedArticlePaginationRef.current) {
      hasMountedArticlePaginationRef.current = true
      return
    }

    streamPanelRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [currentArticlePage])

  function handleAddFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = draftFeedName.trim()
    const trimmedUrl = draftFeedUrl.trim()
    const trimmedTopic = draftFeedTopic.trim() || 'Allgemein'

    if (!trimmedName || !trimmedUrl) {
      setErrorMessage('Bitte gib mindestens einen Namen und eine gueltige Feed-URL ein.')
      return
    }

    const newFeed: FeedConfig = {
      id: createFeedId(`${trimmedName}-${Date.now()}`),
      name: trimmedName,
      url: trimmedUrl,
      topic: trimmedTopic,
    }

    const nextFeeds = [...feeds, newFeed]
    saveStoredFeeds(nextFeeds)
    setFeeds(nextFeeds)
    setDraftFeedName('')
    setDraftFeedUrl('')
    setDraftFeedTopic('')
    setSelectedFeedId(null)
    setErrorMessage('')
  }

  function handleDeleteFeed(feedId: string) {
    const nextFeeds = feeds.filter((feed) => feed.id !== feedId)
    saveStoredFeeds(nextFeeds)
    setFeeds(nextFeeds)
    setSelectedFeedId(null)
  }

  function toggleArticleExpansion(article: FeedItem) {
    setExpandedArticleIds((current) =>
      current.includes(article.id)
        ? current.filter((currentId) => currentId !== article.id)
        : [...current, article.id],
    )
  }

  function getCollapsedSummary(summary: string) {
    if (summary.length <= collapsedSummaryLength) {
      return summary
    }

    return `${summary.slice(0, collapsedSummaryLength).trimEnd()}...`
  }

  function handleExportFeeds() {
    const exportBlob = new Blob([JSON.stringify(feeds, null, 2)], {
      type: 'application/json',
    })
    const exportUrl = window.URL.createObjectURL(exportBlob)
    const downloadLink = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)

    downloadLink.href = exportUrl
    downloadLink.download = `pulseboard-feeds-${stamp}.json`
    downloadLink.click()
    window.URL.revokeObjectURL(exportUrl)
    setErrorMessage('')
  }

  async function handleImportFeeds(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    try {
      const rawValue = await selectedFile.text()
      const importedFeeds = parseStoredFeeds(rawValue)

      if (!importedFeeds) {
        throw new Error('Die Importdatei muss eine gueltige Feed-Liste enthalten.')
      }

      saveStoredFeeds(importedFeeds)
      setFeeds(importedFeeds)
      setSelectedFeedId(null)
      setErrorMessage('')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Der Import ist fehlgeschlagen. Bitte verwende einen gueltigen JSON-Export.'
      setErrorMessage(message)
    } finally {
      event.target.value = ''
    }
  }

  const displayedFeedHealth = feeds.map((feed) => {
    return (
      feedHealth.find((healthItem) => healthItem.id === feed.id) ?? {
        id: feed.id,
        name: feed.name,
        topic: feed.topic,
        status: 'offline' as const,
      }
    )
  })
  const availableTopics = ['Alle', ...new Set(articles.map((article) => article.topic))]
  const normalizedQuery = deferredSearchTerm.trim().toLowerCase()
  const filteredArticles = articles.filter((article) => {
    const matchesTopic = selectedTopic === 'Alle' || article.topic === selectedTopic
    const haystack = `${article.title} ${article.summary} ${article.source}`.toLowerCase()
    const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery)

    return matchesTopic && matchesQuery
  })
  const totalArticlePages = Math.max(1, Math.ceil(filteredArticles.length / articlesPerPage))
  const currentPage = Math.min(currentArticlePage, totalArticlePages - 1)
  const pageStart = currentPage * articlesPerPage
  const visibleArticles = filteredArticles.slice(pageStart, pageStart + articlesPerPage)
  const activeSources = displayedFeedHealth.filter((feed) => feed.status === 'online').length

  function handleTopicSelect(topic: string) {
    setSelectedTopic(topic)
    setCurrentArticlePage(0)
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value)
    setCurrentArticlePage(0)
  }

  useEffect(() => {
    const requestId = digestRequestIdRef.current + 1
    digestRequestIdRef.current = requestId

    if (articles.length === 0) {
      queueMicrotask(() => {
        if (digestRequestIdRef.current !== requestId) {
          return
        }

        setDigest(createEmptyDigest())
        setIsDigestLoading(false)
      })

      return
    }

    const scaffoldDigest = createDigestScaffold(articles, displayedFeedHealth)

    queueMicrotask(() => {
      if (digestRequestIdRef.current !== requestId) {
        return
      }

      setDigest(scaffoldDigest)
      setIsDigestLoading(true)
    })

    let completed = 0
    const total = displayedFeedHealth.length
    let fallbackCount = 0

    displayedFeedHealth.forEach((channel) => {
      void createChannelDigestSection(channel, articles).then((result) => {
        if (digestRequestIdRef.current !== requestId) {
          return
        }

        completed += 1
        if (result.mode === 'fallback') {
          fallbackCount += 1
        }

        const statusNote =
          completed < total
            ? fallbackCount > 0
              ? `${completed} von ${total} Kanalzusammenfassungen sind bereit. ${fallbackCount} davon verwenden aktuell die lokale Zusammenfassung.`
              : `${completed} von ${total} Kanalzusammenfassungen sind bereit. Du kannst schon lesen, waehrend der Rest noch erzeugt wird.`
            : fallbackCount === 0
              ? 'Alle Kanalzusammenfassungen wurden über den konfigurierten Llama-Endpunkt erstellt.'
              : fallbackCount === total
                ? 'Alle Kanalzusammenfassungen verwenden aktuell die lokale Zusammenfassung, weil der Llama-Endpunkt keine verwertbare Antwort geliefert hat.'
                : `${fallbackCount} von ${total} Kanalzusammenfassungen verwenden aktuell die lokale Zusammenfassung, weil der Llama-Endpunkt nicht fuer alle Kanaele erfolgreich geantwortet hat.`

        setDigest((current) => ({
          ...current,
          statusNote,
          sections: current.sections.map((currentSection) =>
            currentSection.title === result.section.title ? result.section : currentSection,
          ),
        }))

        if (completed >= total) {
          setIsDigestLoading(false)
        }
      })
    })

    return () => {
      if (digestRequestIdRef.current === requestId) {
        digestRequestIdRef.current += 1
      }
    }
  }, [articles, feedHealth, feeds])

  return (
    <main className="app-shell">
      {/* Header */}
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">RSS-Reader mit Digest-Fokus</span>
          <h1>Stay current without scanning tabs.</h1>
          <p className="hero-text">
            Pulseboard fasst mehrere RSS-Feeds in einer schnellen Übersicht zusammen und
            haelt die Originalartikel direkt griffbereit, wenn du mehr Details brauchst.
          </p>
        </div>

        <div className="hero-actions">
          <button
            className="primary-button"
            onClick={() => void refreshFeeds(feeds)}
            disabled={isLoading}
          >
            {isLoading ? 'Feeds werden geladen...' : 'Digest aktualisieren'}
          </button>
          <p className="status-copy">
            {lastUpdated
              ? `Aktualisiert ${formatDistanceFromNow(lastUpdated)}`
              : 'Bereit, gespeicherte Feeds zu laden'}
          </p>
        </div>
      </section>

      {/* 4 Boxen */}
      <section className="metrics-grid" aria-label="Digest-Metriken">
        <article className="metric-card emphasis">
          <span className="metric-label">Zusammenfassungsmodus</span>
          <strong>{appConfig.summaryModeLabel}</strong>
          <p>{appConfig.summaryModeDescription}</p>
        </article>

        <article className="metric-card">
          <span className="metric-label">Quellen online</span>
          <strong>
            {activeSources}/{displayedFeedHealth.length}
          </strong>
          <p>Feeds werden im lokalen Speicher gesichert, dadurch bleibt das Setup schlank.</p>
        </article>

        <article className="metric-card">
          <span className="metric-label">Digest-Abdeckung</span>
          <strong>{digest.coverageLabel}</strong>
          <p>Die Oberfläche priorisiert gebündelte Zusammenfassungen vor einzelnen Rohmeldungen.</p>
        </article>

        <article className="metric-card">
          <span className="metric-label">Antwortziel</span>
          <strong>&lt; 3 Sekunden</strong>
          <p>Der Digest-Proxy kapselt die Modellintegration und macht spätere Wechsel einfacher.</p>
        </article>
      </section>

      {/* Feed Search */}
      <section className="stacked-layout">
        <article className="panel control-panel">

          {/* Header of the Box */}
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Feed-Steuerung</span>
              <h2>Stream filtern</h2>
            </div>
          </div>
          
          {/* Search Field */}
          <label className="field">
            <span>Schlagzeilen durchsuchen</span>
            <input
              type="search"
              placeholder="Nach Thema, Quelle oder Stichwort suchen"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>
          
          {/* Filter Buttons */}
          <div className="topic-list" role="tablist" aria-label="Themenfilter">
            {availableTopics.map((topic) => (
              <button
                key={topic}
                className={topic === selectedTopic ? 'topic-chip active' : 'topic-chip'}
                onClick={() => handleTopicSelect(topic)}
                type="button"
              >
                {topic}
              </button>
            ))}
          </div>
        </article>

        <article className="panel digest-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Heutiger Digest</span>
              <h2>{digest.headline}</h2>
            </div>
            <span className={`pill ${isDigestLoading || isPending ? 'pill-live' : ''}`}>
              {isDigestLoading ? 'Digest wird erstellt' : digest.engineLabel}
            </span>
          </div>

          <p className="digest-intro">{digest.intro}</p>
          <p className="digest-status">{digest.statusNote}</p>

          <div className="digest-section-list">
            {digest.sections.map((section) => (
              <section key={section.title} className="digest-section">
                <div className="digest-section-header">
                  <h3>{section.title}</h3>
                  <span>{section.theme}</span>
                </div>
                <p>{section.summary}</p>
              </section>
            ))}
          </div>

          <div className="digest-summary-grid">
            <article className="digest-summary-card">
              <span className="panel-kicker">Heute im Fokus</span>
              <p>{digest.takeaway}</p>
            </article>
            <article className="digest-summary-card">
              <span className="panel-kicker">Nächster Trend</span>
              <p>{digest.watchlist}</p>
            </article>
          </div>
        </article>
      </section>

        <section ref={streamPanelRef} className="panel stream-panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Roh-Feed</span>
            <h2>Artikel, wenn du tiefer einsteigen willst</h2>
          </div>
          <span className="pill">{filteredArticles.length} passende Artikel</span>
        </div>

        <div className="stream-list">
          {visibleArticles.map((article) => {
            const isExpanded = expandedArticleIds.includes(article.id)
            const displayedSummary = isExpanded ? article.summary : getCollapsedSummary(article.summary)

            return (
              <article key={article.id} className="story-card">
                <div className="story-meta">
                  <span>{article.source}</span>
                  <span>{formatDistanceFromNow(article.publishedAt)}</span>
                </div>
                <h3>{article.title}</h3>
                <button
                  type="button"
                  className={isExpanded ? 'story-summary-toggle is-expanded' : 'story-summary-toggle'}
                  onClick={() => {
                    toggleArticleExpansion(article)
                  }}
                >
                  <span className={isExpanded ? 'story-summary-expanded' : 'story-summary-collapsed'}>
                    {displayedSummary}
                  </span>
                </button>
                <div className="story-footer">
                  <span className="topic-tag">{article.topic}</span>
                  <a className="story-link" href={article.link} target="_blank" rel="noreferrer">
                    Artikel öffnen
                  </a>
                </div>
              </article>
            )
          })}
        </div>
        <div className="pagination-row">
          <button
            className="pagination-button"
            type="button"
            disabled={currentPage === 0}
            onClick={() => {
              setCurrentArticlePage((page) => Math.max(page - 1, 0))
            }}
          >
            Vorherige 30
          </button>
          <span className="pagination-status">
            Seite {currentPage + 1} von {totalArticlePages}
          </span>
          <button
            className="pagination-button"
            type="button"
            disabled={currentPage >= totalArticlePages - 1}
            onClick={() => {
              setCurrentArticlePage((page) => Math.min(page + 1, totalArticlePages - 1))
            }}
          >
            Nächste 30
          </button>
        </div>
      </section>

        <article
        className="panel source-panel"
        onClick={() => {
          setSelectedFeedId(null)
        }}
      >
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Quellenstatus</span>
            <h2>Feeds verwalten</h2>
          </div>
          <div
            className="source-actions"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <input
              ref={importInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={handleImportFeeds}
              tabIndex={-1}
            />
            <button
              className="icon-action-button"
              type="button"
              aria-label="RSS-Liste als JSON-Datei exportieren"
              title="Feed-Liste exportieren"
              onClick={handleExportFeeds}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.41l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.41L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              className="icon-action-button"
              type="button"
              aria-label="RSS-Liste aus JSON-Datei importieren und gespeicherte Feeds überschreiben"
              title="Feed-Liste importieren und gespeicherte Feeds überschreiben"
              onClick={() => {
                importInputRef.current?.click()
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M19 16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v1h12v-1a1 1 0 0 1 1-1ZM12 4a1 1 0 0 1 .7.29l4 4a1 1 0 1 1-1.4 1.41L13 7.41V16a1 1 0 1 1-2 0V7.41L8.7 9.7a1 1 0 0 1-1.4-1.41l4-4A1 1 0 0 1 12 4Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>

        <form
          className="feed-form"
          onSubmit={handleAddFeed}
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <label className="field feed-form-url">
            <span>Feed URL</span>
            <input
              type="url"
              placeholder="https://example.com/feed.xml"
              value={draftFeedUrl}
              onChange={(event) => setDraftFeedUrl(event.target.value)}
            />
          </label>

          <div className="feed-form-row">
            <label className="field">
              <span>Feed-Name</span>
              <input
                type="text"
                placeholder="NASA Earth Science"
                value={draftFeedName}
                onChange={(event) => setDraftFeedName(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Thema</span>
              <input
                type="text"
                placeholder="Erdwissenschaften"
                value={draftFeedTopic}
                onChange={(event) => setDraftFeedTopic(event.target.value)}
              />
            </label>

            <button className="primary-button feed-submit" type="submit">
              Feed hinzufügen
            </button>
          </div>
        </form>

        <ul className="source-list">
          {displayedFeedHealth.map((feed) => (
            <li
              key={feed.id}
              className={`source-item source-${feed.status}`}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedFeedId((current) => (current === feed.id ? null : feed.id))
              }}
            >
              <div>
                <strong>{feed.name}</strong>
                <span>{feed.topic}</span>
              </div>
              {selectedFeedId === feed.id ? (
                <button
                  className="delete-feed-button"
                  type="button"
                  aria-label={`${feed.name} loeschen`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDeleteFeed(feed.id)
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="delete-feed-icon">
                    <path
                      d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v7h-2v-7Zm4 0h2v7h-2v-7ZM7 10h2v7H7v-7Zm-1 10V8h12v12H6Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {displayedFeedHealth.length === 0 ? (
          <p className="empty-state">Noch keine Feeds gespeichert. Füge oben einen Feed hinzu, um den Digest zu starten.</p>
        ) : null}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </article>
    </main>
  )
}

export default App
