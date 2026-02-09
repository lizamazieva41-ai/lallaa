# Linux + PM2 Production Deployment

This guide covers deploying the Payment Sandbox API on Linux servers using PM2 process manager.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **Node.js**: 18.x or higher
- **PostgreSQL**: 15.x or higher  
- **Redis**: 7.x or higher
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: Minimum 20GB disk space
- **Network**: Outbound internet access for dependencies

### Software Installation

#### Ubuntu/Debian
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Redis
sudo apt install redis-server -y

# Install PM2 globally
sudo npm install -g pm2

# Install build tools
sudo apt install build-essential -y
```

#### CentOS/RHEL
```bash
# Update system
sudo dnf update -y

# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Install PostgreSQL
sudo dnf install postgresql-server postgresql-contrib -y
sudo postgresql-setup --initdb

# Install Redis
sudo dnf install redis -y

# Install PM2 globally
sudo npm install -g pm2

# Install build tools
sudo dnf groupinstall "Development Tools" -y
```

## Database Setup

### PostgreSQL Configuration
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE payment_sandbox;
CREATE USER sandbox_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE payment_sandbox TO sandbox_user;
\q

# Configure PostgreSQL (optional, for production tuning)
sudo nano /etc/postgresql/15/main/postgresql.conf
```

### Redis Configuration
```bash
# Configure Redis for production
sudo nano /etc/redis/redis.conf

# Key settings to update:
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

## Application Deployment

### 1. Clone and Install
```bash
# Create application directory
sudo mkdir -p /opt/payment-sandbox-api
sudo chown $USER:$USER /opt/payment-sandbox-api
cd /opt/payment-sandbox-api

# Clone repository (replace with your actual repo)
git clone <your-repository-url> .

# Install dependencies
npm ci --production
```

### 2. Environment Configuration
```bash
# Create production environment file
cp .env.example .env
nano .env
```

Critical environment variables:
```bash
# Application
NODE_ENV=production
API_PORT=3000
API_HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://sandbox_user:your_secure_password@localhost:5432/payment_sandbox

# Redis
REDIS_URL=redis://localhost:6379

# Security (generate strong secrets)
JWT_SECRET=your_jwt_secret_here_256_bits_min
JWT_REFRESH_SECRET=your_refresh_secret_here_256_bits_min

# Features (set to false by default for security)
FEATURE_CARD_GENERATION=false
FEATURE_TEST_CARDS_ACCESS=true
```

### 3. Database Migration
```bash
# Run database migrations
npm run migrate
```

### 4. Build Application
```bash
# Build TypeScript
npm run build
```

### 5. PM2 Configuration
The `ecosystem.config.js` file is already configured for production. Verify the settings:

```javascript
module.exports = {
  apps: [
    {
      name: 'payment-sandbox-api',
      script: 'dist/index.js',
      instances: 'max',  // Use all CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

### 6. Start Application
```bash
# Create logs directory
mkdir -p logs

# Start with PM2
npm run start:pm2

# Verify status
npm run status:pm2
```

## System Configuration

### PM2 Startup Configuration
```bash
# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions - it will ask you to run a command with sudo

# Save current PM2 processes
pm2 save
```

### Nginx Reverse Proxy (Optional but Recommended)
```bash
# Install Nginx
sudo apt install nginx -y  # Ubuntu/Debian
# sudo dnf install nginx -y  # CentOS/RHEL

# Create site configuration
sudo nano /etc/nginx/sites-available/payment-sandbox-api
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # API proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/payment-sandbox-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Monitoring and Maintenance

### PM2 Management Scripts
```bash
# Check application status
npm run status:pm2

# View real-time logs
npm run logs:pm2

# Restart application
npm run restart:pm2

# Stop application
npm run stop:pm2

# View application metrics
pm2 monit
```

### Log Management
```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/err.log

# Rotate logs (add to crontab)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### Health Checks
```bash
# Check if application is responding
curl http://localhost:3000/health

# Check API endpoints
curl -X GET "http://localhost:3000/api/v1/countries" \
  -H "Authorization: Bearer your_token"
```

### Backup Strategy
```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h localhost -U sandbox_user payment_sandbox > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Delete backups older than 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Database backup completed: $BACKUP_DIR/db_backup_$DATE.sql.gz"
```

## Security Best Practices

### Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw deny 3000  # Block direct access to Node.js app
sudo ufw enable
```

### SSL Certificate
```bash
# Use Let's Encrypt for free SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com

# Auto-renewal (already configured)
sudo systemctl status certbot.timer
```

### Regular Updates
```bash
# Create update script
#!/bin/bash
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

echo "Updating Node.js dependencies..."
cd /opt/payment-sandbox-api
npm update

echo "Restarting application..."
npm run restart:pm2

echo "Update completed!"
```

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check configuration validation
npm run build && NODE_ENV=production node dist/index.js

# Check missing environment variables
pm2 logs payment-sandbox-api --err
```

#### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U sandbox_user -d payment_sandbox

# Check PostgreSQL status
sudo systemctl status postgresql
```

#### High Memory Usage
```bash
# Monitor PM2 processes
pm2 monit

# Adjust memory limits in ecosystem.config.js
max_memory_restart: '512M'  # Reduce if needed
```

#### Rate Limiting Issues
```bash
# Check Redis status
sudo systemctl status redis
redis-cli ping

# Monitor Redis memory
redis-cli info memory
```

### Emergency Recovery
```bash
# Full application restart
pm2 stop all
pm2 start ecosystem.config.js --env production
pm2 save

# Database recovery (if needed)
psql -h localhost -U sandbox_user -d payment_sandbox < backup.sql
```

## Performance Optimization

### System Tuning
```bash
# Increase file limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize network settings
echo "net.core.somaxconn = 65536" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### PM2 Optimization
```bash
# Configure PM2 for high performance
pm2 delete all  # Stop current processes
pm2 start ecosystem.config.js --env production

# Enable clustering (uses all CPU cores)
pm2 start ecosystem.config.js -i max
```

### Database Optimization
```sql
-- Analyze and optimize PostgreSQL
VACUUM ANALYZE;

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

---

## Support

For issues and questions:
1. Check application logs: `pm2 logs`
2. Verify configuration: Validate all environment variables
3. Check system resources: `htop`, `df -h`, `free -h`
4. Test endpoints manually with curl

The application is now ready for production use with PM2 process management!