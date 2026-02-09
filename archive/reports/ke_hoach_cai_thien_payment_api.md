# KẾ HOẠCH CẢI THIỆN PROJECT PAYMENT SANDBOX API

## 1. DATABASE LAYER (Hiện tại: 2/10 → Mục tiêu: 10/10)

### 1.1 Phân tích nguyên nhân
- **Vấn đề:** Có 3 nguồn sự thật khác nhau cho schema DB:
  - `src/database/connection.ts`: `initializeSchema()` 
  - `src/database/migrations/*.sql`: Schema với cột provenance/source/etl
  - `src/database/migrate.ts`: Schema thứ 3
- **Hậu quả:** Code query expecting các cột không tồn tại, ETL scripts lỗi runtime

### 1.2 Kế hoạch hành động

**Giai đoạn 1: Chuẩn hóa Schema (3-5 ngày)**
1. **Audit tất cả schema files**
   - So sánh 3 nguồn schema
   - Liệt kê tất cả các cột bị khác biệt
   - Xác định schema "chuẩn" dựa trên requirements thực tế

2. **Thiết kế Schema Master**
   - Gộp tất cả các cột cần thiết từ 3 nguồn
   - Tạo file `schema-master.sql` làm source of truth duy nhất
   - Đảm bảo backward compatibility với ETL và queries hiện tại

3. **Migration Strategy**
   - Script migration từ schema cũ sang schema master
   - Backup data trước khi migrate
   - Test migration trên staging environment

**Giai đoạn 2: Implementation (2-3 ngày)**
1. **Cập nhật Database Initialization**
   - Sửa `src/database/connection.ts` dùng schema master
   - Remove duplicate schema definitions
   - Add schema validation on startup

2. **Cập nhật Models và Queries**
   - Fix `src/models/bin.ts` queries cho đúng columns
   - Update ETL scripts để match schema
   - Add unit tests cho database layer

3. **Add Integration Tests**
   - Test ETL pipeline với schema mới
   - Test tất cả queries với real data
   - Test migration rollback

**Giai đoạn 3: Validation (1-2 ngày)**
1. **End-to-end Testing**
2. **Performance Testing**
3. **Documentation Update**

### 1.3 Chỉ số đo lường
- [ ] 100% queries pass without column errors
- [ ] ETL pipeline chạy thành công 100%
- [ ] Migration time < 5 phút
- [ ] Zero data loss during migration
- [ ] All integration tests pass

### 1.4 Nguồn lực cần thiết
- **Senior Developer**: 1 người (8-10 ngày)
- **Database Specialist**: 1 người (consult 2-3 ngày)
- **QA Engineer**: 1 người (3-4 ngày testing)

---

## 2. RATE LIMITING (Hiện tại: 3/10 → Mục tiêu: 10/10)

### 2.1 Phân tích nguyên nhân
- **Vấn đề:** Logic sai trong `src/middleware/rateLimit.ts`
  - Khởi tạo với `points = limits.free` và `duration = 1`
  - Mỗi request consume `pointsTheoTier` (500/2000/10000)
  - Behavior không đúng window 60s như config

### 2.2 Kế hoạch hành động

**Giai đoạn 1: Fix Core Logic (2-3 ngày)**
1. **Redesign Rate Limiting Logic**
   - Fix initialization parameters
   - Implement proper sliding window algorithm
   - Separate rate limits per tier (free/basic/premium)

2. **Configuration Management**
   - Create rate limit config per endpoint
   - Add dynamic rate limit adjustment
   - Environment-specific rate limits

**Giai đoạn 2: Enhanced Features (2-3 ngày)**
1. **Advanced Rate Limiting**
   - Implement distributed rate limiting (Redis)
   - Add burst capacity handling
   - Implement gradual degradation

2. **Monitoring & Alerting**
   - Rate limit breach alerts
   - Usage analytics dashboard
   - Real-time rate limit status

