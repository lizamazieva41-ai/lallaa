# Sơ Đồ Kiến Trúc Hệ Thống - ASCII Art Version

**Phiên bản**: 1.1.0  
**Mô tả**: Sơ đồ kiến trúc dạng ASCII art cho dễ đọc và in ấn

---

## 1. Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Web App  │  │ Mobile   │  │ API     │                      │
│  │          │  │ App      │  │ Client  │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       │             │             │                             │
│       └─────────────┴─────────────┘                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                                │
│                    (Nginx/HAProxy)                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              SECURITY & MIDDLEWARE STACK                  │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  [Helmet] → [CORS] → [Rate Limit] → [Auth] → [Validate]│ │
│  └──────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    API ROUTES                            │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  /auth  │  /bin  │  /iban  │  /cards  │  /admin          │ │
│  └────┬────┴────┬───┴────┬────┴────┬─────┴────┬─────────────┘ │
│       │         │        │         │          │               │
│       ▼         ▼        ▼         ▼          ▼               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  CONTROLLERS                             │ │
│  │  AuthCtrl │ BinCtrl │ IBANCtrl │ CardCtrl │ AdminCtrl    │ │
│  └────┬───────┴────┬────┴────┬─────┴────┬─────┴────┬──────────┘ │
│       │            │         │         │          │            │
│       ▼            ▼         ▼         ▼          ▼            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    SERVICES                              │ │
│  │  AuthSvc │ BinSvc │ IBANSvc │ CardSvc │ UniqueSvc       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    CACHE LAYER                            │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │ │
│  │  │ LRU Cache   │  │ Redis Cache  │  │ Bloom Filter │   │ │
│  │  │ (In-Memory) │  │ (Distributed)│  │ (pg_bloom)   │   │ │
│  │  │ 10k entries │  │ 24h TTL      │  │ O(1) lookup  │   │ │
│  │  │ < 1ms       │  │ 1-5ms        │  │ 0.1% FP rate │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    DATABASE                               │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │              PostgreSQL 15+                        │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │ │
│  │  │  │   BINs   │  │  Cards   │  │  Users   │        │  │ │
│  │  │  │  Table   │  │  Table   │  │  Table   │        │  │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘        │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │ │
│  │  │  │Countries │  │Uniqueness│  │Statistics│        │  │ │
│  │  │  │  Table   │  │  Pool    │  │  Table   │        │  │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘        │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              QUEUE & WORKERS                            │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  ┌──────────────┐              ┌──────────────┐        │ │
│  │  │ Bull Queue   │──────────────▶│   Workers    │        │ │
│  │  │ (Redis-based)│              │ (Card Gen)   │        │ │
│  │  └──────────────┘              └───────┬────────┘        │ │
│  │                                        │                 │ │
│  │                                        ▼                 │ │
│  │                              ┌──────────────┐          │ │
│  │                              │  WebSocket   │          │ │
│  │                              │   Server     │          │ │
│  │                              └──────────────┘          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Luồng Xử Lý Request

```
CLIENT REQUEST
     │
     ▼
┌─────────────────┐
│ Load Balancer   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              MIDDLEWARE STACK                            │
├─────────────────────────────────────────────────────────┤
│  1. Helmet Security Headers                             │
│     └─▶ XSS Protection, HSTS, CSP, Frame Guard           │
│         │                                                │
│         ▼                                                │
│  2. CORS Handler                                        │
│     └─▶ Origin Validation, Credentials                 │
│         │                                                │
│         ▼                                                │
│  3. Rate Limiter                                        │
│     └─▶ Check User Tier, IP Limits                      │
│         │                                                │
│         ▼                                                │
│  4. Authentication                                      │
│     └─▶ JWT Token / API Key Validation                  │
│         │                                                │
│         ▼                                                │
│  5. Input Validation                                     │
│     └─▶ Sanitize, Validate Schema                        │
│         │                                                │
└─────────┼────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐
│  API Route      │
│  /api/v1/bin    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Controller     │
│  BinController  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Service        │
│  BinService     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              CACHE CHECK                                │
├─────────────────────────────────────────────────────────┤
│  1. Check LRU Cache (In-Memory)                         │
│     ├─▶ HIT  → Return Cached Data                       │
│     └─▶ MISS → Continue                                 │
│         │                                                │
│         ▼                                                │
│  2. Check Redis Cache                                   │
│     ├─▶ HIT  → Update LRU, Return Data                  │
│     └─▶ MISS → Continue                                 │
│         │                                                │
│         ▼                                                │
│  3. Query Database                                      │
│     └─▶ SELECT * FROM bins WHERE bin = ?                 │
│         │                                                │
│         ▼                                                │
│  4. Store in Cache                                      │
│     ├─▶ Store in Redis (24h TTL)                        │
│     └─▶ Store in LRU Cache                             │
│         │                                                │
└─────────┼────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐
│  Response       │
│  JSON Data      │
└────────┬────────┘
         │
         ▼
      CLIENT
```

