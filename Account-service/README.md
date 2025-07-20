# Account Service

The Account Service is a core microservice in the GlobalPay ecosystem that manages user financial state, including digital wallets, KYC compliance, and linked payment methods. It operates independently while integrating seamlessly with other services through event-driven architecture.

## Overview

This service handles all aspects of user financial accounts while delegating identity management to the Authentication Service. It ensures regulatory compliance through tiered KYC verification and maintains secure wallet operations with appropriate limits and controls.

## Core Responsibilities

- **Wallet Management**: Create and maintain digital wallets for all users
- **KYC Compliance**: Handle document verification and user tier management
- **Account Linking**: Manage tokenized payment methods (cards and bank accounts)
- **Balance Tracking**: Maintain real-time wallet balances and transaction history
- **Limit Enforcement**: Apply spending and withdrawal limits based on verification levels
- **Audit Trail**: Comprehensive logging for regulatory compliance

## Service Architecture

### 1. Wallet Module

Manages the core wallet functionality for each user.

**Features:**

- Automatic wallet creation upon user registration
- Real-time balance management with frozen balance support
- Wallet status controls (active/suspended)
- Event-driven balance updates

**API Endpoints:**

```
GET /wallet/:userId/balance
    Returns current wallet balance and status

GET /wallet/:userId/history
    Proxies transaction history from Transaction Service

POST /wallet/:userId/freeze
    Freezes wallet operations

POST /wallet/:userId/unfreeze
    Restores wallet operations
```

### 2. KYC Module

Handles Know Your Customer verification and compliance tiers.

**Verification Tiers:**

- **Tier 0 (Unverified)**: KES 5,000 maximum balance
- **Tier 1 (Basic ID)**: KES 50,000 maximum balance
- **Tier 2 (Fully Verified)**: Unlimited operations

**Features:**

- Document upload and verification
- Integration with external verification providers
- Automated tier assignment
- Compliance status tracking

**API Endpoints:**

```
POST /kyc/upload
    Upload verification documents

GET /kyc/status/:userId
    Get current KYC status and tier

PUT /kyc/verify/:userId
    Update verification status (internal)
```

### 3. Linked Accounts Module

Manages tokenized payment methods without storing sensitive data.

**Features:**

- Secure tokenized card storage
- Bank account linking
- Payment method validation
- One-click payment enablement

**API Endpoints:**

```
POST /accounts/link-card
    Link a new payment card

POST /accounts/link-bank
    Link a bank account

GET /accounts/:userId/payment-methods
    List all linked payment methods

DELETE /accounts/:userId/payment-method/:tokenId
    Remove a linked payment method
```

### 4. Limits & Compliance Engine

Enforces transaction limits based on user verification levels.

**Features:**

- Dynamic limit calculation
- Real-time limit checking
- Monthly and daily spending caps
- Withdrawal restrictions

**API Endpoints:**

```
POST /limits/check
    Validate if transaction amount is within limits

GET /limits/:userId
    Get current user limits

PUT /limits/:userId
    Update user limits (admin only)
```

### 5. Audit & Compliance Module

Maintains comprehensive logs for regulatory requirements.

**Logged Events:**

- KYC document uploads and approvals
- Wallet operations (freeze/unfreeze)
- Tier changes and limit modifications
- All financial state changes

## Event Integration

### Events Consumed

```
USER_REGISTERED → Create new wallet
TRANSACTION_SUCCESS → Update wallet balance
TRANSACTION_FAILED → Release frozen funds
CARD_TOKENIZED → Store linked payment method
USER_BLOCKED → Freeze user wallet
KYC_VERIFIED → Update user tier
```

### Events Published

```
WALLET_CREATED → Notify other services of new wallet
WALLET_FROZEN → Alert to wallet suspension
KYC_STATUS_CHANGED → Broadcast tier updates
LIMIT_EXCEEDED → Notify of limit violations
```

## Database Schema

### Core Tables

**wallets**

```sql
wallet_id (UUID, Primary Key)
user_id (UUID, Foreign Key)
balance (DECIMAL)
frozen_balance (DECIMAL)
currency (VARCHAR)
is_active (BOOLEAN)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**kyc_documents**

```sql
document_id (UUID, Primary Key)
user_id (UUID, Foreign Key)
doc_type (ENUM: ID, PASSPORT, UTILITY_BILL)
file_url (VARCHAR)
status (ENUM: PENDING, APPROVED, REJECTED)
submitted_at (TIMESTAMP)
verified_at (TIMESTAMP)
```

**linked_accounts**

```sql
account_id (UUID, Primary Key)
user_id (UUID, Foreign Key)
token_id (VARCHAR)
type (ENUM: CARD, BANK)
provider (VARCHAR)
status (ENUM: ACTIVE, INACTIVE)
created_at (TIMESTAMP)
```

**wallet_limits**

```sql
limit_id (UUID, Primary Key)
user_id (UUID, Foreign Key)
tier (INTEGER)
daily_limit (DECIMAL)
monthly_limit (DECIMAL)
current_daily_spent (DECIMAL)
current_monthly_spent (DECIMAL)
last_updated (TIMESTAMP)
```

## Security & Compliance

- **Data Protection**: No sensitive payment data stored locally
- **Tokenization**: All payment methods use secure tokens
- **Audit Trail**: Complete transaction and state change logging
- **Access Control**: Role-based API access with proper authentication
- **Regulatory Compliance**: Designed for financial services regulations

## Service Dependencies

- **Authentication Service**: User identity and session management
- **Transaction Service**: Transaction processing and history
- **Payment Service**: Payment method tokenization
- **Notification Service**: User alerts and compliance notifications

## Development & Deployment

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (for caching)
- Message queue (RabbitMQ/Kafka)

### Environment Variables

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
MESSAGE_QUEUE_URL=...
KYC_PROVIDER_API_KEY=...
ENCRYPTION_KEY=...
```

### Getting Started

```bash
bun install
bun run dev
```

## Monitoring & Health Checks

- **Health Endpoint**: `GET /health`
- **Metrics**: Wallet creation rate, KYC approval times, limit violations
- **Alerts**: Failed transactions, compliance issues, service downtime

---

**Architecture Principle**: The Authentication Service owns user identity, while the Account Service owns the complete financial state and lifecycle management.
