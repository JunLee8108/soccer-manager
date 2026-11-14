import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'squad' }
  | { name: 'player'; id: string }
  | { name: 'tactics' }
  | { name: 'match' }
  | { name: 'report' }
  | { name: 'league' }
  | { name: 'club' }
  | { name: 'inbox' }
  | { name: 'season' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (parts[0]) {
    case 'squad':
      return { name: 'squad' }
    case 'player':
      return parts[1] ? { name: 'player', id: decodeURIComponent(parts[1]) } : { name: 'squad' }
    case 'tactics':
      return { name: 'tactics' }
    case 'match':
      return { name: 'match' }
    case 'report':
      return { name: 'report' }
    case 'league':
      return { name: 'league' }
    case 'club':
      return { name: 'club' }
    case 'inbox':
      return { name: 'inbox' }
    case 'season':
      return { name: 'season' }
    default:
      return { name: 'home' }
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  return parseHash(hash)
}

export const href = (path: string) => `#/${path}`

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const target = href(path)
  if (opts.replace) window.location.replace(target)
  else window.location.hash = target
}

export function goBack(fallback: string) {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback, { replace: true })
}
