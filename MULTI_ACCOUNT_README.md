# Multi-Account WhatsApp Gateway - Quick Start

## 🚀 Features

- ✅ **Multiple WhatsApp Accounts**: Manage up to 10 accounts simultaneously (configurable)
- ✅ **Anti-Ban Protection**: Built-in rate limiting, delays, and natural behavior simulation
- ✅ **Rate Limiting**: Configurable hourly/daily message limits per account
- ✅ **Session Persistence**: Auto-reconnect on restart with saved sessions
- ✅ **API Authentication**: Secure with API key protection
- ✅ **Message Statistics**: Track usage per account in real-time
- ✅ **Backward Compatible**: Legacy endpoints still work for single account
- ✅ **Easy Management**: RESTful API for account creation, deletion, and monitoring

## 📋 Prerequisites

- Node.js 16+ and Yarn
- MongoDB
- Docker (optional)

## 🛠️ Installation

### 1. Install Dependencies

```bash
yarn install
```

### 2. Configure Environment

Copy and edit `.env` file:

```bash
cp .env.example .env
```

**Required Settings:**

```env
DB_CONNECTION_STRING=mongodb://localhost:27017/whatsapp-gateway

# Multi-Account Configuration
MAX_ACCOUNTS=10
MAX_MESSAGES_PER_HOUR=50
MAX_MESSAGES_PER_DAY=500
MESSAGE_DELAY_MIN=3000
MESSAGE_DELAY_MAX=8000
ACCOUNT_INIT_DELAY=30000
MAX_CONCURRENT_SENDING=3

# Security
API_KEY=your-secret-api-key-change-this
```

### 3. Start MongoDB

```bash
# Using Docker
docker-compose up -d mongodb

# Or use local MongoDB
mongod --dbpath ./data/db
```

### 4. Build and Run

```bash
# Development
yarn dev

# Production
yarn build
yarn start
```

## 🎯 Quick Start Guide

### Step 1: Create an Account

```bash
curl -X POST "http://localhost/accounts" \
  -H "X-API-Key: your-secret-api-key-change-this" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "sales",
    "name": "Sales Department"
  }'
```

### Step 2: Get QR Code

Open in browser:

```
http://localhost/accounts/sales/qr
```

Scan with WhatsApp mobile app.

### Step 3: Check Status

```bash
curl "http://localhost/accounts/sales/status"
```

### Step 4: Send Message

```bash
curl -X POST "http://localhost/accounts/sales/message" \
  -H "X-API-Key: your-secret-api-key-change-this" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "message": "Hello from WhatsApp Gateway!"
  }'
```

## 📊 Account Management

### List All Accounts

```bash
curl "http://localhost/accounts" \
  -H "X-API-Key: your-secret-api-key-change-this"
```

### Get Account Details

```bash
curl "http://localhost/accounts/sales" \
  -H "X-API-Key: your-secret-api-key-change-this"
```

### Delete Account

```bash
curl -X DELETE "http://localhost/accounts/sales" \
  -H "X-API-Key: your-secret-api-key-change-this"
```

## 🛡️ Anti-Ban Protection

### Automatic Features

- **Rate Limiting**: 50 messages/hour, 500/day per account
- **Random Delays**: 3-8 seconds between messages
- **Presence Simulation**: Natural typing indicators
- **Concurrent Limits**: Max 3 accounts sending at once
- **Connection Throttling**: 30s delay between account initializations

### Best Practices

1. ✅ Never exceed 500 messages/day per account
2. ✅ Distribute load across multiple accounts
3. ✅ Use realistic message content (no spam)
4. ✅ Monitor account status regularly
5. ✅ Start with low volumes and gradually increase
6. ✅ Respect the automatic delays
7. ✅ Only send to real, active WhatsApp numbers

## 📁 Project Structure

