# Multi-Account WhatsApp Gateway Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATIONS                             │
│  (Web Apps, Mobile Apps, Backend Services, Third-party Integrations)    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ HTTP/HTTPS Requests
                             │ (API Key Authentication)
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS.JS SERVER                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      MIDDLEWARE LAYER                             │  │
│  │  • API Key Verification (auth.ts)                                 │  │
│  │  • Request Validation (express-validator)                         │  │
│  │  • Session Management (express-session)                           │  │
│  │  • Service Exposure (waManager, wa)                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                             │                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      ROUTER/CONTROLLERS                           │  │
│  │                                                                   │  │
│  │  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐  │  │
│  │  │   Account      │  │   Message    │  │    QR & Status     │  │  │
│  │  │  Controller    │  │  Controller  │  │    Controllers     │  │  │
│  │  │                │  │              │  │                    │  │  │
│  │  │ • Create       │  │ • Text       │  │ • Get QR Code      │  │  │
│  │  │ • List         │  │ • Image      │  │ • Get Status       │  │  │
│  │  │ • Get          │  │ • Document   │  │ • Monitor Health   │  │  │
│  │  │ • Delete       │  │              │  │                    │  │  │
│  │  └────────────────┘  └──────────────┘  └────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     WHATSAPP ACCOUNT MANAGER                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │         Map<accountId, WhatsappInstance>                          │  │
│  │                                                                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Account 1   │  │  Account 2   │  │  Account N   │  ...     │  │
│  │  │              │  │              │  │              │          │  │
│  │  │ • Socket     │  │ • Socket     │  │ • Socket     │          │  │
│  │  │ • State      │  │ • State      │  │ • State      │          │  │
│  │  │ • Session    │  │ • Session    │  │ • Session    │          │  │
│  │  │ • QR Code    │  │ • QR Code    │  │ • QR Code    │          │  │
│  │  │ • Status     │  │ • Status     │  │ • Status     │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                             │                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   RATE LIMITER SERVICE                            │  │
│  │                                                                   │  │
│  │  • Per-Account Hourly Limits (50/hour)                           │  │
│  │  • Per-Account Daily Limits (500/day)                            │  │
│  │  • Random Message Delays (3-8 seconds)                           │  │
│  │  • Concurrent Sending Limits (max 3)                             │  │
│  │  • Message Statistics Tracking                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      WHATSAPP BAILEYS LIBRARY                            │
│                    (@whiskeysockets/baileys)                             │
│                                                                          │
│  • WebSocket Connection Management                                      │
│  • Protocol Implementation                                              │
│  • Message Encoding/Decoding                                            │
│  • Media Upload/Download                                                │
│  • Presence Management                                                  │
│  • Authentication State                                                 │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ WebSocket Connection
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        WHATSAPP SERVERS                                  │
│                    (Official WhatsApp Backend)                           │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         PERSISTENCE LAYER                                │
│                                                                          │
│  ┌────────────────────────┐         ┌──────────────────────────────┐   │
│  │     MongoDB Database    │         │    File System Storage       │   │
│  │                        │         │                              │   │
│  │  • Account Model       │         │  data/sessions/              │   │
│  │    - accountId         │         │    ├── account1/             │   │
│  │    - name              │         │    │   ├── creds.json        │   │
│  │    - phoneNumber       │         │    │   └── ...               │   │
│  │    - status            │         │    ├── account2/             │   │
│  │    - sessionPath       │         │    │   ├── creds.json        │   │
│  │    - messageCount      │         │    │   └── ...               │   │
│  │    - lastConnected     │         │    └── accountN/             │   │
│  │    - metadata          │         │        └── ...               │   │
│  │                        │         │                              │   │
│  │  • OTP Model (legacy)  │         │  (Isolated sessions          │   │
│  │  • Other Models        │         │   per account)               │   │
│  └────────────────────────┘         └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow - Send Message

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /accounts/account1/message
     │ {phoneNumber, message}
     ▼
┌────────────────────┐
│  Auth Middleware   │ ──► Verify API Key
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ Message Controller │ ──► Validate Input
└────┬───────────────┘
     │
     ▼
┌────────────────────────┐
│ WhatsApp Account Mgr   │
│                        │
│  1. Get Instance       │ ──► Map.get(accountId)
│  2. Check Connection   │ ──► instance.GetStatus()
│  3. Check Rate Limit   │ ──► rateLimiter.canSendMessage()
│  4. Add Random Delay   │ ──► delay(3000-8000ms)
│  5. Simulate Presence  │ ──► composing, paused
│  6. Send Message       │ ──► baileys.sendMessage()
│  7. Record Stats       │ ──► rateLimiter.recordMessage()
└────┬───────────────────┘
     │
     ▼
