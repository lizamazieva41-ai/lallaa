# Security Model

## Overview

This document describes the security model for the BIN Check API v2.0.

## Authentication

- **JWT Tokens**: Short-lived access tokens (15 minutes)
- **Refresh Tokens**: Long-lived refresh tokens (7 days)
- **API Keys**: For programmatic access

## Authorization

- **Role-Based Access Control (RBAC)**
  - User: Basic access
  - Admin: Full access including monitoring

## Data Protection

- **Encryption**: HTTPS/TLS for all communications
- **Password Hashing**: bcrypt with 12+ rounds
- **Sensitive Data**: Never logged or exposed

## Rate Limiting

- **Per-User Limits**: Based on tier
- **Per-IP Limits**: Prevent abuse
- **Admin Limits**: Higher limits for admin operations

## Audit Logging

- All admin actions logged
- Authentication events logged
- Data access logged
- Conflict resolution logged

## Security Best Practices

1. Regular security audits
2. Dependency updates
3. Secret rotation
4. Access review