```
whatsapp-gateway/
├── src/
│   ├── controllers/
│   │   ├── account.ts          # Account management
│   │   ├── message.ts          # Messaging (multi + legacy)
│   │   ├── qr.ts               # QR code (multi + legacy)
│   │   └── status.ts           # Status (multi + legacy)
│   ├── middleware/
│   │   └── auth.ts             # API key authentication
│   ├── models/
│   │   └── account.ts          # Account database model
│   ├── services/
│   │   ├── whatsapp-account-manager.ts  # Multi-account manager
│   │   ├── rate-limiter-service.ts      # Rate limiting
│   │   └── whatsapp-service.ts          # Legacy single account
│   └── util/
│       └── environment.ts      # Configuration
├── data/
│   └── sessions/               # Session storage per account
│       ├── account1/
│       ├── account2/
│       └── ...
├── .env                        # Environment configuration
└── API_DOCUMENTATION.md        # Full API docs
```

## 🔧 Configuration Options

### Rate Limiting

```env
MAX_MESSAGES_PER_HOUR=50      # Max messages per hour per account
MAX_MESSAGES_PER_DAY=500       # Max messages per day per account
MESSAGE_DELAY_MIN=3000         # Min delay between messages (ms)
MESSAGE_DELAY_MAX=8000         # Max delay between messages (ms)
```

### Account Limits

```env
MAX_ACCOUNTS=10                # Maximum number of accounts
ACCOUNT_INIT_DELAY=30000       # Delay between account initializations (ms)
MAX_CONCURRENT_SENDING=3       # Max accounts sending simultaneously
```

### Security

```env
API_KEY=your-secret-key        # API key for protected endpoints
```

## 🐛 Troubleshooting

### Account Won't Connect

```bash
# Check status
curl "http://localhost/accounts/sales/status"

# View QR code again
# Open: http://localhost/accounts/sales/qr

# Check logs
tail -f logs/app.log
```

### Rate Limit Hit

```bash
# Check current usage
curl "http://localhost/accounts/sales/status" | jq '.messageStats'

# Response shows:
# {
#   "hourlyCount": 50,
#   "dailyCount": 450,
#   "hourlyLimit": 50,
#   "dailyLimit": 500
# }
```

**Solution**: Wait for limits to reset or use another account

### Session Expired

```bash
# Delete and recreate account
curl -X DELETE "http://localhost/accounts/sales" \
  -H "X-API-Key: your-api-key"

curl -X POST "http://localhost/accounts" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"accountId": "sales", "name": "Sales Department"}'
```

## 📈 Monitoring

### Check All Account Statistics

```bash
curl "http://localhost/accounts" \
  -H "X-API-Key: your-api-key" | jq
```

### Monitor Specific Account

```bash
watch -n 5 'curl -s "http://localhost/accounts/sales/status" | jq'
```

### View Logs

```bash
# Application logs
tail -f logs/app.log

# Docker logs
docker-compose logs -f app
```

## 🔄 Migration from Single Account

1. **Keep existing setup working**: Legacy endpoints still function
2. **Create new accounts**: Use `/accounts` endpoint
3. **Gradually migrate**: Update clients to use `/accounts/:id/message`
4. **Monitor both**: Both systems can run simultaneously

## 📖 Full Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/dev-dimas/whatsapp-gateway/issues)
- **Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Baileys Docs**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)

## ⚠️ Important Notes

### WhatsApp Terms of Service

- Use responsibly and follow WhatsApp's Terms of Service
- Don't send spam or unsolicited messages
- Respect user privacy
- This tool is for legitimate business use only

### Rate Limits

- Limits are conservative to prevent bans
- Adjust only if you understand the risks
- WhatsApp may ban accounts that violate their policies

### Production Use

- Use strong API keys
- Enable HTTPS in production
- Regular database backups
- Monitor account health
- Implement error alerting

## 📝 License

ISC License - See LICENSE file for details

---

Made with ❤️ for safe and responsible WhatsApp automation
