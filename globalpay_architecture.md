# GlobalPay Microservices Architecture

## ✅ 1. Authentication Service

**Purpose:** Manage user identity, authentication, and authorization.

**Responsibilities:**
- Signup/login with email, phone, or OAuth (Google, GitHub)
- Token issuance (JWT/access & refresh tokens)
- Role-based access control (e.g., USER, ADMIN, MERCHANT)
- Multi-device support (device sessions)
- Password reset, 2FA (optional)
- Stores user profile info: email, phone, country, verification status
- Provides secure, centralized user identity layer

> 🔐 **Why?** Payments and wallets are user-bound. You need a solid, secure identity layer.

---

## ✅ 2. API Gateway Service

**Purpose:** Central entry point and request router.

**Responsibilities:**
- Route requests to backend microservices (`/account`, `/pay`, `/transactions`, etc.)
- Rate limiting & request validation
- Authentication middleware (JWT verification)
- Centralized logging for incoming requests

> 🌐 **Why?** Ensures a unified, secure entry point for clients while decoupling services.

---

## ✅ 3. Account Service (Revised)

**Purpose:** Handles all user financial state (wallets, KYC, linked accounts) while relying on Auth Service for identity.

### 🔧 Key Responsibilities:
- Create wallet for every user (triggered by Auth Service event)
- Manage user KYC status, compliance tiers
- Tokenized card & bank account linking
- Track wallet balances & provide transaction history via Transaction Service
- Enforce spending and withdrawal limits based on KYC level

### 🧩 Modules:

#### 1. Wallet Module
- Generates wallet with unique ID for each user
- Maintains `balance`, `frozen_balance`, and `is_active` flags
- Listens to Transaction events to update balance
- Allows freezing/suspending wallet

**APIs:**
- `GET /wallet/:userId/balance` — return real-time balance
- `GET /wallet/:userId/history` — proxy to Transaction Service

#### 2. KYC Module
- Upload and verify documents (ID, passport)
- Assign user KYC tier (Tier 0 → Tier 2)
- Listen to verification callbacks from external APIs
- Sync status with Auth Service if needed

**APIs:**
- `POST /kyc/upload`
- `GET /kyc/status`

#### 3. Linked Accounts Module
- Save tokenized cards or bank references (no sensitive info)
- Accept token from Payment Service (e.g., Vault)
- Enable one-click payments or withdrawals

**APIs:**
- `POST /accounts/link-card`
- `GET /accounts/:userId/cards`

#### 4. Limits & Tier Management
- Set wallet operation limits based on verification level:
  - Tier 0: Unverified — KES 5,000 max balance
  - Tier 1: Basic ID — KES 50,000
  - Tier 2: Fully verified — Unlimited
- Used to gate incoming funds, monthly spend, and withdrawals

**Internal API:**
- `POST /limits/check` — returns if user can proceed with amount

#### 5. Audit & Compliance Logs
- Log every action:
  - KYC upload & approval
  - Wallet suspension & unfreeze
  - Changes to user tiers or limits
- Important for future regulator audits

### 📥 Events Listened To:
- `USER_REGISTERED` → Create wallet entry
- `TRANSACTION_SUCCESS` → Credit/debit wallet
- `TRANSACTION_FAILED` → Unfreeze pending funds
- `CARD_TOKENIZED` → Save linked account
- `USER_BLOCKED` (from Auth) → Freeze wallet

### 🗃️ Database Tables:
| Table | Fields |
|-------|--------|
| `wallets` | wallet_id, user_id, balance, frozen_balance, currency, is_active |
| `kyc_documents` | user_id, doc_type, file_url, status, submitted_at |
| `linked_accounts` | user_id, token_id, type (CARD/BANK), status |
| `wallet_limits` | user_id, tier, daily_limit, monthly_limit, last_updated |

> 🧾 **Why?** Auth owns identity. Account owns the user's financial state and its lifecycle.

---

## 💳 4. Payment Service (Card + STK Push abstraction)

**Purpose:** Initiate and manage all types of payments (STK Push, Card Payments).

### STK Push (via Daraja):
- Initiate push to M-Pesa
- Start short-polling or await callback
- Trigger timeout logic
- Notify Transaction service of result

### Custom Card Payments:
- Accept card input (PCI compliant iframe or vault)
- Validate card (Luhn, CVV, expiry)
- Tokenize card (using in-house or third-party token vault)
- Submit charge request to acquiring bank or sandbox processor
- Handle 3D Secure (OTP, fingerprint)
- Receive result → pass to Transaction Service

> 💡 **Why?** This service owns the *payment flow* logic while being abstracted from user accounts or logs.

---

## 💼 5. Transaction Service

**Purpose:** Orchestrates and tracks all payment transactions and lifecycle states.

**Responsibilities:**
- Create and track transactions: `INITIATED`, `PENDING`, `SUCCESS`, `FAILED`, `TIMED_OUT`
- Save all metadata: user, method, amount, timestamps, channel (Card, STK)
- Handle retries, timeouts, cancellations
- Expose endpoints for viewing transaction status (for frontend or webhook listeners)
- Link to Fraud Detection via hooks

> 🔍 **Why?** You need a single source of truth for all financial operations — decoupled from payment initiation logic.

---

## 🔎 6. Search Service

**Purpose:** Enable fast querying of users, transactions, wallets, logs.

**Responsibilities:**
- Index data from Account and Transaction services
- Provide fuzzy search: by user ID, phone, transaction ID, merchant name, etc.
- Expose analytics-like filters (date ranges, status filters)

> 🧠 **Why?** Keeping this decoupled allows better scale and real-time search UX.

---

## 🚨 7. Fraud Detection Service

**Purpose:** Monitor and flag suspicious activity in real time.

**Responsibilities:**
- Risk scoring based on patterns (e.g., repeated failed OTPs, mismatched IPs)
- Track user device fingerprints
- Monitor transaction volume/frequency
- Integrate with Payment/Transaction Service via event bus or webhook
- Block or flag suspicious transactions
- GeoIP verification

> 🧠 **Why?** Handling your own card flow means you must fight fraud proactively.

---

## 📣 8. Notification Service

**Purpose:** Deliver email, SMS, or in-app notifications.

**Responsibilities:**
- Notify on transaction status (`SUCCESS`, `FAIL`, `TIMEOUT`)
- OTP delivery for 3DS / user verification
- Alert for fraud flags, balance changes
- Batch delivery for receipts or reports

> 📬 **Why?** Payments need timely comms. Decoupling improves reliability and delivery flexibility.

---

## 📄 9. README.md / Docs

**Purpose:** Document the architecture, endpoints, payloads, flow diagrams, and onboarding.

---

## 📊 Summary Table

| Service                  | Key Role                     | Owns                            |
|--------------------------|-------------------------------|----------------------------------|
| `Authentication`         | Identity, access              | Users, tokens, basic profile     |
| `API Gateway`            | Routing, auth filter          | N/A                              |
| `Account`                | Wallets, KYC, compliance      | Wallet balances, KYC, limits     |
| `Payment`                | Card/STK initiation           | Payment methods, tokenization    |
| `Transaction`            | Tracks all transactions       | Lifecycle, metadata              |
| `Search`                 | Fast indexed search           | UX, dashboard                    |
| `Fraud Detection`        | Risk scoring, blocking        | Device/IP monitoring             |
| `Notification`           | Email/SMS push                | UX feedback                      |
| `docker-compose`         | Local env setup               | DevOps                           |
| `README.md`              | Docs                          | Dev onboarding                   |

