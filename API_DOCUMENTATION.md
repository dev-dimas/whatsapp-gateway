# WhatsApp Gateway - Multi-Account API Documentation

## Overview

This WhatsApp Gateway now supports multiple account management with built-in rate limiting and anti-ban protection features.

## Authentication

Protected endpoints require an API key to be passed either as:

- Header: `X-API-Key: your-api-key`
- Query parameter: `?apiKey=your-api-key`

Configure your API key in the `.env` file:

```env
API_KEY=your-secret-api-key-change-this
```

## Rate Limiting & Anti-Ban Features

### Automatic Protection

- ✅ **Hourly Limit**: Max 50 messages per hour per account (configurable)
- ✅ **Daily Limit**: Max 500 messages per day per account (configurable)
- ✅ **Message Delays**: Random 3-8 second delays between messages (configurable)
- ✅ **Concurrent Sending**: Max 3 accounts sending simultaneously (configurable)
- ✅ **Presence Simulation**: Realistic typing indicators and composing states
- ✅ **Connection Throttling**: 30-second delays between account initializations

### Configuration

Edit `.env` file to adjust limits:

```env
MAX_ACCOUNTS=10
MAX_MESSAGES_PER_HOUR=50
MAX_MESSAGES_PER_DAY=500
MESSAGE_DELAY_MIN=3000
MESSAGE_DELAY_MAX=8000
ACCOUNT_INIT_DELAY=30000
MAX_CONCURRENT_SENDING=3
```

---

## API Endpoints

### Account Management

#### 1. Create Account

Creates a new WhatsApp account instance.

**Endpoint:** `POST /accounts`  
**Auth:** Required  
**Body:**

```json
{
  "accountId": "account1",
  "name": "Business Account 1"
}
```

**Response:**

```json
{
  "statusCode": 201,
  "message": "Account created successfully",
  "data": {
    "accountId": "account1",
    "name": "Business Account 1",
    "status": "disconnected",
    "createdAt": "2025-11-02T10:00:00.000Z"
  }
}
```

**Notes:**

- `accountId` must be unique and contain only letters, numbers, hyphens, and underscores
- After creation, use the QR endpoint to scan and connect the account

---

#### 2. List All Accounts

Get all active accounts with their current status.

**Endpoint:** `GET /accounts`  
**Auth:** Required

**Response:**

```json
{
  "statusCode": 200,
  "message": "OK",
  "data": [
    {
      "accountId": "account1",
      "accountName": "Business Account 1",
      "isConnected": true,
      "phoneNumber": "+1234567890",
      "qrcode": "",
      "needRestart": false,
      "status": "connected",
      "messageStats": {
        "hourlyCount": 5,
        "dailyCount": 45,
        "hourlyLimit": 50,
        "dailyLimit": 500
      }
    }
  ]
}
```

---

#### 3. Get Account Details

Get detailed information about a specific account.

**Endpoint:** `GET /accounts/:accountId`  
**Auth:** Required

**Response:**

```json
{
  "statusCode": 200,
  "message": "OK",
  "data": {
    "accountId": "account1",
    "name": "Business Account 1",
    "phoneNumber": "+1234567890",
    "status": "connected",
    "sessionPath": "/path/to/sessions/account1",
    "lastConnected": "2025-11-02T10:30:00.000Z",
    "messageCount": 45,
    "isActive": true,
    "createdAt": "2025-11-02T10:00:00.000Z",
    "connectionStatus": {
      "isConnected": true,
      "phoneNumber": "+1234567890",
      "status": "connected",
      "messageStats": {
        "hourlyCount": 5,
        "dailyCount": 45,
        "hourlyLimit": 50,
        "dailyLimit": 500
      }
    }
  }
}
```

---

#### 4. Delete Account

Remove an account and clean up its sessions.

**Endpoint:** `DELETE /accounts/:accountId`  
**Auth:** Required

**Response:**

```json
{
  "statusCode": 200,
  "message": "Account deleted successfully",
  "data": null
}
```

