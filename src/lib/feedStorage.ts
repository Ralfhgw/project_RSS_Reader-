import { defaultFeeds } from './config'
import type { FeedConfig } from '../types'

const STORAGE_KEY = 'pulseboard.feeds'

function isValidFeedConfig(value: unknown): value is FeedConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.topic === 'string'
  )
}

export function createFeedId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseStoredFeeds(rawValue: string) {
  try {
    const parsedValue = JSON.parse(rawValue)

    if (!Array.isArray(parsedValue)) {
      return null
    }

    if (parsedValue.every(isValidFeedConfig)) {
      return parsedValue
    }
  } catch {
    // Ignore malformed imports and fall back to defaults.
  }

  return null
}

export function loadStoredFeeds() {
  if (typeof window === 'undefined') {
    return defaultFeeds
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultFeeds))
    return defaultFeeds
  }

  const storedFeeds = parseStoredFeeds(rawValue)

  if (storedFeeds) {
    return storedFeeds
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultFeeds))
  return defaultFeeds
}

export function saveStoredFeeds(feeds: FeedConfig[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds))
}
