# Production Readiness Checklist

This checklist is used to approve deployment of **BIN Check API v2.0**.

## 1) Functional readiness

- [ ] All core endpoints respond successfully behind auth (except `/health`, `/metrics`)
- [ ] Admin routes require admin authorization
- [ ] ETL runs end-to-end (extract → normalize → merge → load) without fatal errors
- [ ] Golden set generation + validation completes and outputs expected artifacts

## 2) Data quality readiness

- [ ] Golden set exists and is large enough (>= 2,000 records initially)
- [ ] Manual verification worksheet exists for >= 200 sampled BINs
- [ ] Field-specific accuracy validation passes against golden set:
  - [ ] Country >= 99%
  - [ ] Network >= 99%
  - [ ] Issuer >= 95%
  - [ ] Type >= 95%
- [ ] Data quality monitoring endpoints return metrics without errors

## 3) Performance readiness

- [ ] Performance validation test passes:
  - [ ] Lookup p95 < 50ms
  - [ ] Cache hit rate > 95% (steady state)
- [ ] Database indexes migration applied (`010_performance_indexes.sql`)

## 4) Reliability readiness

- [ ] Reliability validation test passes:
  - [ ] Redis failure fallback works (service still returns lookup results)
  - [ ] Concurrent lookups return consistent results

## 5) Operational readiness

- [ ] Logging is enabled and does not leak secrets (tokens, PANs, passwords)
- [ ] Metrics are exposed at `/metrics`
- [ ] Runbooks available for ETL + cache management + incident response

## 6) Security readiness

- [ ] JWT secrets configured via env vars
- [ ] Rate limiting enabled
- [ ] CORS/Helmet configured appropriately
- [ ] No debug telemetry calls in production paths

## Automated gate

Run:

```bash
npx ts-node scripts/readiness-assessment.ts
```

The script exits non-zero if any **fail** checks are detected.