---

### Account Operations

#### 5. Get QR Code

Get the QR code for scanning with WhatsApp mobile app.

**Endpoint:** `GET /accounts/:accountId/qr`  
**Auth:** None (public)

**Response:** HTML page with QR code image or connection status

**Usage:**

1. Create an account
2. Open this URL in a browser
3. Scan the QR code with WhatsApp mobile app
4. Wait for connection to establish

---

#### 6. Get Account Status

Get real-time connection status and message statistics.

**Endpoint:** `GET /accounts/:accountId/status`  
**Auth:** None (public)

**Response:**

```json
{
  "accountId": "account1",
  "accountName": "Business Account 1",
  "isConnected": true,
  "phoneNumber": "+1234567890",
  "qrcode": "",
  "needRestart": false,
  "status": "connected",
  "messageStats": {
    "hourlyCount": 5,
    "dailyCount": 45,
    "hourlyLimit": 50,
    "dailyLimit": 500
  }
}
```

**Status Values:**

- `connecting` - Waiting for QR scan
- `connected` - Active and ready to send messages
- `disconnected` - Connection lost, will auto-reconnect
- `logged_out` - Manually logged out, needs new QR scan
- `banned` - Account banned by WhatsApp

---

### Messaging

#### 7. Send Text Message

Send a text message through a specific account.

**Endpoint:** `POST /accounts/:accountId/message`  
**Auth:** Required  
**Body:**

```json
{
  "phoneNumber": "+1234567890",
  "message": "Hello from WhatsApp Gateway!"
}
```

**Response (Success):**

```json
{
  "statusCode": 200,
  "message": "Message sent successfully",
  "errors": null
}
```

**Response (Rate Limited):**

```json
{
  "statusCode": 400,
  "message": "Hourly rate limit exceeded",
  "waitTime": 1800,
  "errors": null
}
```

**Notes:**

- Phone numbers should include country code (e.g., +1234567890)
- Accepts formats: +1234567890, 1234567890, +1 234 567-890
- Automatic rate limiting applied
- Random delay (3-8s) added for natural behavior

---

#### 8. Send Image Message

Send an image with optional caption.

**Endpoint:** `POST /accounts/:accountId/message/image`  
**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Form Fields:**

- `phoneNumber`: string (required)
- `caption`: string (optional)
- `image`: file (required, max 50MB)

**Response:**

```json
{
  "statusCode": 200,
  "message": "Media sent successfully",
  "errors": null
}
```

**Example (curl):**

```bash
curl -X POST "http://localhost/accounts/account1/message/image" \
  -H "X-API-Key: your-api-key" \
  -F "phoneNumber=+1234567890" \
  -F "caption=Check out this image!" \
  -F "image=@/path/to/image.jpg"
```

---

#### 9. Send Document Message

Send a document file with optional caption.

**Endpoint:** `POST /accounts/:accountId/message/document`  
**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Form Fields:**

- `phoneNumber`: string (required)
- `caption`: string (optional)
- `document`: file (required, max 50MB)

**Response:**

```json
{
  "statusCode": 200,
  "message": "Media sent successfully",
  "errors": null
}
```

**Example (curl):**

```bash
curl -X POST "http://localhost/accounts/account1/message/document" \
  -H "X-API-Key: your-api-key" \
  -F "phoneNumber=+1234567890" \
  -F "caption=Here is the report" \
  -F "document=@/path/to/report.pdf"
```

---

## Legacy Endpoints (Backward Compatibility)

The following endpoints continue to work with the original single-account setup:

- `POST /message` - Send text message
- `POST /message/image` - Send image
- `POST /message/document` - Send document
- `GET /qr` - Get QR code
- `GET /status` - Get status

**Note:** Legacy endpoints use optional API key authentication.

---

## Error Handling

### Common Error Responses

**Account Not Found (404):**

```json
{
  "statusCode": 404,
  "message": "Account not found",
  "errors": null
}
```

