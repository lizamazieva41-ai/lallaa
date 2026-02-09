# Data Flow Diagram

## Overview

This document describes the data flow in the BIN Check API v2.0.

## ETL Pipeline Flow

```
Data Sources → Extract → Normalize → Merge → Load → Database
     ↓            ↓          ↓          ↓        ↓
  (CSV/JSON)  (Clean)   (Standardize) (Resolve) (Store)
```

## BIN Lookup Flow

```
Request → Bloom Filter → LRU Cache → Redis Cache → Database
            ↓              ↓            ↓            ↓
         (O(1) check)  (In-memory)  (Distributed) (Persistent)
```

## Quality Monitoring Flow

```
Metrics Collection → Trend Analysis → Anomaly Detection → Alerts
        ↓                  ↓                ↓              ↓
   (Calculate)        (30/60/90d)      (Thresholds)   (Notify)
```

## Conflict Resolution Flow

```
Multiple Sources → Confidence Scoring → Auto-Resolution → Manual Review
       ↓                  ↓                    ↓              ↓
  (Field Values)    (Weighted)          (≥70%)         (<70%)
```