---

## 3. Kiến Trúc BIN Lookup

```
                    CLIENT REQUEST
                    GET /bin/453201
                          │
                          ▼
                    ┌─────────────┐
                    │  API Route │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Controller │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │Bin Service  │
                    └──────┬──────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │      CACHE LAYER CHECK                │
        ├──────────────────────────────────────┤
        │                                      │
        │  1. LRU Cache (In-Memory)            │
        │     ┌──────────────┐                │
        │     │ Check: 453201│                │
        │     └───────┬───────┘                │
        │             │                         │
        │         ┌───┴───┐                     │
        │         │ HIT?  │                     │
        │         └───┬───┘                     │
        │             │                         │
        │        YES  │  NO                     │
        │         │    │                         │
        │         │    ▼                         │
        │         │  2. Redis Cache              │
        │         │     ┌──────────────┐        │
        │         │     │ Check: 453201│        │
        │         │     └───────┬───────┘        │
        │         │             │                │
        │         │         ┌───┴───┐            │
        │         │         │ HIT?  │            │
        │         │         └───┬───┘            │
        │         │             │                │
        │         │        YES  │  NO            │
        │         │         │    │                │
        │         │         │    ▼                │
        │         │         │  3. Database        │
        │         │         │     ┌────────────┐ │
        │         │         │     │ Query BIN  │ │
        │         │         │     └─────┬──────┘ │
        │         │         │           │        │
        │         │         │           ▼        │
        │         │         │     ┌────────────┐ │
        │         │         │     │ Store in   │ │
        │         │         │     │   Cache    │ │
        │         │         │     └────────────┘ │
        │         │         │                     │
        └─────────┼─────────┼─────────────────────┘
                  │         │
                  ▼         ▼
            ┌─────────────────┐
            │  Return Result   │
            └─────────────────┘
```

---

## 4. Kiến Trúc Card Generation (5-Layer Uniqueness)

```
                    CARD GENERATION REQUEST
                    POST /cards/generate-async
                          │
                          ▼
                    ┌─────────────┐
                    │  Job Queue  │
                    │  (Bull)     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Worker   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Generate   │
                    │ Card Number│
                    └──────┬──────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │      5-LAYER UNIQUENESS CHECK                │
        ├──────────────────────────────────────────────┤
        │                                              │
        │  Layer 5: Redis Cache                        │
        │  ┌────────────────────┐                     │
        │  │ Check: card_hash  │                     │
        │  └──────────┬─────────┘                     │
        │             │                                 │
        │         ┌───┴───┐                           │
        │         │Found? │                           │
        │         └───┬───┘                           │
        │             │                                 │
        │        YES  │  NO                            │
        │         │    │                                 │
        │         │    ▼                                 │
        │         │  Layer 4: Bloom Filter              │
        │         │  ┌────────────────────┐            │
        │         │  │ mightContain()     │            │
        │         │  └──────────┬─────────┘            │
        │         │             │                      │
        │         │         ┌───┴───┐                  │
        │         │         │Found? │                  │
        │         │         └───┬───┘                  │
        │         │             │                      │
        │         │        YES  │  NO                 │
        │         │         │    │                      │
        │         │         │    ▼                      │
        │         │         │  Layer 3: Uniqueness Pool │
        │         │         │  ┌────────────────────┐  │
        │         │         │  │ reserve(hash)      │  │
        │         │         │  │ + Advisory Lock    │  │
        │         │         │  └──────────┬─────────┘  │
        │         │         │             │            │
        │         │         │         ┌───┴───┐        │
        │         │         │         │OK?    │        │
        │         │         │         └───┬───┘        │
        │         │         │             │            │
        │         │         │        YES  │  NO        │
        │         │         │         │    │            │
        │         │         │         │    ▼            │
        │         │         │         │  Layer 2: Global Index│
        │         │         │         │  ┌────────────────────┐│
        │         │         │         │  │ Check across      ││
        │         │         │         │  │ partitions        ││
        │         │         │         │  └──────────┬─────────┘│
        │         │         │         │             │          │
        │         │         │         │         ┌───┴───┐      │
        │         │         │         │         │Unique?│      │
        │         │         │         │         └───┬───┘      │
        │         │         │         │             │          │
        │         │         │         │        YES  │  NO      │
        │         │         │         │         │    │          │
        │         │         │         │         │    ▼          │
        │         │         │         │         │  Layer 1: DB Constraint│
        │         │         │         │         │  ┌────────────────────┐│
        │         │         │         │         │  │ UNIQUE constraint ││
        │         │         │         │         │  │ (card, expiry, cvv)││
        │         │         │         │         │  └──────────┬─────────┘│
        │         │         │         │         │             │          │
        │         │         │         │         │        ┌───┴───┐      │
        │         │         │         │         │        │Unique?│      │
        │         │         │         │         │        └───┬───┘      │
        │         │         │         │         │            │          │
        │         │         │         │         │        YES │  NO      │
        │         │         │         │         │         │    │          │
        └─────────┼─────────┼─────────┼─────────┼─────────┼───┘          │
                  │         │         │         │         │              │
                  │         │         │         │         │              │
                  ▼         ▼         ▼         ▼         ▼              │
            ┌─────────────────────────────────────────────────────────┐  │
            │              CARD IS UNIQUE - GENERATE                  │  │
            │  1. Validate Luhn Algorithm                            │  │
            │  2. Store in Database                                  │  │
            │  3. Mark in all layers                                  │  │
            │  4. Send WebSocket update                              │  │
            └─────────────────────────────────────────────────────────┘  │
                                                                          │
                                                                          │
            ┌─────────────────────────────────────────────────────────┐  │
            │              CARD NOT UNIQUE - RETRY                    │  │
            │  Generate new card number and retry                     │  │
            └─────────────────────────────────────────────────────────┘  │
```

