# HandyAPI Card BIN List — Research Notes

## Scope

This repository supports integrating **HandyAPI Card BIN List** as an additional ETL source. Because upstream APIs and payload shapes can vary (and may require credentials), the integration is implemented in a **format-tolerant** way and defaults to **file-based cache ingestion**.

## Integration approach (implemented)

- **Cache-first ingestion**: ETL reads a local JSON cache file:
  - `data/sources/handyapi/card-bin-list.json`
- **Extractor**: `scripts/etl/extract-handyapi.ts`
  - Supports common JSON shapes:
    - **Map**: `{ "400000": { ... }, "400001": { ... } }`
    - **Array**: `[ { "bin": "400000", ... }, ... ]`
  - Attempts to normalize:
    - `bin` (6–8 digits)
    - `scheme` / `network`
    - `type`
    - `brand`
    - `issuer` / `bank.name` / `bank_name`
    - `countryCode` / `country.alpha2` / `country.code`
    - `countryName`
    - `bank.url`, `bank.phone`, `bank.city` (best-effort)
- **ETL wiring**: `scripts/etl/etl.ts` includes a disabled-by-default source config:
  - `name: "handyapi/card-bin-list"`
  - `format: "json"`
  - `enabled: false` (enable when you have the cache file)

## Operational notes

- **Update frequency**: depends on HandyAPI; treat as external and monitor for schema drift.
- **Schema drift handling**: extractor uses best-effort key lookup and will ignore unknown fields rather than failing the entire run.
- **Security**: if you add remote fetching later, use environment variables for credentials and never log secrets.

## Next step (optional)

If you want true “sync from HandyAPI”, extend `scripts/etl/etl.ts` to fetch the remote payload (e.g. with Axios), write it to the cache path, then run `extractFromHandyAPI()`.

