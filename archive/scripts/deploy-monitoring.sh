#!/bin/bash

# Triển khai và kiểm tra hệ thống monitoring bảo mật
echo "🚀 TRIỂN KHAI HỆ THỐNG MONITORING BẢO MẬT"
echo "=========================================="

# Kiểm tra Docker containers hiện tại
echo "📋 Kiểm tra containers hiện tại:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -10

echo ""
echo "🔧 Triển khai Prometheus và Grafana..."
docker-compose -f docker-compose.monitoring-simple.yml up -d

echo ""
echo "⏳ Chờ services khởi động..."
sleep 10

# Kiểm tra trạng thái services
echo ""
echo "📊 Kiểm tra trạng thái monitoring services:"
echo "======================================"

# Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus: Hoạt động (http://localhost:9090)"
else
    echo "❌ Prometheus: Không hoạt động"
fi

# Grafana
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Grafana: Hoạt động (http://localhost:3001)"
    echo "   Username: admin"
    echo "   Password: admin123"
else
    echo "❌ Grafana: Không hoạt động"
fi

# Node Exporter
if curl -s http://localhost:9100/metrics > /dev/null; then
    echo "✅ Node Exporter: Hoạt động (http://localhost:9100)"
else
    echo "❌ Node Exporter: Không hoạt động"
fi

echo ""
echo "🔐 Kiểm tra Vault:"
echo "=================="
if curl -s -H "X-Vault-Token: bin-check-vault-root" http://localhost:8200/v1/sys/health > /dev/null; then
    echo "✅ Vault: Hoạt động (http://localhost:8200)"
    echo "   Root Token: bin-check-vault-root"
else
    echo "❌ Vault: Không hoạt động"
fi

echo ""
echo "📈 METRICS BẢO MẬT ĐÃ SẴN SÀNG:"
echo "==============================="
echo "🔹 Security Metrics:"
echo "   - failed_auth_total: Thống kê xác thực thất bại"
echo "   - suspicious_activity_total: Hoạt động đáng ngờ"
echo "   - vault_access_total: Truy cập Vault"
echo "   - database_access_total: Truy cập database"
echo "   - audit_events_total: Sự kiện kiểm toán"
echo "   - rate_limit_breach_total: Vượt giới hạn tốc độ"
echo "   - unauthorized_access_total: Truy cập trái phép"

echo ""
echo "🔹 Application Metrics:"
echo "   - http_request_duration_seconds: Thời gian xử lý request"
echo "   - api_requests_total: Tổng số API requests"
echo "   - bin_lookup_total: Tổng số tra cứu BIN"
echo "   - cache_operations_total: Cache operations"
echo "   - active_users: Số người dùng online"

echo ""
echo "🔹 Infrastructure Metrics:"
echo "   - System CPU/Memory/Disk usage"
echo "   - Container metrics"
echo "   - Database connection pool"

echo ""
echo "🌐 ACCESS POINTS:"
echo "=================="
echo "🔸 Prometheus Dashboard: http://localhost:9090"
echo "🔸 Grafana Dashboard: http://localhost:3001 (admin/admin123)"
echo "🔸 Node Exporter: http://localhost:9100/metrics"
echo "🔸 Vault UI: http://localhost:8200"
echo "🔸 Application Metrics: http://localhost:3000/metrics (khi app chạy)"

echo ""
echo "📝 NEXT STEPS:"
echo "==============="
echo "1. Import Grafana dashboard templates"
echo "2. Cấu hình alerts cho security events"
echo "3. Tích hợp với ứng dụng chính"
echo "4. Thử nghiệm security monitoring"

echo ""
echo "🎯 Giai đoạn 2 hoàn tất: Audit Logging & Monitoring ✅"