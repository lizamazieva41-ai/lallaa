/**
 * HandyAPI Extraction Handler
 * Purpose: Normalize HandyAPI Card BIN List payloads into our standard SourceRecord[].
 *
 * Notes:
 * - HandyAPI can be integrated either by:
 *   - Loading a cached JSON file under data/sources/handyapi/
 *   - Fetching from a remote endpoint (requires env config)
 * - Since upstream payload formats can vary, this extractor supports common JSON shapes:
 *   1) { "400000": { ... }, "400001": { ... } } (bin -> record map)
 *   2) [ { bin: "400000", ... }, ... ] (array of records)
 */

import fs from 'fs';
import { SourceRecord } from './extract';

type AnyObj = Record<string, any>;

function normalizeBIN(bin: unknown): string | null {
  const s = String(bin ?? '').replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(s)) return null;
  return s.substring(0, 8);
}

function pick(obj: AnyObj | null | undefined, keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toCountryCode(v: any): string | undefined {
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  // Normalize ISO2 to uppercase where possible
  if (s.length === 2) return s.toUpperCase();
  return s;
}

export function parseHandyAPIJson(payload: unknown): SourceRecord[] {
  const out: SourceRecord[] = [];

  const pushRecord = (binKey: unknown, rec: AnyObj): void => {
    const bin = normalizeBIN(binKey ?? rec?.bin ?? rec?.iin ?? rec?.binNumber ?? rec?.bin_code);
    if (!bin) return;

    const countryObj = rec?.country && typeof rec.country === 'object' ? rec.country : undefined;
    const bankObj = rec?.bank && typeof rec.bank === 'object' ? rec.bank : undefined;

    const issuer =
      pick(bankObj, ['name', 'bank_name', 'issuer']) ??
      pick(rec, ['bankName', 'bank_name', 'issuer', 'issuerName', 'bank']);

    const scheme = pick(rec, ['scheme', 'network', 'cardNetwork', 'brandNetwork']);
    const type = pick(rec, ['type', 'cardType', 'card_type']);
    const brand = pick(rec, ['brand', 'cardBrand', 'product']);

    const countryCode =
      toCountryCode(pick(countryObj, ['alpha2', 'code', 'iso2'])) ??
      toCountryCode(pick(rec, ['countryCode', 'country_code', 'iso2'])) ??
      toCountryCode(pick(rec, ['country']));

    const countryName =
      pick(countryObj, ['name']) ??
      pick(rec, ['countryName', 'country_name']);

    out.push({
      bin,
      scheme: scheme ? String(scheme).toLowerCase() : undefined,
      type: type ? String(type).toLowerCase() : undefined,
      brand: brand ? String(brand) : undefined,
      issuer: issuer ? String(issuer) : undefined,
      country: countryName ? String(countryName) : undefined,
      countryCode,
      url: pick(bankObj, ['url', 'website']) ?? pick(rec, ['url', 'website']),
      phone: pick(bankObj, ['phone']) ?? pick(rec, ['phone']),
      city: pick(bankObj, ['city']) ?? pick(rec, ['city']),
      raw: (rec ?? {}) as Record<string, unknown>,
    });
  };

  if (Array.isArray(payload)) {
    for (const rec of payload) {
      if (rec && typeof rec === 'object') pushRecord((rec as AnyObj).bin, rec as AnyObj);
    }
    return out;
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as AnyObj;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') pushRecord(k, v as AnyObj);
    }
    return out;
  }

  return out;
}

export function extractFromHandyAPIFile(filePath: string): { records: SourceRecord[]; errors: string[] } {
  const errors: string[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    const records = parseHandyAPIJson(json);
    return { records, errors };
  } catch (err) {
    errors.push(`Failed to read/parse HandyAPI JSON: ${(err as Error).message}`);
    return { records: [], errors };
  }
}

