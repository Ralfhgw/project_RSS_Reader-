/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RSS_PROXY?: string
  readonly VITE_MAX_ITEMS_PER_FEED?: string
  readonly VITE_SUMMARY_MODE?: string
  readonly VITE_SUMMARY_MODE_DESCRIPTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
