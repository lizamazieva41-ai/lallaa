# Archive Directory

Thư mục này chứa các file và thư mục đã được archive trong quá trình dọn dẹp dự án.

---

## Cấu Trúc

```
archive/
├── reports/              # Báo cáo phân tích dự án cũ
├── docker/               # Docker compose configuration variants
├── scripts/              # Framework và deployment scripts
├── security-assessments/ # Đánh giá bảo mật cũ
└── security-reports/     # Báo cáo bảo mật cũ
```

---

## Nội Dung

### reports/
Chứa các báo cáo phân tích dự án đã cũ:
- ANALYSIS_*.md - Báo cáo phân tích
- FINAL_*.md - Báo cáo tổng kết
- IMPLEMENTATION_*.md - Báo cáo triển khai
- PRODUCTION_*.md - Báo cáo production
- Và các báo cáo khác

### docker/
Chứa các file docker-compose variants không còn được sử dụng:
- docker-compose.vault-*.yml
- docker-compose.monitoring-simple.yml
- docker-compose.security.yml

### scripts/
Chứa các script framework và deployment scripts:
- *-framework.sh
- deploy-*.sh
- security-testing*.sh
- migrate-to-vault.sh
- verify-vault-secrets.sh

### security-assessments/
Chứa các đánh giá bảo mật cũ:
- compliance-assessment/
- remediation-plans/
- threat-modeling/
- security-controls/
- pentest-tools/

### security-reports/
Chứa các báo cáo bảo mật cũ:
- sast-reports/
- security-reports/
- dast-reports/

---

## Khôi Phục File

Nếu cần khôi phục file từ archive:

```bash
# Khôi phục một file cụ thể
cp archive/reports/ANALYSIS_REPORT.md .

# Khôi phục toàn bộ thư mục
cp -r archive/reports/* .
```

---

## Lưu Ý

- Các file trong archive không được sử dụng trong dự án hiện tại
- Có thể xóa archive nếu chắc chắn không cần
- Archive được tạo để tham khảo lịch sử

---

*Thư mục này được tạo trong quá trình dọn dẹp dự án ngày 2026-01-26.*
