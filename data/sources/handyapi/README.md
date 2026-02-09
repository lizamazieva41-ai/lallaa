# HandyAPI source cache

This directory is reserved for **HandyAPI Card BIN List** cached payloads.

## Expected file

- `card-bin-list.json`

## Notes

- The ETL source config (`scripts/etl/etl.ts`) includes `handyapi/card-bin-list` but it is **disabled by default**.
- When enabled, ETL will parse the cache using `scripts/etl/extract-handyapi.ts`.