**Giai đoạn 3: Testing (1-2 ngày)**
1. Load testing với different tiers
2. Concurrent user testing
3. Edge case testing

### 2.3 Chỉ số đo lường
- [ ] Rate limit accuracy: 99.9%
- [ ] Response time < 50ms for rate limit checks
- [ ] Zero false positives/negatives
- [ ] Handles 10,000+ concurrent requests
- [ ] Config survives restart without data loss

---

## 3. 2FA IMPLEMENTATION (Hiện tại: 2/10 → Mục tiêu: 10/10)

### 3.1 Phân tích nguyên nhân
- **Vấn đề:** Implementation sai bản chất
  - Hash secret trước khi lưu (SHA256) → không thể verify TOTP
  - TOTP cần base32 secret gốc
  - Backup codes schema không chắc tồn tại

### 3.2 Kế hoạch hành động

**Giai đoạn 1: Fix Core TOTP (2-3 ngày)**
1. **Redesign Secret Management**
   - Remove secret hashing
   - Store base32 secret encrypted at rest
   - Implement proper key rotation

2. **TOTP Implementation**
   - Use proper TOTP library (speakeasy)
   - Implement QR code generation
   - Add backup codes generation

**Giai đoạn 2: Enhanced Security (2-3 ngày)**
1. **Multi-method 2FA**
   - TOTP (Time-based)
   - SMS-based backup
   - Email verification option

2. **Security Features**
   - Rate limiting for 2FA attempts
   - Device trust management
   - Recovery flow design

**Giai đoạn 3: Testing & Documentation (1-2 ngày)**
1. Security penetration testing
2. User experience testing
3. Update documentation

### 3.3 Chỉ số đo lường
- [ ] 2FA success rate > 99.5%
- [ ] TOTP verification time < 500ms
- [ ] Backup codes work 100% of time
- [ ] Zero stored plaintext secrets
- [ ] Passes security audit

---

## 4. ADMIN ROUTES AUTHENTICATION (Hiện tại: 6/10 → Mục tiêu: 10/10)

### 4.1 Phân tích nguyên nhân
- **Vấn đề:** Admin routes thiếu authentication middleware
  - `src/routes/admin.ts` có `authorize()` nhưng không có `authenticate()`
  - `index.ts` không bọc authenticate cho `/admin`
  - `req.user` không tồn tại → authentication failed

### 4.2 Kế hoạch hành động

**Giai đoạn 1: Fix Authentication Flow (1-2 ngày)**
1. **Add Missing Middleware**
   - Wrap admin routes with authentication
   - Ensure proper user object in request
   - Add role-based access control

2. **Authorization Enhancement**
   - Implement granular permissions
   - Add admin user management
   - Create audit logging for admin actions

**Giai đoạn 2: Security Hardening (1-2 ngày)**
1. **Admin Security**
   - Multi-factor authentication for admin
   - IP whitelisting option
   - Session timeout management

2. **Monitoring & Alerts**
   - Failed admin attempt alerts
   - Admin action logging
   - Unusual access pattern detection

### 4.3 Chỉ số đo lường
- [ ] 100% admin routes require authentication
- [ ] Role-based permissions work correctly
- [ ] Admin actions logged 100%
- [ ] Zero unauthorized access incidents
- [ ] Admin response time < 200ms

---

## 5. DOCS KHỚP RUNTIME (Hiện tại: 4/10 → Mục tiêu: 10/10)

### 5.1 Phân tích nguyên nhân
- **Vấn đề:** Documentation không consistent với implementation
  - Swagger docs show `/api/v1/health` but actual is `/health`
  - References to `/api/v1/status` but endpoint doesn't exist
  - OpenAPI spec outdated

### 5.2 Kế hoạch hành động

**Giai đoạn 1: Audit & Sync (2-3 ngày)**
1. **Complete API Audit**
   - Scan all actual endpoints in codebase
   - Compare with OpenAPI specification
   - Identify all discrepancies