---

## 5. Kiến Trúc ETL Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ CSV Files    │  │ JSON Files  │  │ YAML Files   │         │
│  │ bin-list-data│  │ binlist-data│  │ bin_list     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └─────────────────┴─────────────────┘                  │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ETL PIPELINE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  STAGE 1: EXTRACT                                        │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  • Read CSV/JSON/YAML files                              │ │
│  │  • Parse data structures                                 │ │
│  │  • Handle errors and corrupted files                     │ │
│  │  • Output: Raw data objects                              │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  STAGE 2: NORMALIZE                                     │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  • Country code → ISO 3166-1 alpha-2                    │ │
│  │  • Bank name → Normalized format                         │ │
│  │  • Card network → Standard (Visa, Mastercard, etc.)      │ │
│  │  • Card type → Standard (Credit, Debit, Prepaid)          │ │
│  │  • Calculate confidence score                            │ │
│  │  • Output: Standardized data objects                     │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  STAGE 3: MERGE                                          │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  • Deduplicate records                                   │ │
│  │  • Resolve conflicts (priority-based)                    │ │
│  │  • Merge multi-source data                               │ │
│  │  • Track source provenance                               │ │
│  │  • Flag low-confidence for manual review                 │ │
│  │  • Output: Merged data with conflict resolution         │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  STAGE 4: LOAD                                           │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  • Batch insert/update with transaction                  │ │
│  │  • Error handling and rollback                          │ │
│  │  • Progress tracking                                     │ │
│  │  • Output: Database records                              │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL │
                    │   Database  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Cache Flush  │
                    │ POST /admin/ │
                    │ cache/flush  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Redis Cache  │
                    │   Cleared     │
                    └───────────────┘
```

---

## 6. Kiến Trúc Cache Multi-Tier

```
                    API REQUEST
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   LAYER 1: LRU CACHE                │
        │   (In-Memory)                       │
        │   • 10,000 entries                  │
        │   • 24h TTL                         │
        │   • < 1ms lookup                    │
        └───────────────┬────────────────────┘
                         │
                    ┌────┴────┐
                    │  HIT?   │
                    └────┬────┘
                         │
              YES        │        NO
               │         │         │
               │         │         ▼
               │         │  ┌────────────────────┐
               │         │  │ LAYER 2: REDIS     │
               │         │  │ (Distributed)      │
               │         │  │ • 24h TTL          │
               │         │  │ • 1-5ms lookup     │
               │         │  └─────────┬──────────┘
               │         │            │
               │         │       ┌───┴───┐
               │         │       │ HIT?  │
               │         │       └───┬───┘
               │         │           │
               │         │      YES │  NO
               │         │       │   │   │
               │         │       │   │   ▼
               │         │       │   │  ┌────────────────────┐
               │         │       │   │  │ LAYER 3: DATABASE  │
               │         │       │   │  │ (PostgreSQL)       │
               │         │       │   │  │ • 10-50ms query     │
               │         │       │   │  └─────────┬───────────┘
               │         │       │   │           │
               │         │       │   │           ▼
               │         │       │   │  ┌────────────────────┐
               │         │       │   │  │ Store in Cache    │
               │         │       │   │  │ • Redis (24h)     │
               │         │       │   │  │ • LRU (update)    │
               │         │       │   │  └───────────────────┘
               │         │       │   │
               │         │       │   │
               └─────────┴───────┴───┘
                            │
                            ▼
                    ┌──────────────┐
                    │   RESPONSE   │
                    │  (JSON Data) │
                    └──────────────┘
