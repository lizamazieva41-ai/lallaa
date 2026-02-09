# Data & Logic Completion Plan

This plan tracks tasks for data/logic completeness across ETL, API exposure, security, and observability.

## Milestones

| ID | Milestone | Goal | Done When |
| --- | --- | --- | --- |
| M1 | Schema & Model lock | DB schema and TS models aligned | `schema-master.sql`, migrations, and models match; indexes/triggers valid; countries seed stable |
| M2 | BIN ETL complete | ETL Extract/Normalize/Merge/Load deterministic with metrics | Priority merge fixed; confidence stored; invalid rate tracked; ETL integration tests idempotent |
| M3 | Test Cards ETL complete | Gateways + test cards parsed, masked, indexed | Full ETL pass; PAN masked; API returns correct results |
| M4 | API + Data Exposure | BIN/IBAN/Test Cards APIs expose correct fields | Public/admin responses match design; OpenAPI matches routes |
| M5 | Security & Access | Data access controlled and logged | RLS enabled for sensitive tables; logs masked; high/critical vulns handled |
| M6 | Observability & Analytics | Metrics/logs reflect data + logic | ETL metrics present; dashboards updated; metrics/logs/DB cross-checked |
| M7 | QA & Go-live | Full verification | All tests pass; regression ok; rollout checklist approved |

## Task Tracker

| ID | Milestone | Group | Task | Assignee | Input | Deliverable | Quality Criteria | Est. | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1.1 | M1 | Logic/Data | Audit DB schema vs TS models |  | `src/database/schema-master.sql`, `src/models/*.ts` | Mismatch list + fixes proposed | All key tables reviewed; each mismatch has recommendation |  | Done |
| T1.2 | M1 | Logic | Sync TS models with schema |  | T1.1 results | Updated models + migrations (if needed) | TS types fully match schema; build passes |  | Done |
| T1.3 | M1 | Data | Verify countries seed data |  | `src/models/country.ts` seed; DB | Updated seed + doc list of supported countries | Seed idempotent; no missing required fields |  | Done |
| T2.1 | M2 | Logic | Fix merge priority bug in `mergeRecords` |  | `src/services/etl/merge.ts`, `SourceInfo` | Correct priority by source | Unit test confirms `binlist/data` priority |  | Done |
| T2.2 | M2 | Logic | Persist normalized `confidence` to `confidence_score` |  | ETL normalize/merge/load; schema `bins.confidence_score` | Correct mapping + upsert | DB stores non-1.0 confidence; tests verify samples |  | Done |
| T2.3 | M2 | Data | Create ETL fixtures for full pipeline |  | Existing fixtures + new large sources | JSON/CSV/YAML fixtures covering conflict cases | Scenario coverage >= 90% |  | Done |
| T2.4 | M2 | QA | Expand ETL integration tests |  | `tests/integration/etl.test.ts`, fixtures | E2E extract->normalize->merge->load tests | Idempotent run; raw preservation checks |  | Done |
| T2.5 | M2 | Data | Run ETL on staging with real data |  | Real sources + staging DB | ETL run logs + sample export | No runtime errors; failure rate acceptable |  | Not Started |
| T3.1 | M3 | Logic | Review markdown parser for test cards |  | `src/services/etl/testCardsETL.ts` | Mapping doc for table formats -> ParsedTestCard | All main formats parsed; unsupported cases documented |  | Done |
| T3.2 | M3 | Data | Create markdown fixtures for gateways |  | Stripe/Adyen/Braintree examples | Fixtures + unit tests | Parser passes >90% common cases |  | Done |
| T3.3 | M3 | Logic/Security | Validate PAN masking and no sensitive storage |  | `maskPAN`, logger, schema `test_cards` | Tests + documentation | DB contains only masked PAN; QA signoff |  | Done |
| T3.4 | M3 | QA | Integration test for test-cards ETL |  | `testCardsETL.ts`, DB test | E2E test cards ETL | Idempotent; creates gateways + cards correctly |  | Done |
| T4.1 | M4 | Logic | Extend BIN row/result fields for ETL fields |  | `src/models/bin.ts`, types | Fields for admin/public | Backward compatible or versioned |  | Not Started |
| T4.2 | M4 | Logic | Expose provenance/quality in admin |  | `src/controllers/admin.ts`, routes | Admin endpoints return source + confidence + sanitized raw | Unit tests; no raw in public |  | Not Started |
| T4.3 | M4 | Integration | Sync OpenAPI with routes |  | `openapi.yaml`, routes | Updated OpenAPI | Swagger matches routes |  | Not Started |
| T5.1 | M5 | Logic/Security | Design + enable RLS for sensitive tables |  | `src/database/security/rls-basic.sql` | Policies + migration | RLS verified by role tests |  | Not Started |
| T5.2 | M5 | Security | Review and expand logger masking |  | `src/utils/logger.ts` | Mask list + unit tests | Logs contain no PAN/IBAN/token/email/password |  | Not Started |
| T5.3 | M5 | Security | Address high/critical npm vulnerabilities |  | `npm audit` | Package updates or risk acceptance doc | Audit leaves only low/moderate or accepted |  | Not Started |
| T6.1 | M6 | Logic/Data | Add missing ETL metrics |  | ETL code + README metrics | Counters/histograms for stages/errors/duration | `/metrics` exposes new metrics |  | Not Started |
| T6.2 | M6 | QA/Data | Build data quality + ETL dashboard |  | `monitoring/grafana` | Dashboard panels | Panels show correct data on test/stage |  | Not Started |
| T6.3 | M6 | QA | Cross-check metrics/logs/DB |  | Prometheus/Grafana/logs/DB | Verification report | Error <5% with explanations |  | Not Started |
| T7.1 | M7 | QA | Run full test suite |  | Tests | Test report | All relevant tests pass; >=80% data logic coverage |  | Not Started |
| T7.2 | M7 | QA | Regression testing on staging |  | Staging build + DB | Checklist results | No blocking regressions |  | Not Started |
| T7.3 | M7 | Deploy | Prep and execute prod rollout |  | Docker/PM2/CI | Rollout plan + rollback runbook | Post-deploy checks OK |  | Not Started |