2. **Update Documentation**
   - Fix OpenAPI.yaml to match runtime
   - Update Swagger middleware configuration
   - Sync all endpoint paths and methods

**Giai간 2: Automation (1-2 ngày)**
1. **Auto-sync Documentation**
   - Implement automated documentation generation
   - Add CI/CD check for doc-code consistency
   - Create pre-commit hooks for doc validation

2. **Enhanced Documentation**
   - Add example requests/responses
   - Include error response documentation
   - Add authentication requirement details

### 5.3 Chỉ số đo lường
- [ ] 100% endpoint paths match documentation
- [ ] All request/response schemas documented
- [ ] Documentation builds without warnings
- [ ] Auto-sync catches all changes
- [ ] Developer satisfaction > 90%

---

## 6. SECURITY & COMPLIANCE (Hiện tại: Risk → Mục tiêu: 10/10)

### 6.1 Phân tích nguyên nhân
- **Vấn đề:** High-risk surfaces exposed
  - Card generator endpoint creates real-looking PANs
  - Test payment cards dataset with sensitive patterns
  - No proper authentication/authorization for sensitive features

### 6.2 Kế hoạch hành động

**Giai đoạn 1: Risk Assessment (1-2 ngày)**
1. **Security Audit**
   - Identify all high-risk endpoints
   - Classify data sensitivity levels
   - Assess compliance requirements

**Giai 2: Security Implementation (3-4 ngày)**
1. **Access Control**
   - Implement mandatory authentication for card features
   - Add role-based access for sensitive operations
   - Create environment-specific feature flags

2. **Security Measures**
   - Implement audit logging for all sensitive operations
   - Add request/response encryption for card data
   - Create IP-based access controls
   - Implement proper rate limiting for card generation

3. **Compliance**
   - PCI DSS compliance checklist
   - Data retention policies
   - Privacy controls for test data

**Giai đoạn 3: Monitoring (1-2 ngày)**
1. Security monitoring dashboard
2. Automated security scans
3. Incident response procedures

### 6.3 Chỉ số đo lường
- [ ] All sensitive endpoints require authentication
- [ ] 100% of card operations audited
- [ ] Zero data exposure incidents
- [ ] Security scan score > 95%
- [ ] Passes external security audit

---

## THỨ TỰ ƯU TIÊN TRIỂN KHAI

### Priority 1 (Critical - Deploy Blockers)
1. **Database Layer** - 2/10 → 10/10 (8-10 ngày)
2. **Security & Compliance** - Risk → 10/10 (5-8 ngày)
3. **2FA Implementation** - 2/10 → 10/10 (5-8 ngày)

### Priority 2 (High Impact)
4. **Rate Limiting** - 3/10 → 10/10 (5-8 ngày)
5. **Admin Routes Authentication** - 6/10 → 10/10 (2-4 ngày)

### Priority 3 (Quality & Usability)
6. **Docs Runtime Sync** - 4/10 → 10/10 (3-5 ngày)

### Timeline Total: **28-43 ngày** (6-8 tuần)

---

## RESOURCE REQUIREMENTS SUMMARY

| Team Size | Duration | Critical Path |
|-----------|----------|--------------|
| 2 Senior Devs | 6-8 weeks | Database → Security → Rate Limiting |
| 1 QA Engineer | 4-5 weeks | Testing all modules |
| 1 Security Specialist | 2-3 weeks (consult) | Security audit & compliance |
| 1 DevOps Engineer | 1-2 weeks | Deployment & monitoring setup |

---

## SUCCESS METRICS OVERALL

- [ ] System deploys without critical errors
- [ ] All authentication flows work correctly
- [ ] Rate limiting performs under load
- [ ] Security audit passes with >95% score
- [ ] Documentation accuracy 100%
- [ ] Zero production incidents in first month
- [ ] Developer satisfaction >90%

---

*Risk Mitigation: Mỗi module có rollback plan, backup procedures, và gradual rollout strategy.*