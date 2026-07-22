import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react"
import type { ChangeEvent, FormEvent } from "react"
import "./App.css"
import { createFeedId, loadStoredFeeds, parseStoredFeeds, saveStoredFeeds } from "./lib/feedStorage"
import { loadConfiguredFeeds } from "./lib/rss"
import { formatDistanceFromNow } from "./lib/time"
import type { FeedConfig, FeedHealth, FeedItem } from "./types"

function App() {
  const articlesPerPage = 30
  const collapsedSummaryLength = 190
  const [feeds, setFeeds] = useState<FeedConfig[]>(() => loadStoredFeeds())
  const [articles, setArticles] = useState<FeedItem[]>([])
  const [feedHealth, setFeedHealth] = useState<FeedHealth[]>([])
  const [lastUpdated, setLastUpdated] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTopic, setSelectedTopic] = useState("Alle")
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null)
  const [expandedArticleIds, setExpandedArticleIds] = useState<string[]>([])
  const [currentArticlePage, setCurrentArticlePage] = useState(0)
  const [draftFeedName, setDraftFeedName] = useState("")
  const [draftFeedUrl, setDraftFeedUrl] = useState("")
  const [draftFeedTopic, setDraftFeedTopic] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const streamPanelRef = useRef<HTMLElement | null>(null)
  const hasMountedArticlePaginationRef = useRef(false)

  async function refreshFeeds(activeFeeds: FeedConfig[]) {
    setIsLoading(true)
    setErrorMessage("")

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
        error instanceof Error ? error.message : "Beim Aktualisieren der Feeds ist ein Problem aufgetreten."

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
      behavior: "smooth",
      block: "start",
    })
  }, [currentArticlePage])

  function handleAddFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = draftFeedName.trim()
    const trimmedUrl = draftFeedUrl.trim()
    const trimmedTopic = draftFeedTopic.trim() || "Allgemein"

    if (!trimmedName || !trimmedUrl) {
      setErrorMessage("Bitte gib mindestens einen Namen und eine gueltige Feed-URL ein.")
      return
    }

    const newFeed: FeedConfig = {
      id: createFeedId(trimmedName + "-" + Date.now()),
      name: trimmedName,
      url: trimmedUrl,
      topic: trimmedTopic,
    }

    const nextFeeds = [...feeds, newFeed]
    saveStoredFeeds(nextFeeds)
    setFeeds(nextFeeds)
    setDraftFeedName("")
    setDraftFeedUrl("")
    setDraftFeedTopic("")
    setSelectedFeedId(null)
    setErrorMessage("")
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

    return summary.slice(0, collapsedSummaryLength).trimEnd() + "..."
  }

  function handleExportFeeds() {
    const exportBlob = new Blob([JSON.stringify(feeds, null, 2)], {
      type: "application/json",
    })
    const exportUrl = window.URL.createObjectURL(exportBlob)
    const downloadLink = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)

    downloadLink.href = exportUrl
    downloadLink.download = "pulseboard-feeds-" + stamp + ".json"
    downloadLink.click()
    window.URL.revokeObjectURL(exportUrl)
    setErrorMessage("")
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
        throw new Error("Die Importdatei muss eine gueltige Feed-Liste enthalten.")
      }

      saveStoredFeeds(importedFeeds)
      setFeeds(importedFeeds)
      setSelectedFeedId(null)
      setErrorMessage("")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Der Import ist fehlgeschlagen. Bitte verwende einen gueltigen JSON-Export."
      setErrorMessage(message)
    } finally {
      event.target.value = ""
    }
  }

  const displayedFeedHealth = feeds.map((feed) => {
    return (
      feedHealth.find((healthItem) => healthItem.id === feed.id) ?? {
        id: feed.id,
        name: feed.name,
        topic: feed.topic,
        status: "offline" as const,
      }
    )
  })
  const availableTopics = ["Alle", ...new Set(articles.map((article) => article.topic))]
  const normalizedQuery = deferredSearchTerm.trim().toLowerCase()
  const filteredArticles = articles.filter((article) => {
    const matchesTopic = selectedTopic === "Alle" || article.topic === selectedTopic
    const haystack = (article.title + " " + article.summary + " " + article.source).toLowerCase()
    const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery)

    return matchesTopic && matchesQuery
  })
  const totalArticlePages = Math.max(1, Math.ceil(filteredArticles.length / articlesPerPage))
  const currentPage = Math.min(currentArticlePage, totalArticlePages - 1)
  const pageStart = currentPage * articlesPerPage
  const visibleArticles = filteredArticles.slice(pageStart, pageStart + articlesPerPage)
  const activeSources = displayedFeedHealth.filter((feed) => feed.status === "online").length

  function handleTopicSelect(topic: string) {
    setSelectedTopic(topic)
    setCurrentArticlePage(0)
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value)
    setCurrentArticlePage(0)
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">RSS-Reader fuer Kanäle und Filter</span>
          <h1>Behalte deine Feeds im Blick.</h1>
          <p className="hero-text">
            Pulseboard sammelt mehrere RSS-Quellen an einem Ort, merkt sich deine Kanäle lokal im Browser
            und hilft dir beim schnellen Filtern der relevanten Artikel.
          </p>
        </div>

        <div className="hero-actions">
          <button className="primary-button" onClick={() => void refreshFeeds(feeds)} disabled={isLoading}>
            {isLoading ? "Feeds werden geladen..." : "Feeds aktualisieren"}
          </button>
          <p className="status-copy">
            {lastUpdated ? "Aktualisiert " + formatDistanceFromNow(lastUpdated) : "Bereit, gespeicherte Feeds zu laden"}
          </p>
        </div>
      </section>

      <section className="metrics-grid" aria-label="RSS-Metriken">
        <article className="metric-card emphasis">
          <span className="metric-label">Gespeicherte Feeds</span>
          <strong>{feeds.length}</strong>
          <p>Deine RSS-Kanäle bleiben lokal gespeichert und können jederzeit exportiert werden.</p>
        </article>

        <article className="metric-card">
          <span className="metric-label">Quellen online</span>
          <strong>
            {activeSources}/{displayedFeedHealth.length}
          </strong>
          <p>So siehst du sofort, wie viele deiner gespeicherten Kanäle aktuell erreichbar sind.</p>
        </article>

        <article className="metric-card">
          <span className="metric-label">Geladene Artikel</span>
          <strong>{articles.length}</strong>
          <p>Alle Treffer aus den aktiven Feeds landen direkt im Stream und in den Filtern.</p>
        </article>

        <article className="metric-card">
          <span className="metric-label">Filtertreffer</span>
          <strong>{filteredArticles.length}</strong>
          <p>Suche und Themenfilter reduzieren den Stream sofort auf die relevanten Meldungen.</p>
        </article>
      </section>

      <section className="stacked-layout">
        <article className="panel control-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Feed-Steuerung</span>
              <h2>Stream filtern</h2>
            </div>
            <span className={"pill " + (isLoading || isPending ? "pill-live" : "")}>
              {selectedTopic === "Alle" ? "Alle Themen" : selectedTopic}
            </span>
          </div>

          <label className="field">
            <span>Schlagzeilen durchsuchen</span>
            <input
              type="search"
              placeholder="Nach Thema, Quelle oder Stichwort suchen"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="topic-list" role="tablist" aria-label="Themenfilter">
            {availableTopics.map((topic) => (
              <button
                key={topic}
                className={topic === selectedTopic ? "topic-chip active" : "topic-chip"}
                onClick={() => handleTopicSelect(topic)}
                type="button"
              >
                {topic}
              </button>
            ))}
          </div>
        </article>
      </section>

      <section ref={streamPanelRef} className="panel stream-panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Artikel-Stream</span>
            <h2>Aktuelle Meldungen aus deinen Kanälen</h2>
          </div>
          <span className="pill">{filteredArticles.length} passende Artikel</span>
        </div>

        {visibleArticles.length > 0 ? (
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
                    className={isExpanded ? "story-summary-toggle is-expanded" : "story-summary-toggle"}
                    onClick={() => {
                      toggleArticleExpansion(article)
                    }}
                  >
                    <span className={isExpanded ? "story-summary-expanded" : "story-summary-collapsed"}>
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
        ) : (
          <p className="empty-state">Keine Artikel passen aktuell zu deinem Suchbegriff oder Themenfilter.</p>
        )}

        {filteredArticles.length > 0 ? (
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
        ) : null}
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
              aria-label="RSS-Liste aus JSON-Datei importieren und gespeicherte Feeds ueberschreiben"
              title="Feed-Liste importieren und gespeicherte Feeds ueberschreiben"
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
              className={"source-item source-" + feed.status}
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
                  aria-label={feed.name + " löschen"}
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
          <p className="empty-state">Noch keine Feeds gespeichert. Füge oben einen Feed hinzu, um deinen Stream aufzubauen.</p>
        ) : null}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </article>
    </main>
  )
}

export default App
