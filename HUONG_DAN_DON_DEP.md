# Hướng Dẫn Dọn Dẹp Dự Án

**Ngày tạo**: 2026-01-26  
**Phiên bản**: 1.0

---

## Tổng Quan

Tài liệu này hướng dẫn cách thực hiện dọn dẹp dự án để loại bỏ các file dư thừa và tổ chức lại cấu trúc thư mục.

---

## Các Script Đã Tạo

### 1. Script Node.js (Khuyến nghị) ✅

**File**: `cleanup-move-files.js`

**Cách sử dụng**:
```bash
node cleanup-move-files.js
```

**Chức năng**:
- Tự động di chuyển tất cả file báo cáo vào `archive/reports/`
- Di chuyển SQL debug files vào `src/database/debug/`
- Di chuyển docker-compose variants vào `archive/docker/`
- Di chuyển framework scripts vào `archive/scripts/`
- Di chuyển thư mục đánh giá bảo mật vào `archive/security-assessments/`
- Di chuyển thư mục báo cáo bảo mật vào `archive/security-reports/`

**Ưu điểm**: 
- Không cần Python
- Chạy trực tiếp với Node.js (đã có sẵn trong dự án)
- Tự động tạo thư mục nếu chưa có
- Hiển thị kết quả chi tiết

### 2. Script PowerShell

**File**: `cleanup-project.ps1`

**Cách sử dụng**:
```powershell
.\cleanup-project.ps1
```

**Chức năng**: Dọn dẹp tự động (xóa coverage, logs, temp files)

### 3. Script Python

**File**: `cleanup-automated.py`

**Cách sử dụng**:
```bash
python cleanup-automated.py
```

**Chức năng**: Tương tự script Node.js

---

## Quy Trình Thực Hiện

### Bước 1: Backup (Quan trọng!)

Trước khi thực hiện bất kỳ thao tác nào, hãy tạo backup:

```bash
# Tạo thư mục backup
mkdir ../bin-check-api-backup-$(date +%Y%m%d)

# Sao chép dự án (trừ node_modules)
rsync -av --exclude='node_modules' --exclude='.git' --exclude='coverage' . ../bin-check-api-backup-$(date +%Y%m%d)/
```

Hoặc trên Windows PowerShell:
```powershell
$backupDir = "../bin-check-api-backup-$(Get-Date -Format 'yyyyMMdd')"
New-Item -ItemType Directory -Path $backupDir -Force
# Sao chép file (sử dụng Copy-Item hoặc robocopy)
```

### Bước 2: Chạy Script Di chuyển File

**Khuyến nghị**: Sử dụng script Node.js

```bash
node cleanup-move-files.js
```

Script sẽ:
1. Di chuyển 29 file báo cáo vào `archive/reports/`
2. Di chuyển 7 file SQL debug vào `src/database/debug/`
3. Di chuyển 8 file docker-compose vào `archive/docker/`
4. Di chuyển 12 script framework vào `archive/scripts/`
5. Di chuyển 5 thư mục đánh giá bảo mật vào `archive/security-assessments/`
6. Di chuyển 3 thư mục báo cáo bảo mật vào `archive/security-reports/`

### Bước 3: Xóa File Tạm và Coverage

```bash
# Xóa coverage reports (có thể tạo lại)
rm -rf coverage/

# Xóa logs
find logs/ -name "*.log" -delete

# Xóa file tạm
find . -name "*.tmp" -o -name "*.temp" -o -name "*.bak" | grep -v node_modules | xargs rm -f
```

Hoặc sử dụng script PowerShell:
```powershell
.\cleanup-project.ps1
```

### Bước 4: Kiểm tra Dự án

Sau khi dọn dẹp, kiểm tra dự án vẫn hoạt động:

```bash
# Build
npm run build

# Tests
npm test

# Lint
npm run lint
```

Hoặc sử dụng script kiểm tra:
```powershell
.\verify-cleanup.ps1
```

---

## Danh Sách File Sẽ Được Di Chuyển

### Báo cáo Phân tích (29 files)
- ANALYSIS_*.md (5 files)
- FINAL_*.md (3 files)
- IMPLEMENTATION_*.md (2 files)
- PRODUCTION_*.md (3 files)
- Và các báo cáo khác (16 files)

### SQL Debug Files (7 files)
- debug-*.sql (3 files)
- test-rls-*.sql (4 files)

### Docker Compose Variants (8 files)
- docker-compose.vault-*.yml (6 files)
- docker-compose.monitoring-simple.yml
- docker-compose.security.yml

### Framework Scripts (12 files)
- *-framework.sh (4 files)
- deploy-*.sh (3 files)
- security-testing*.sh (2 files)
- migrate-to-vault.sh
- verify-vault-secrets.sh

### Thư mục Đánh giá Bảo mật (5 thư mục)
- compliance-assessment/
- remediation-plans/
- threat-modeling/
- security-controls/
- pentest-tools/

### Thư mục Báo cáo Bảo mật (3 thư mục)
- sast-reports/
- security-reports/
- dast-reports/

---

## Kết Quả Mong Đợi

Sau khi hoàn thành:
- **Kích thước giảm**: 30-50%
- **Số file giảm**: ~50-70 files từ thư mục gốc
- **Cấu trúc**: Rõ ràng, dễ navigate hơn
- **Build/Test**: Vẫn hoạt động bình thường

---

## Khôi Phục Nếu Cần

Nếu cần khôi phục file từ archive:

```bash
# Khôi phục một file cụ thể
cp archive/reports/ANALYSIS_REPORT.md .

# Khôi phục toàn bộ thư mục
cp -r archive/reports/* .
```

---

## Lưu Ý Quan Trọng

1. **Luôn tạo backup trước khi chạy script**
2. **Kiểm tra kỹ sau khi di chuyển file**
3. **Commit thay đổi vào Git sau khi hoàn thành**
4. **File trong archive vẫn có thể truy cập nếu cần**

---

## Troubleshooting

### Lỗi: "Cannot find module"
```bash
# Đảm bảo đang ở thư mục gốc dự án
cd /path/to/bin-check-api

# Chạy lại script
node cleanup-move-files.js
```

### Lỗi: "Permission denied"
- Trên Windows: Chạy PowerShell với quyền Administrator
- Trên Linux/Mac: Sử dụng `sudo` nếu cần

### File không được di chuyển
- Kiểm tra file có tồn tại không
- Kiểm tra quyền truy cập file
- Xem log trong console để biết lý do

---

## Hỗ Trợ

Nếu gặp vấn đề:
1. Xem `CLEANUP_LOG.md` để biết chi tiết
2. Xem `CLEANUP_SUMMARY.md` để biết tóm tắt
3. Khôi phục từ backup nếu cần

---

*Tài liệu này được tạo trong quá trình dọn dẹp dự án.*
