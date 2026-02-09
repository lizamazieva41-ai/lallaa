import fs from 'fs';
import path from 'path';
import axios from 'axios';

import { MergedRecord } from './merge';

export interface BinlistBank {
  name?: string;
  url?: string;
  phone?: string;
  city?: string;
}

export interface BinlistCountry {
  name?: string;
  alpha2?: string;
  numeric?: string;
  emoji?: string;
  currency?: string;
  latitude?: number;
  longitude?: number;
}

export interface BinlistResponse {
  scheme?: string;
  type?: string;
  brand?: string;
  prepaid?: boolean;
  country?: BinlistCountry;
  bank?: BinlistBank;
}

export interface EnrichBinlistOptions {
  /**
   * Hard cap of how many records we will attempt to enrich per run.
   * This exists because binlist.net has strict rate limiting for unauthenticated usage.
   */
  enrichLimit: number;
  /**
   * Delay between requests in milliseconds.
   * Default is conservative to avoid tripping remote rate limits.
   */
  delayMs: number;
  /**
   * Where to store cache JSON (keyed by BIN) to avoid repeated lookups.
   */
  cacheFilePath: string;
  /**
   * Only call the API when key fields are missing.
   */
  onlyIfMissing: boolean;
  /**
   * Request timeout.
   */
  timeoutMs: number;
}

interface CacheEntry {
  fetchedAt: string;
  data: BinlistResponse | null;
  error?: string;
}

type BinlistCache = Record<string, CacheEntry>;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeReadCache(cacheFilePath: string): BinlistCache {
  try {
    if (!fs.existsSync(cacheFilePath)) return {};
    const raw = fs.readFileSync(cacheFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BinlistCache;
  } catch {
    return {};
  }
}

function safeWriteCache(cacheFilePath: string, cache: BinlistCache): void {
  const dir = path.dirname(cacheFilePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
}

function shouldEnrich(record: MergedRecord): boolean {
  // Focus on filling issuer/bank contact fields; countryCode is already required in our pipeline.
  const missingIssuer = !record.issuer;
  const missingUrl = !record.url;
  const missingPhone = !record.phone;
  const missingCity = !record.city;
  const missingCountryName = !record.country;
  const missingScheme = !record.scheme;
  const missingBrand = !record.brand;
  return (
    missingIssuer ||
    missingUrl ||
    missingPhone ||
    missingCity ||
    missingCountryName ||
    missingScheme ||
    missingBrand
  );
}

async function fetchBinlist(bin: string, timeoutMs: number): Promise<BinlistResponse | null> {
  try {
    // Public API endpoint documented on binlist.net
    const url = `https://lookup.binlist.net/${encodeURIComponent(bin)}`;
    const res = await axios.get(url, {
      timeout: timeoutMs,
      validateStatus: () => true,
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.status === 404) return null;
    if (res.status === 429) {
      // Caller will backoff via delayMs; surface as an error for observability/caching.
      throw new Error('HTTP 429 (rate limited)');
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.data as BinlistResponse;
  } catch (err) {
    throw new Error((err as Error).message);
  }
}

export async function enrichWithBinlist(
  records: MergedRecord[],
  opts: EnrichBinlistOptions
): Promise<{
  enriched: number;
  attempted: number;
  cacheHits: number;
  errors: number;
}> {
  const cache = safeReadCache(opts.cacheFilePath);
  let attempted = 0;
  let enriched = 0;
  let cacheHits = 0;
  let errors = 0;

  for (const record of records) {
    if (attempted >= opts.enrichLimit) break;

    if (opts.onlyIfMissing && !shouldEnrich(record)) {
      continue;
    }

    attempted++;
    const key = record.bin;
    const cached = cache[key];
    let data: BinlistResponse | null = null;

    if (cached) {
      cacheHits++;
      data = cached.data;
    } else {
      try {
        data = await fetchBinlist(key, opts.timeoutMs);
        cache[key] = { fetchedAt: new Date().toISOString(), data };
        safeWriteCache(opts.cacheFilePath, cache);
      } catch (err) {
        errors++;
        cache[key] = {
          fetchedAt: new Date().toISOString(),
          data: null,
          error: (err as Error).message,
        };
        safeWriteCache(opts.cacheFilePath, cache);
        await sleep(opts.delayMs);
        continue;
      }
    }

    if (data) {
      const before = {
        scheme: record.scheme,
        brand: record.brand,
        type: record.type,
        issuer: record.issuer,
        country: record.country,
        countryCode: record.countryCode,
        url: record.url,
        phone: record.phone,
        city: record.city,
      };

      // Apply only missing fields; do not override existing high-priority values.
      record.scheme = record.scheme || data.scheme || null;
      record.brand = record.brand || data.brand || null;
      record.type = record.type || data.type || null;

      record.issuer = record.issuer || data.bank?.name || null;
      record.country = record.country || data.country?.name || null;
      record.countryCode = record.countryCode || data.country?.alpha2 || null;

      record.url = record.url || data.bank?.url || null;
      record.phone = record.phone || data.bank?.phone || null;
      record.city = record.city || data.bank?.city || null;

      const changed =
        record.scheme !== before.scheme ||
        record.brand !== before.brand ||
        record.type !== before.type ||
        record.issuer !== before.issuer ||
        record.country !== before.country ||
        record.countryCode !== before.countryCode ||
        record.url !== before.url ||
        record.phone !== before.phone ||
        record.city !== before.city;

      // Preserve original record.source/sourceVersion chosen by merge priority.
      // Append enrichment provenance into record.sources[] instead.
      if (changed) {
        record.lastUpdated = new Date();
        record.sources.push({
          source: 'binlist.net',
          sourceVersion: 'api',
          confidence: record.confidence,
          fields: {
            scheme: record.scheme,
            brand: record.brand,
            type: record.type,
            issuer: record.issuer,
            country: record.country,
            countryCode: record.countryCode,
            url: record.url,
            phone: record.phone,
            city: record.city,
          },
        });
        enriched++;
      }
    }

    await sleep(opts.delayMs);
  }

  return { enriched, attempted, cacheHits, errors };
}

