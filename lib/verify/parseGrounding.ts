/**
 * Parse Gemini groundingMetadata into an allowlist of web sources.
 *
 * Only groundingChunks[].web.uri are trusted. Model-invented URLs must never
 * enter the allowlist. Empty grounding can never yield status "corroborated".
 */

import type { SourceLink } from "@/lib/types/debate";

export type ParsedGrounding = {
  webSearchQueries: string[];
  sources: SourceLink[];
};

type LooseGrounding = {
  webSearchQueries?: unknown;
  groundingChunks?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeUri(uri: string): string {
  return uri.trim();
}

/**
 * Extract deduped grounded web sources + search queries from groundingMetadata.
 */
export function parseGroundingMetadata(metadata: unknown): ParsedGrounding {
  const root = asRecord(metadata) as LooseGrounding | null;
  if (!root) {
    return { webSearchQueries: [], sources: [] };
  }

  const webSearchQueries = Array.isArray(root.webSearchQueries)
    ? [
        ...new Set(
          root.webSearchQueries
            .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
            .map((q) => q.trim()),
        ),
      ]
    : [];

  const sources: SourceLink[] = [];
  const seen = new Set<string>();

  if (Array.isArray(root.groundingChunks)) {
    for (const chunk of root.groundingChunks) {
      const rec = asRecord(chunk);
      const web = asRecord(rec?.web);
      const uriRaw = web?.uri;
      if (typeof uriRaw !== "string") continue;
      const uri = normalizeUri(uriRaw);
      if (!uri || seen.has(uri)) continue;
      // Basic URI sanity — reject obviously non-http(s) junk
      if (!/^https?:\/\//i.test(uri)) continue;
      seen.add(uri);

      const title =
        typeof web?.title === "string" && web.title.trim()
          ? web.title.trim()
          : undefined;
      const domain =
        typeof web?.domain === "string" && web.domain.trim()
          ? web.domain.trim()
          : undefined;

      sources.push({
        uri,
        ...(title ? { title } : {}),
        ...(domain ? { domain } : {}),
      });
    }
  }

  return { webSearchQueries, sources };
}

/** True only when at least one grounded source exists. */
export function canCorroborate(sources: SourceLink[]): boolean {
  return sources.length > 0;
}

/**
 * Keep only URIs present in the grounding allowlist (order follows selectedUris).
 * Never trusts URIs outside the allowlist.
 */
export function filterAllowlistedSources(
  selectedUris: string[],
  allowlist: SourceLink[],
): SourceLink[] {
  const byUri = new Map(allowlist.map((s) => [s.uri, s] as const));
  const out: SourceLink[] = [];
  const seen = new Set<string>();

  for (const raw of selectedUris) {
    if (typeof raw !== "string") continue;
    const uri = normalizeUri(raw);
    if (!uri || seen.has(uri)) continue;
    const hit = byUri.get(uri);
    if (!hit) continue;
    seen.add(uri);
    out.push(hit);
  }

  return out;
}
