# Schema vs Model Audit (T1.1)

Source of truth: `src/database/schema-master.sql` vs TS models in `src/models` and types in `src/types`.

## Findings

### users
- Schema has `backup_codes JSONB DEFAULT '[]'`; TS `User`/`UserRow`/mapping do not include `backup_codes`.
- `User` type omits `createdAt`/`updatedAt` in some model method generics (minor typing mismatch in `CountryModel.create` style; see note below).

### countries
- Schema includes `created_at`/`updated_at`; `Country` type does not include these fields (models read them but do not expose).
- `CountryModel.create` uses `Omit<Country, 'createdAt' | 'updatedAt'>` even though `Country` has no `createdAt`/`updatedAt` fields (type mismatch).

### bins
Schema includes ETL + quality fields that are not represented in TS types/model mapping:
- Missing in `BIN` type and `BINRow` mapping: `length`, `luhn`, `scheme`, `brand`, `issuer`, `country`, `url`, `phone`, `city`, `last_updated`, `confidence_score`.
- `bin_range_start`/`bin_range_end` are present in `BINRow` but not mapped in `mapRowToBIN`.
- `bank_name_local` is nullable in schema, but `BINRow` uses `string` (should allow `null`).
- `source` is `NOT NULL` in schema but `BINRow` allows `null`.
- `import_date` is `NOT NULL` by default in schema but `BINRow` allows `null`.

### api_keys
- Matches schema fields; no material mismatches found.

### card_gateways / test_cards
- Models align with schema. (No missing fields found.)

### password_resets
- Matches schema fields; no material mismatches found.

### audit_logs / usage_logs / etl_runs
- Tables exist in schema but there are no TS types or models for them.
- Some scripts reference these tables directly (RLS tests) but no model layer exists for app logic.

## Recommendations (for T1.2)
- Add `backupCodes` to `User` type, `UserRow`, and mapping if used by 2FA recovery.
- Expand `BIN` type and `BINRow` + `mapRowToBIN` to cover ETL fields.
- Align nullability in `BINRow` to schema (`bank_name_local`, `source`, `import_date`).
- Decide whether to expose `createdAt`/`updatedAt` in `Country` type or adjust model method typings.
- Add minimal TS types/models for `audit_logs`, `usage_logs`, `etl_runs` if application logic will query them beyond SQL scripts.
