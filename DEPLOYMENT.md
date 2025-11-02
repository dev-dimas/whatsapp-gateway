# 🚀 Deployment Checklist - Multi-Account WhatsApp Gateway

## Pre-Deployment Checklist

### ✅ Code & Dependencies

- [ ] All TypeScript code compiles without errors (`yarn type-check`)
- [ ] All dependencies installed (`yarn install`)
- [ ] Build succeeds (`yarn build`)
- [ ] No linting errors (`yarn lint`)
- [ ] Code reviewed and tested

### ✅ Environment Configuration

- [ ] `.env` file created with all required variables
- [ ] Strong API key generated and set (`API_KEY`)
- [ ] Database connection string configured (`DB_CONNECTION_STRING`)
- [ ] Rate limits configured appropriately
- [ ] Max accounts limit set (`MAX_ACCOUNTS`)
- [ ] Path base configured if using reverse proxy (`PATH_BASE`)

### ✅ Database Setup

- [ ] MongoDB installed and running
- [ ] Database accessible from application
- [ ] Connection tested successfully
- [ ] Backup strategy in place
- [ ] Monitoring configured

### ✅ Security

- [ ] API key is strong and unique (not default value)
- [ ] MongoDB secured (authentication enabled)
- [ ] Firewall configured to restrict access
- [ ] HTTPS enabled for production
- [ ] Rate limiting configured conservatively
- [ ] Input validation tested

### ✅ Storage & Permissions

- [ ] `data/sessions/` directory exists
- [ ] Application has read/write permissions
- [ ] Sufficient disk space available (50MB per account)
- [ ] Backup strategy for session files

### ✅ Testing

- [ ] Can create account successfully
- [ ] QR code generation works
- [ ] WhatsApp connection successful
- [ ] Message sending works
- [ ] Rate limiting works as expected
- [ ] API authentication works
- [ ] Error handling tested

---

## Production Environment Variables

Create `.env` file with these settings:

```env
# Server Configuration
NODE_ENV=production
PORT=80

# Database
DB_CONNECTION_STRING=mongodb://username:password@localhost:27017/whatsapp-gateway?authSource=admin

# Session
SESSION_SECRET=your-long-random-session-secret-here

# Path Base (if behind reverse proxy)
PATH_BASE=

# Multi-Account Limits
MAX_ACCOUNTS=10
MAX_MESSAGES_PER_HOUR=50
MAX_MESSAGES_PER_DAY=500
MESSAGE_DELAY_MIN=3000
MESSAGE_DELAY_MAX=8000
ACCOUNT_INIT_DELAY=30000
MAX_CONCURRENT_SENDING=3

# Security
API_KEY=generate-strong-random-key-here-minimum-32-characters
```

---

## Deployment Steps

### Option 1: Direct Node.js Deployment

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Yarn
npm install -g yarn

# Install MongoDB
# Follow: https://www.mongodb.com/docs/manual/installation/
```

#### 2. Application Setup

```bash
# Clone/copy your code
cd /opt
git clone <your-repo> whatsapp-gateway
cd whatsapp-gateway

# Install dependencies
yarn install

# Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Build application
yarn build

# Test run
yarn start
```

#### 3. Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start build/server.js --name whatsapp-gateway

# Setup auto-start
pm2 startup
pm2 save

# Monitor
pm2 logs whatsapp-gateway
pm2 monit
```

### Option 2: Docker Deployment

#### 1. Using Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

#### 2. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  mongodb:
    image: mongo:7
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: your-secure-password
    volumes:
      - mongodb_data:/data/db
    networks:
      - whatsapp-network

  app:
    build: .
    restart: always
    ports:
      - "80:80"
    environment:
      NODE_ENV: production
      DB_CONNECTION_STRING: mongodb://admin:your-secure-password@mongodb:27017/whatsapp-gateway?authSource=admin
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - mongodb
    networks:
      - whatsapp-network

volumes:
  mongodb_data:

networks:
  whatsapp-network:
    driver: bridge
```

Deploy:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## Nginx Reverse Proxy (Optional)

If you want HTTPS and better performance:

```nginx
# /etc/nginx/sites-available/whatsapp-gateway