┌────────────────────┐
│ Baileys Library    │ ──► WhatsApp WebSocket
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ WhatsApp Server    │ ──► Deliver Message
└────────────────────┘
```

## Connection Flow - New Account

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /accounts
     │ {accountId, name}
     ▼
┌────────────────────┐
│ Account Controller │
└────┬───────────────┘
     │
     ▼
┌────────────────────────────────┐
│ WhatsApp Account Manager       │
│                                │
│  1. Check Max Accounts         │ ──► Limit: 10 (default)
│  2. Verify Unique ID           │ ──► DB lookup
│  3. Create Session Path        │ ──► data/sessions/{id}/
│  4. Save to Database           │ ──► MongoDB
│  5. Create Instance            │ ──► new WhatsappInstance()
│  6. Initialize Socket          │ ──► baileys.makeWASocket()
│  7. Generate QR Code           │ ──► Wait for connection
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────┐
│  Return QR Code    │ ──► GET /accounts/{id}/qr
└────────────────────┘
     │
     ▼
┌────────────────────┐
│  User Scans QR     │ ──► Mobile WhatsApp App
└────────────────────┘
     │
     ▼
┌────────────────────┐
│  Connection Open   │ ──► Status: connected
│  Save Credentials  │ ──► Session persisted
│  Update Database   │ ──► lastConnected, phoneNumber
└────────────────────┘
```

## Rate Limiting Logic

```
┌─────────────────────────────────────────┐
│      Message Send Request               │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ Get/Create    │
       │ Rate Limit    │
       │ State         │
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐      NO     ┌──────────────┐
       │ Hourly Limit  │────────────► │ Return Error │
       │ Exceeded?     │              │ + Wait Time  │
       └───────┬───────┘              └──────────────┘
               │ YES
               ▼
       ┌───────────────┐      NO     ┌──────────────┐
       │ Daily Limit   │────────────► │ Return Error │
       │ Exceeded?     │              │ + Wait Time  │
       └───────┬───────┘              └──────────────┘
               │ YES
               ▼
       ┌───────────────┐      NO     ┌──────────────┐
       │ Concurrent    │────────────► │ Return Error │
       │ Limit OK?     │              │ + Wait Time  │
       └───────┬───────┘              └──────────────┘
               │ YES
               ▼
       ┌───────────────┐      NO     ┌──────────────┐
       │ Min Delay     │────────────► │ Return Error │
       │ Passed?       │              │ + Wait Time  │
       └───────┬───────┘              └──────────────┘
               │ YES
               ▼
       ┌───────────────┐
       │ ALLOW SEND    │
       │               │
       │ • Mark Sending│
       │ • Random Delay│
       │ • Send Message│
       │ • Record Stats│
       │ • Unmark Send │
       └───────────────┘
```

## Key Components

### 1. WhatsApp Account Manager

- **Purpose**: Central orchestrator for multiple WhatsApp instances
- **Responsibilities**:
  - Instance lifecycle management
  - Session persistence
  - Auto-reconnection
  - Account CRUD operations

### 2. Rate Limiter Service

- **Purpose**: Prevent WhatsApp bans through intelligent throttling
- **Features**:
  - Per-account hourly/daily limits
  - Concurrent sending control
  - Natural delay injection
  - Usage statistics

### 3. Account Model (MongoDB)

- **Purpose**: Persistent storage of account metadata
- **Data**: ID, name, phone, status, session path, statistics

### 4. Session Storage (File System)

- **Purpose**: Store authentication credentials
- **Structure**: Isolated directories per account
- **Contents**: Baileys auth state, keys, credentials

### 5. Controllers

- **Purpose**: HTTP request handling and business logic
- **Types**: Account, Message, QR, Status
- **Features**: Input validation, error handling

### 6. Middleware

- **Purpose**: Request processing and security
- **Components**: Auth verification, service exposure

## Security Layers

```
Request
  │
  ▼
┌─────────────────┐
│ API Key Check   │ ─► Required for sensitive operations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Input Validation│ ─► Sanitize and validate all inputs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Rate Limiting   │ ─► Prevent abuse and bans
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Session Isolation│ ─► Each account independent
└────────┬────────┘
         │
         ▼
    Process Request
```

## Scalability Considerations

- **Horizontal**: Run multiple server instances with shared MongoDB
- **Vertical**: Each account ~100MB RAM, scale CPU/memory as needed
- **Storage**: ~50MB per account for sessions
- **Network**: WhatsApp WebSocket per account
- **Database**: MongoDB handles concurrent reads/writes efficiently

---

This architecture ensures:
✅ Safe operation (anti-ban measures)
✅ Scalability (isolated instances)
✅ Reliability (session persistence)
✅ Security (API key authentication)
✅ Maintainability (clean separation)
✅ Backward compatibility (legacy support)
