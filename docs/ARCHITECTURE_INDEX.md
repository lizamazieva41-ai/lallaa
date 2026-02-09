# Mục Lục Tài Liệu Kiến Trúc

## Tài Liệu Chính

### 📊 [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)
**Tài liệu chi tiết với Mermaid diagrams**

Bao gồm:
- Sơ đồ kiến trúc tổng quan (Mermaid)
- Luồng xử lý request (Sequence diagrams)
- Kiến trúc BIN Lookup
- Kiến trúc Card Generation (5-layer uniqueness)
- Kiến trúc ETL Pipeline
- Kiến trúc Cache Multi-Tier
- Kiến trúc Bảo Mật
- Kiến trúc Database (ER diagrams)
- Monitoring và Observability
- Deployment Architecture

**Cách xem**: 
- GitHub/GitLab: Tự động render
- VS Code: Cài extension "Markdown Preview Mermaid Support"
- Web: [Mermaid Live Editor](https://mermaid.live/)

---

### 📐 [ARCHITECTURE_DIAGRAM_ASCII.md](./ARCHITECTURE_DIAGRAM_ASCII.md)
**Sơ đồ ASCII art đơn giản**

Bao gồm:
- Kiến trúc tổng quan (ASCII)
- Luồng xử lý request
- BIN Lookup flow
- Card Generation flow
- ETL Pipeline flow
- Cache strategy
- Security layers
- Deployment architecture

**Cách xem**: 
- Xem trực tiếp trong text editor
- In ra giấy
- Copy vào terminal

---

### 📖 [ARCHITECTURE_README.md](./ARCHITECTURE_README.md)
**Hướng dẫn sử dụng tài liệu**

Bao gồm:
- Cách xem sơ đồ
- Cấu trúc tài liệu
- Đối tượng sử dụng
- Các tính năng được mô tả
- FAQ

---

## Tài Liệu Liên Quan

### Kiến Trúc Chi Tiết

- [ARCHITECTURE_UNIQUENESS.md](./ARCHITECTURE_UNIQUENESS.md) - Chi tiết về 5-layer uniqueness architecture
- [architecture/data-flow-diagram.md](./architecture/data-flow-diagram.md) - Data flow diagram
- [architecture/security-model.md](./architecture/security-model.md) - Security model
- [architecture/scalability-design.md](./architecture/scalability-design.md) - Scalability design

### Deployment & Operations

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Hướng dẫn deployment
- [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md) - Operational runbooks
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) - Security audit

### API Documentation

- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - API specification
- [api-documentation.md](./api-documentation.md) - API documentation
- [swagger-setup.md](./swagger-setup.md) - Swagger setup

### Feature Documentation

- [CARD_GENERATION_FROM_BIN.md](./CARD_GENERATION_FROM_BIN.md) - Card generation từ BIN
- [CARD_GENERATION_STORAGE.md](./CARD_GENERATION_STORAGE.md) - Card storage
- [CARD_STATISTICS_API.md](./CARD_STATISTICS_API.md) - Card statistics API
- [DEDUPLICATION_LOGIC.md](./DEDUPLICATION_LOGIC.md) - Deduplication logic

### Monitoring & Metrics

- [PROMETHEUS_METRICS.md](./PROMETHEUS_METRICS.md) - Prometheus metrics
- [REDIS_CACHING.md](./REDIS_CACHING.md) - Redis caching

---

## Quick Links

### Cho Developers
- [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Hiểu kiến trúc
- [ARCHITECTURE_UNIQUENESS.md](./ARCHITECTURE_UNIQUENESS.md) - Uniqueness logic
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - API endpoints

### Cho Architects
- [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Kiến trúc tổng quan
- [architecture/scalability-design.md](./architecture/scalability-design.md) - Scalability
- [architecture/security-model.md](./architecture/security-model.md) - Security

### Cho DevOps
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment
- [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md) - Operations
- [PROMETHEUS_METRICS.md](./PROMETHEUS_METRICS.md) - Monitoring

### Cho Product Managers
- [README.md](../README.md) - Tổng quan dự án
- [CARD_STATISTICS_API.md](./CARD_STATISTICS_API.md) - Features
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - Capabilities

---

## Cấu Trúc Thư Mục Docs

```
docs/
├── ARCHITECTURE_DIAGRAM.md          # ⭐ Tài liệu chính với Mermaid
├── ARCHITECTURE_DIAGRAM_ASCII.md    # ⭐ ASCII art diagrams
├── ARCHITECTURE_README.md            # ⭐ Hướng dẫn sử dụng
├── ARCHITECTURE_INDEX.md             # ⭐ File này (mục lục)
│
├── ARCHITECTURE_UNIQUENESS.md       # 5-layer uniqueness
├── DEPLOYMENT_GUIDE.md              # Deployment guide
├── OPERATIONAL_RUNBOOKS.md          # Operational procedures
├── SECURITY_AUDIT.md                # Security audit
│
├── architecture/                     # Kiến trúc chi tiết
│   ├── data-flow-diagram.md
│   ├── security-model.md
│   └── scalability-design.md
│
├── production/                      # Production guides
│   ├── deployment/
│   ├── monitoring/
│   └── runbooks/
│
└── ...                              # Các tài liệu khác
```

---

## Cách Sử Dụng

### 1. Bắt Đầu Từ Đâu?

**Nếu bạn là developer mới:**
1. Đọc [README.md](../README.md) - Tổng quan dự án
2. Đọc [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Hiểu kiến trúc
3. Đọc [API_SPECIFICATION.md](./API_SPECIFICATION.md) - Hiểu API

**Nếu bạn là architect:**
1. Đọc [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Kiến trúc tổng quan
2. Đọc [architecture/scalability-design.md](./architecture/scalability-design.md) - Scalability
3. Đọc [architecture/security-model.md](./architecture/security-model.md) - Security

**Nếu bạn là DevOps:**
1. Đọc [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment
2. Đọc [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md) - Operations
3. Đọc [PROMETHEUS_METRICS.md](./PROMETHEUS_METRICS.md) - Monitoring

### 2. Tìm Kiếm Thông Tin

**Tìm kiếm theo chủ đề:**

- **Authentication**: [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Section 8
- **BIN Lookup**: [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Section 4
- **Card Generation**: [ARCHITECTURE_UNIQUENESS.md](./ARCHITECTURE_UNIQUENESS.md)
- **ETL Pipeline**: [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Section 6
- **Caching**: [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Section 7
- **Security**: [architecture/security-model.md](./architecture/security-model.md)
- **Deployment**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### 3. Cập Nhật Tài Liệu

Khi có thay đổi:
1. Cập nhật Mermaid diagrams trong `ARCHITECTURE_DIAGRAM.md`
2. Cập nhật ASCII art trong `ARCHITECTURE_DIAGRAM_ASCII.md`
3. Cập nhật mục lục này nếu cần

---

## Tools & Resources

### Xem Diagrams

- **Mermaid Live Editor**: https://mermaid.live/
- **VS Code Extension**: "Markdown Preview Mermaid Support"
- **mermaid-cli**: `npm install -g @mermaid-js/mermaid-cli`

### Tạo Diagrams

- **Mermaid**: https://mermaid.js.org/
- **Draw.io**: https://app.diagrams.net/
- **ASCII Art**: https://www.ascii-art.de/

---

## Feedback & Contributions

Nếu bạn thấy tài liệu cần cải thiện:

1. Tạo issue trên repository
2. Submit pull request với cải thiện
3. Liên hệ team development

---

**Cập nhật lần cuối**: 2024  
**Phiên bản**: 1.1.0