upstream whatsapp_gateway {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy settings
    location / {
        proxy_pass http://whatsapp_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # File upload size
    client_max_body_size 50M;
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Monitoring & Maintenance

### Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# Check logs
pm2 logs whatsapp-gateway --lines 100

# Check status
pm2 status
```

### System Monitoring

```bash
# Disk usage
df -h
du -sh data/sessions/*

# Memory usage
free -h

# CPU usage
top

# MongoDB status
systemctl status mongod
```

### Database Maintenance

```bash
# Connect to MongoDB
mongo -u admin -p

# Check database size
use whatsapp-gateway
db.stats()

# Backup database
mongodump --db whatsapp-gateway --out /backup/$(date +%Y%m%d)

# Restore database
mongorestore --db whatsapp-gateway /backup/20231102/whatsapp-gateway
```

---

## Health Checks

### Automated Health Check Script

Create `health-check.sh`:

```bash
#!/bin/bash

API_KEY="your-api-key"
BASE_URL="http://localhost"

# Check if server is responding
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/status")

if [ $response -eq 200 ]; then
    echo "✅ Server is healthy"
else
    echo "❌ Server is down (HTTP $response)"
    # Send alert or restart service
    pm2 restart whatsapp-gateway
fi
```

Run every 5 minutes:

```bash
chmod +x health-check.sh
crontab -e
# Add: */5 * * * * /opt/whatsapp-gateway/health-check.sh >> /var/log/whatsapp-health.log 2>&1
```

---

## Backup Strategy

### Daily Backup Script

Create `backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backup/whatsapp-gateway"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR/$DATE

# Backup MongoDB
mongodump --db whatsapp-gateway --out $BACKUP_DIR/$DATE/db

# Backup sessions
cp -r data/sessions $BACKUP_DIR/$DATE/

# Backup .env
cp .env $BACKUP_DIR/$DATE/

# Compress
cd $BACKUP_DIR
tar -czf whatsapp-gateway-$DATE.tar.gz $DATE
rm -rf $DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: whatsapp-gateway-$DATE.tar.gz"
```

Schedule daily:

```bash
chmod +x backup.sh
crontab -e
# Add: 0 2 * * * /opt/whatsapp-gateway/backup.sh >> /var/log/whatsapp-backup.log 2>&1
```

---

## Troubleshooting

### Common Issues

#### 1. Cannot Connect to MongoDB

```bash
# Check MongoDB status
systemctl status mongod

# Check connection
mongo --host localhost --port 27017

# Check logs
tail -f /var/log/mongodb/mongod.log
```

#### 2. QR Code Not Generating

```bash
# Check logs
pm2 logs whatsapp-gateway

# Verify account created
curl -H "X-API-Key: your-key" http://localhost/accounts

# Check file permissions
ls -la data/sessions/
```

#### 3. Rate Limit Issues

```bash
# Check account status
curl http://localhost/accounts/account1/status

# Review rate limit settings in .env
cat .env | grep MAX_MESSAGES
```

#### 4. Memory Issues

```bash
# Check memory usage
pm2 monit

# Increase Node.js memory limit
pm2 delete whatsapp-gateway
pm2 start build/server.js --name whatsapp-gateway --node-args="--max-old-space-size=4096"
```

---

## Performance Tuning

### Node.js Optimization

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" pm2 start build/server.js

# Enable cluster mode (multiple processes)
pm2 start build/server.js -i max --name whatsapp-gateway
```

### MongoDB Optimization

```javascript
// Create indexes for better performance
use whatsapp-gateway

db.accounts.createIndex({ "accountId": 1 })
db.accounts.createIndex({ "isActive": 1 })
db.accounts.createIndex({ "status": 1 })
```

---

## Security Hardening

### Firewall Setup

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Block direct MongoDB access
sudo ufw deny 27017/tcp
```

### Fail2Ban (Optional)

Protect against brute force attacks:

```bash
sudo apt install fail2ban

# Create filter for failed API auth
sudo nano /etc/fail2ban/filter.d/whatsapp-gateway.conf
```

```ini
[Definition]
failregex = .* 401.*X-API-Key.*<HOST>
            .* 403.*Invalid API key.*<HOST>
ignoreregex =
```

---

## Post-Deployment Checklist

- [ ] Application starts successfully
- [ ] Can access web interface
- [ ] API authentication works
- [ ] Can create accounts
- [ ] QR codes generate properly
- [ ] Messages send successfully
- [ ] Rate limiting works
- [ ] Logs are being written
- [ ] Backups are running
- [ ] Monitoring is active
- [ ] SSL/HTTPS working (if configured)
- [ ] Health checks passing

---

## Support & Documentation

- **API Documentation**: `API_DOCUMENTATION.md`
- **Quick Start Guide**: `MULTI_ACCOUNT_README.md`
- **Architecture**: `ARCHITECTURE.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`

---

## Emergency Procedures

### Service Down

1. Check logs: `pm2 logs`
2. Check system resources: `top`, `df -h`
3. Restart service: `pm2 restart whatsapp-gateway`
4. Check MongoDB: `systemctl status mongod`

### Account Banned

1. Stop sending from that account immediately
2. Delete the account via API
3. Wait 24-48 hours before retry
4. Review message patterns and content
5. Reduce message volume

### Database Corruption

1. Stop application
2. Restore from latest backup
3. Verify data integrity
4. Restart application

---

**Remember**: Always test in staging before deploying to production!

Good luck with your deployment! 🚀
