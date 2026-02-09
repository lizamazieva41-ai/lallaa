#!/bin/bash
# cleanup-remove-duplicates.sh
# Script để xóa các file trùng đã có trong archive

echo "=== Xóa File Trùng ==="
echo ""

files_to_remove=(
    "ANALYSIS_EXECUTION_REPORT.md"
    "CI_CD_INTEGRATION.md"
    "README_DEPLOY_LINUX_PM2.md"
)

removed_count=0
skipped_count=0

for file in "${files_to_remove[@]}"; do
    if [ -f "$file" ]; then
        archive_path="archive/reports/$file"
        if [ -f "$archive_path" ]; then
            echo "Xóa $file (đã có trong archive)..."
            if rm -f "$file"; then
                echo "  ✅ Đã xóa $file"
                ((removed_count++))
            else
                echo "  ⚠️  Không thể xóa $file"
                ((skipped_count++))
            fi
        else
            echo "  ⚠️  File $file không có trong archive, bỏ qua"
            ((skipped_count++))
        fi
    else
        echo "  ℹ️  File $file không tồn tại, bỏ qua"
    fi
done

echo ""
echo "=== Kết quả ==="
echo "Đã xóa: $removed_count file(s)"
echo "Bỏ qua: $skipped_count file(s)"
echo ""

if [ $removed_count -gt 0 ]; then
    echo "✅ Hoàn thành!"
else
    echo "ℹ️  Không có file nào được xóa"
fi