```

---

## 7. Kiến Trúc Bảo Mật

```
                    CLIENT REQUEST
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  LAYER 1: HELMET.JS                │
        │  • XSS Protection                   │
        │  • HSTS (Force HTTPS)              │
        │  • Content Security Policy         │
        │  • Frame Guard (Anti-clickjacking) │
        │  • No Sniff (MIME protection)     │
        └───────────────┬────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  LAYER 2: CORS HANDLER              │
        │  • Origin Whitelist                │
        │  • Credentials Support             │
        │  • Method Restrictions             │
        └───────────────┬────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  LAYER 3: RATE LIMITER             │
        │  • Per User (Tier-based)          │
        │    - Free: 100/min                │
        │    - Basic: 500/min               │
        │    - Premium: 2000/min            │
        │    - Enterprise: 10000/min        │
        │  • Per IP (Abuse prevention)       │
        │  • Redis-backed                    │
        └───────────────┬────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  LAYER 4: AUTHENTICATION           │
        │  • JWT Token Validation           │
        │  • API Key Validation             │
        │  • 2FA Support                    │
        │  • Refresh Token                  │
        └───────────────┬────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  LAYER 5: INPUT VALIDATION         │
        │  • Sanitization                    │
        │  • Schema Validation (Joi/Zod)    │
        │  • Type Checking                   │
        └───────────────┬────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  LAYER 6: ANOMALY DETECTION         │
        │  • Pattern Analysis                │
        │  • Behavioral Tracking             │
        │  • Alert System                    │
        └───────────────┬────────────────────┘
                         │
                         ▼
                    APPLICATION
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  AUDIT LOGGING                      │
        │  • All Actions Logged              │
        │  • Security Events                 │
        │  • Data Access                      │
        └────────────────────────────────────┘
```

---

## 8. Deployment Architecture

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │  (Nginx/HAProxy)│
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ PM2 Instance │    │ PM2 Instance │    │ PM2 Instance │
│   Node.js    │    │   Node.js    │    │   Node.js    │
│   App #1     │    │   App #2     │    │   App #3     │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                  │                    │
       └──────────────────┼────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │ Redis Cache  │  │ Bull Queue   │
│   Master     │  │   Cluster    │  │   Workers    │
└──────┬───────┘  └──────────────┘  └──────────────┘
       │
       ▼
┌──────────────┐
│ PostgreSQL   │
│   Replica    │
│  (Read-only) │
└──────────────┘
```

---

## 9. Luồng Dữ Liệu ETL

```
DATA SOURCES
     │
     ├─── CSV Files
     ├─── JSON Files
     └─── YAML Files
          │
          ▼
     EXTRACT
     • Read files
     • Parse data
     • Error handling
          │
          ▼
     NORMALIZE
     • Standardize country codes
     • Normalize bank names
     • Standardize card types
     • Calculate confidence
          │
          ▼
     MERGE
     • Deduplicate
     • Resolve conflicts
     • Track provenance
     • Flag for review
          │
          ▼
     LOAD
     • Batch insert
     • Transaction
     • Error handling
          │
          ▼
     DATABASE
     • Store records
     • Update indexes
          │
          ▼
     CACHE FLUSH
     • Clear Redis
     • Clear LRU
     • Ready for new data
```

---

## 10. WebSocket Real-time Updates

```
                    CLIENT
                    (Browser)
                      │
                      │ WebSocket Connection
                      │
                      ▼
              ┌──────────────┐
              │ WebSocket    │
              │   Server     │
              └──────┬───────┘
                     │
                     │ Subscribe to Job
                     │
                     ▼
              ┌──────────────┐
              │  Job Queue   │
              │  (Bull)      │
              └──────┬───────┘
                     │
                     │ Process Job
                     │
                     ▼
              ┌──────────────┐
              │   Worker     │
              │  Processing  │
              └──────┬───────┘
                     │
                     │ Progress Updates
                     │
                     ▼
              ┌──────────────┐
              │ WebSocket    │
              │   Emit       │
              └──────┬───────┘
                     │
                     │ Real-time Updates
                     │
                     ▼
                    CLIENT
              {jobId, progress: 50%}
              {jobId, progress: 75%}
              {jobId, status: "completed"}
```

---

## Kết Luận

Các sơ đồ ASCII art trên cung cấp cái nhìn trực quan về:

1. **Kiến trúc tổng quan** - Toàn bộ hệ thống
2. **Luồng xử lý request** - Từ client đến response
3. **BIN lookup** - Multi-tier caching
4. **Card generation** - 5-layer uniqueness
5. **ETL pipeline** - Data processing
6. **Cache strategy** - Multi-tier caching
7. **Security layers** - Defense in depth
8. **Deployment** - Production setup
9. **Data flow** - ETL process
10. **WebSocket** - Real-time updates

Các sơ đồ này có thể được in ra hoặc xem trực tiếp trong text editor để hiểu rõ cách hệ thống hoạt động.
