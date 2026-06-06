import { shortAddr } from './format'

// ─────────────────────────────────────────────────────────────────────────────
// Creator self-attribution. Three ways a creator can claim an index, in priority
// order: a typed/pasted X (Twitter) handle → a free-text display name → (blank)
// their on-chain deploy address. Pure client-side — no OAuth, no network — so it
// works with the static / IPFS build. "Connecting X" here means normalizing +
// linking a handle the creator provides, not an OAuth login (which would need a
// server). Ownership is unverified, like most launchpads; a signature/tweet proof
// can bolt on later via the `verified` channel without changing callers.
//
// This is the single source of truth for the fallback chain — display sites call
// `resolveCreator`/`resolveCreatorFromMeta` instead of re-implementing it.
// ─────────────────────────────────────────────────────────────────────────────

// X username rules: 1–15 chars, letters / digits / underscore only.
const X_USERNAME = /^[A-Za-z0-9_]{1,15}$/

/**
 * Normalize any X handle input → canonical `{ handle: '@foo', url }`. Accepts
 * '@foo', 'foo', 'x.com/foo', 'twitter.com/foo', or a full profile URL (query /
 * trailing slash tolerated). Returns null for empty or invalid input.
 */
export function normalizeXHandle(input?: string | null): { handle: string; url: string } | null {
  if (!input) return null
  let s = input.trim()
  if (!s) return null
  s = s.replace(/^https?:\/\//i, '').replace(/^(www\.)?(x|twitter)\.com\//i, '')
  s = s.split(/[/?#]/)[0] // drop any path / query / hash
  s = s.replace(/^@+/, '') // drop leading @(s)
  if (!X_USERNAME.test(s)) return null
  return { handle: `@${s}`, url: `https://x.com/${s}` }
}

export type CreatorKind = 'x' | 'name' | 'address'

export interface ResolvedCreator {
  /** What to render: '@colbysayshi', 'Colby', or '0x1234…abcd'. */
  label: string
  kind: CreatorKind
  /** x.com profile URL when kind === 'x', else null. */
  xUrl: string | null
  /** Underlying address (deployer when known, else the index) for avatars / links. */
  address: string | null
}

export interface CreatorInput {
  handle?: string | null
  name?: string | null
  /** A stored x.com URL (registry/back-compat) used if `handle` is absent. */
  xUrl?: string | null
  /** On-chain deployer — the blank-attribution fallback. */
  deployer?: string | null
  /** Last-ditch fallback if there's no deployer either. */
  indexAddress?: string | null
}

/**
 * The attribution fallback chain:
 *   valid X handle → typed display name → on-chain deployer → index address.
 */
export function resolveCreator(input: CreatorInput): ResolvedCreator {
  const x = normalizeXHandle(input.handle) ?? normalizeXHandle(input.xUrl)
  if (x) return { label: x.handle, kind: 'x', xUrl: x.url, address: input.deployer ?? null }

  const name = input.name?.trim()
  if (name) return { label: name, kind: 'name', xUrl: null, address: input.deployer ?? null }

  if (input.deployer)
    return { label: shortAddr(input.deployer), kind: 'address', xUrl: null, address: input.deployer }

  const idx = input.indexAddress
  return { label: idx ? shortAddr(idx) : '—', kind: 'address', xUrl: null, address: idx ?? null }
}

/** Resolve straight from the metadata registry shape + the reader's deployer. */
export function resolveCreatorFromMeta(
  meta: { creatorHandle?: string; creatorName?: string; xUrl?: string },
  deployer?: string | null,
  indexAddress?: string | null,
): ResolvedCreator {
  return resolveCreator({
    handle: meta.creatorHandle,
    name: meta.creatorName,
    xUrl: meta.xUrl,
    deployer,
    indexAddress,
  })
}
