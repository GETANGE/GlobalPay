# GlobalPay - Microservices Payment Platform

A comprehensive microservices-based payment platform built with Node.js/TypeScript, designed for scalability, security, and reliability.

## 🏗️ Architecture Overview

GlobalPay follows a microservices architecture pattern with the following core services:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  Authentication  │────│    Account      │
│    Service      │    │     Service      │    │   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ├───────────────────────┼───────────────────────┤
         │                       │                       │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│    Payment      │    │   Transaction    │    │  Notification   │
│    Service      │    │     Service      │    │    Service      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐    ┌─────────────────┐
                    │ Fraud Detection  │    │     Search      │
                    │    Service       │    │    Service      │
                    └──────────────────┘    └─────────────────┘
```

## 🚀 Services

### Core Services

- **API Gateway Service** - Central entry point, routing, rate limiting, and load balancing
- **Authentication Service** - User authentication, authorization, JWT tokens, OAuth integration
- **Account Service** - User account management and profile operations
- **Payment Service** - Payment processing, payment methods, and transaction initiation
- **Transaction Service** - Transaction management, history, and reconciliation

### Supporting Services

- **Fraud Detection Service** - Real-time fraud analysis and risk assessment
- **Notification Service** - Email, SMS, and push notification delivery
- **Search Service** - Advanced search capabilities across the platform

## 🛠️ Technology Stack

- **Runtime**: Node.js with TypeScript
- **Package Managers**: pnpm, Bun
- **Web Framework**: Express.js
- **Authentication**: JWT, Passport.js (Google OAuth, GitHub OAuth)
- **Database**: PostgreSQL
- **Caching**: Redis (ioredis)
- **Message Queue**: RabbitMQ (amqplib)
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston
- **Containerization**: Docker
- **Validation**: Joi
- **Password Hashing**: bcrypt
- **WebAuthn**: SimpleWebAuthn
- **SMS/Communication**: Africa's Talking
- **Email**: Nodemailer

## 📋 Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- PostgreSQL
- Redis
- RabbitMQ

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd globalpay
```

### 2. Environment Setup

Each service requires its own environment configuration. Copy the example environment files:

```bash
# For each service directory
cp Authentication-service/.env_git Authentication-service/.env
cp Api-gateway-service/.env.example Api-gateway-service/.env
cp Account-service/.env.example Account-service/.env
# ... repeat for other services
```

### 3. Install Dependencies

```bash
# Install dependencies for all services
./scripts/install-all.sh

# Or install individually
cd Authentication-service && pnpm install
cd ../Api-gateway-service && pnpm install
cd ../Account-service && bun install
# ... repeat for other services
```

### 4. Start with Docker Compose

```bash
docker-compose up -d
```

### 5. Start Services Individually (Development)

```bash
# Terminal 1 - API Gateway
cd Api-gateway-service
pnpm run dev

# Terminal 2 - Authentication Service
cd Authentication-service
pnpm run dev

# Terminal 3 - Account Service
cd Account-service
bun run index.ts

# ... repeat for other services
```

## 🔧 Configuration

### Environment Variables

Each service uses environment-specific configuration:

#### Authentication Service
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://user:password@localhost:5432/auth_db
REDIS_URL=redis://localhost:6379
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### API Gateway Service
```env
PORT=3000
REDIS_URL=redis://localhost:6379
AUTH_SERVICE_URL=http://localhost:3001
ACCOUNT_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3003
```

### Service Ports

- API Gateway: `3000`
- Authentication: `3001`
- Account: `3002`
- Payment: `3003`
- Transaction: `3004`
- Notification: `3005`
- Fraud Detection: `3006`
- Search: `3007`

## 📚 API Documentation

### Authentication Endpoints

```
POST /auth/register     - User registration
POST /auth/login        - User login
POST /auth/logout       - User logout
GET  /auth/profile      - Get user profile
POST /auth/refresh      - Refresh JWT token
GET  /auth/google       - Google OAuth login
GET  /auth/github       - GitHub OAuth login
```

### Payment Endpoints

```
POST /payments/process  - Process payment
GET  /payments/methods  - Get payment methods
POST /payments/methods  - Add payment method
GET  /payments/history  - Payment history
```

### Account Endpoints

```
GET  /accounts/profile  - Get account profile
PUT  /accounts/profile  - Update account profile
GET  /accounts/balance  - Get account balance
POST /accounts/verify   - Verify account
```

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **OAuth Integration** (Google, GitHub)
- **Rate Limiting** with Redis backend
- **CORS Protection**
- **Helmet Security Headers**
- **Input Validation** with Joi
- **Password Hashing** with bcrypt
- **WebAuthn Support** for passwordless authentication
- **Request Logging** and monitoring

## 🧪 Testing

```bash
# Run tests for all services
pnpm run test:all

# Run tests for specific service
cd Authentication-service
pnpm test
```

## 📊 Monitoring and Logging

- **Winston** for structured logging
- Log files generated per service:
  - `combined.log` - All logs
  - `app-error.log` - Application errors
  - `exception.log` - Uncaught exceptions
  - `rejections.log` - Unhandled promise rejections

## 🐳 Docker Support

Each service includes:
- `Dockerfile` for containerization
- `.dockerignore` for optimized builds
- Health checks and multi-stage builds

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the individual service README files for specific documentation
- Review the API documentation for endpoint details

## 🗺️ Roadmap

- [ ] Complete Docker Compose configuration
- [ ] Add comprehensive test coverage
- [ ] Implement service mesh (Istio)
- [ ] Add monitoring with Prometheus/Grafana
- [ ] Implement distributed tracing
- [ ] Add API versioning
- [ ] Implement event sourcing
- [ ] Add GraphQL gateway option