**Rate Limit Exceeded (400):**

```json
{
  "statusCode": 400,
  "message": "Hourly rate limit exceeded",
  "waitTime": 1800,
  "errors": null
}
```

**Unauthorized (401):**

```json
{
  "statusCode": 401,
  "message": "API key is required",
  "errors": null
}
```

**Validation Error (400):**

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "errors": [
    {
      "msg": "Phone number cannot be blank!",
      "param": "phoneNumber",
      "location": "body"
    }
  ]
}
```

---

## Best Practices

### Anti-Ban Guidelines

1. **Respect Rate Limits**: Don't try to bypass the built-in limits
2. **Use Multiple Accounts**: Distribute load across accounts
3. **Monitor Status**: Check account status regularly
4. **Natural Delays**: The system adds automatic delays - don't disable them
5. **Gradual Ramp-up**: Start with low volumes and gradually increase
6. **Valid Phone Numbers**: Only send to real, active WhatsApp numbers
7. **Quality Content**: Avoid spam-like messages

### Account Management

1. **Naming Convention**: Use descriptive account names
2. **Session Backup**: Consider backing up `./data/sessions/` directory
3. **Monitor Logs**: Check logs for connection issues
4. **Graceful Shutdown**: Use SIGTERM/SIGINT for proper cleanup
5. **Database Backup**: Backup MongoDB regularly

### Scaling Considerations

1. **Max Accounts**: Default limit is 10 (configurable)
2. **Server Resources**: Each account uses ~100MB RAM
3. **Network**: Stable internet connection required
4. **Storage**: ~50MB per account for sessions

---

## Migration from Single to Multi-Account

### Step 1: Update Environment Variables

Add new variables to `.env`:

```env
MAX_ACCOUNTS=10
MAX_MESSAGES_PER_HOUR=50
MAX_MESSAGES_PER_DAY=500
MESSAGE_DELAY_MIN=3000
MESSAGE_DELAY_MAX=8000
ACCOUNT_INIT_DELAY=30000
MAX_CONCURRENT_SENDING=3
API_KEY=your-secret-api-key-change-this
```

### Step 2: Create Your First Account

```bash
curl -X POST "http://localhost/accounts" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "main",
    "name": "Main Account"
  }'
```

### Step 3: Scan QR Code

Open `http://localhost/accounts/main/qr` in browser and scan with WhatsApp.

### Step 4: Update Your Application

Change message endpoints from:

```
POST /message
```

to:

```
POST /accounts/main/message
```

### Step 5: (Optional) Keep Legacy Endpoints

Legacy endpoints still work for backward compatibility.

---

## Troubleshooting

### Account Not Connecting

1. Check QR code at `/accounts/:accountId/qr`
2. Verify internet connection
3. Check logs for errors
4. Try deleting and recreating account

### Rate Limit Issues

1. Check current stats at `/accounts/:accountId/status`
2. Wait for limits to reset (hourly/daily)
3. Use multiple accounts to distribute load
4. Adjust limits in `.env` if needed

### Session Issues

1. Delete session directory: `rm -rf data/sessions/:accountId`
2. Delete account via API
3. Recreate account and scan new QR code

### WhatsApp Ban

1. Stop sending immediately
2. Wait 24-48 hours
3. Review message content and patterns
4. Reduce message volume
5. Use more natural delays

---

## Support & Resources

- **GitHub Repository**: [dev-dimas/whatsapp-gateway](https://github.com/dev-dimas/whatsapp-gateway)
- **Baileys Library**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- **Issues**: Report bugs on GitHub Issues

---

## Changelog

### Version 3.0.0 (Multi-Account Support)

- ✅ Added multi-account management
- ✅ Implemented rate limiting per account
- ✅ Added anti-ban protection measures
- ✅ Session isolation and persistence
- ✅ API key authentication
- ✅ Backward compatibility with legacy endpoints
- ✅ Message statistics and monitoring
- ✅ Graceful shutdown handling
- ✅ Comprehensive error handling
