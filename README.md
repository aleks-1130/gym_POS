# FitOS — Gym POS System Documentation

> **Version**: 1.0 · **Last Updated**: April 28, 2026  
> **System Name**: FitOS (internally "POS-GYM")

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Prerequisites](#4-prerequisites)
5. [Local Development Setup](#5-local-development-setup)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Database — Prisma & NeonDB](#7-database--prisma--neondb)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Multi-Tenancy Architecture](#9-multi-tenancy-architecture)
10. [Backend Feature Modules](#10-backend-feature-modules)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Role-Based Access Control (RBAC)](#12-role-based-access-control-rbac)
13. [API Route Reference](#13-api-route-reference)
14. [POS & Payment System](#14-pos--payment-system)
15. [Inventory System](#15-inventory-system)
16. [Training & Class System](#16-training--class-system)
17. [Notification & Email System](#17-notification--email-system)
18. [Background Jobs & Scheduling](#18-background-jobs--scheduling)
19. [PWA Configuration](#19-pwa-configuration)
20. [Deployment Guide](#20-deployment-guide)
21. [Production Checklist](#21-production-checklist)
22. [Troubleshooting](#22-troubleshooting)
23. [Database Schema Reference](#23-database-schema-reference)
24. [Project File Map](#24-project-file-map)

---

## 1. System Overview

FitOS is a full-stack **Gym Management & Point-of-Sale (POS) System** designed for multi-branch, multi-tenant gym operations. It covers:

- **Member Management** — Registration, plans, freeze/unfreeze, expiry tracking
- **POS & Payments** — Retail checkout, membership payments, split payments, refunds
- **Inventory** — Product catalog, stock tracking, supplier management, stock orders
- **Training** — Trainer profiles, 1-on-1 session booking, group classes, scheduling
- **Analytics** — Revenue dashboards, P&L reports, financial projections
- **Loyalty** — Points earning/redemption, promo codes, coupons
- **Access Control** — QR-based check-in, door scanner integration
- **Notifications** — In-app + email notifications via n8n and Brevo
- **PWA** — Installable on mobile devices with offline-capable service worker

---

## 2. Tech Stack

### Frontend (Client)

| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework |
| Vite | 7.2 | Build tool & dev server |
| Tailwind CSS | 3.4 | Utility-first CSS framework |
| React Router | 7.13 | Client-side routing (SPA) |
| TanStack React Query | 5.90 | Server state management & caching |
| Zustand | 5.0 | Client state management (POS cart store) |
| Chart.js + react-chartjs-2 | 4.5 / 5.3 | Dashboard charts & analytics |
| Axios | 1.13 | HTTP client |
| Lucide React | 0.563 | Icon library |
| react-qr-code | 2.0 | QR code generation for access control |
| react-to-print | 3.2 | Receipt printing |
| clsx + tailwind-merge | 2.1 / 3.4 | Conditional class utilities |
| idb-keyval | 6.2 | IndexedDB key-value for query persistence |

### Backend (Server)

| Technology | Version | Purpose |
|---|---|---|
| Node.js | ≥18.0 | Runtime |
| Express | 4.18 | HTTP framework |
| Prisma ORM | 5.22 | Database ORM & migrations |
| PostgreSQL (NeonDB) | — | Cloud-hosted serverless Postgres |
| Redis | 5.11 | Cart stock reservations (with in-memory fallback) |
| JSON Web Tokens (jose + jsonwebtoken) | 6.1 / 9.0 | Authentication tokens |
| bcryptjs | 2.4 | Password hashing |
| Helmet | 8.1 | Security headers |
| express-rate-limit | 8.3 | API rate limiting |
| node-cron | 4.2 | Scheduled background tasks |
| Nodemailer | 8.0 | Email sending |
| Brevo (@getbrevo/brevo) | 5.0 | Transactional email API |
| cookie-parser | 1.4 | HTTP cookie parsing |

### Infrastructure & Deployment

| Service | Purpose |
|---|---|
| **Vercel** | Frontend hosting & CDN |
| **Railway** | Backend hosting (Node.js + Redis) |
| **NeonDB** | Serverless PostgreSQL database |
| **n8n** (Railway) | Email webhook automation |
| **Brevo** | Transactional email delivery |
| **GitHub** | Source control |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   CLIENTS                       │
│  Browser (SPA)  ·  PWA (Mobile)  ·  QR Scanner  │
└────────────────────────┬────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────┐
│              VERCEL (Frontend)                  │
│  React SPA · Vite Build · Static Assets · CDN   │
│  vercel.json → SPA rewrites to /index.html      │
└────────────────────────┬────────────────────────┘
                         │ API calls (/api/*)
┌────────────────────────▼────────────────────────┐
│             RAILWAY (Backend)                   │
│  Express Server · Helmet · CORS · Rate Limiter  │
│  ┌──────────────────────────────────────┐       │
│  │  Middleware: authenticateToken       │       │
│  │  → JWT verify → DB user lookup       │       │
│  │  → Role injection → Tenant scoping   │       │
│  └──────────────┬───────────────────────┘       │
│  ┌──────────────▼───────────────────────┐       │
│  │  Feature Modules (Routes/Controllers)│       │
│  │  auth · members · pos · inventory    │       │
│  │  training · analytics · admin · etc. │       │
│  └──────────────┬───────────────────────┘       │
│  ┌──────────────▼───────────────────────┐       │
│  │  Services Layer                      │       │
│  │  email · notifications · scheduling  │       │
│  │  loyalty · cache · audit · config    │       │
│  └──────────────┬───────────────────────┘       │
│  ┌──────────────▼───────────┐ ┌─────────┐      │
│  │  Prisma ORM (extended)   │ │  Redis   │      │
│  │  Auto gym/tenant scoping │ │  (cart)  │      │
│  └──────────────┬───────────┘ └─────────┘      │
└─────────────────┼──────────────────────────────┘
                   │ SSL
┌─────────────────▼──────────────────────────────┐
│              NEONDB (PostgreSQL)                │
│  Serverless · Connection pooling · SSL          │
│  ap-southeast-1 (Singapore)                     │
└─────────────────────────────────────────────────┘
```

---

## 4. Prerequisites

Before setting up locally, ensure you have:

| Requirement | Minimum Version | Check Command |
|---|---|---|
| Node.js | 18.0+ | `node -v` |
| npm | 9.0+ | `npm -v` |
| Git | 2.0+ | `git -v` |
| Docker (optional) | 20.0+ | `docker -v` |

> **Docker** is only needed if you want to run n8n locally for email webhook testing.

---

## 5. Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd POS-GYM
```

### Step 2: Set Up the Backend

```bash
cd server
npm install
```

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and fill in required values (see [Section 6](#6-environment-variables-reference)).

Generate the Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the server:

```bash
node server.js
# Or with auto-reload:
npm run dev    # Uses nodemon
```

Wait for: `=== GYM POS SERVER STARTED ON PORT 5000 (0.0.0.0) ===`

### Step 3: Set Up the Frontend

Open a **new terminal** (keep the server running):

```bash
cd client
npm install
npm run dev
```

The app will be available at: **http://localhost:5173**

> The Vite dev server proxies all `/api/*` requests to `http://127.0.0.1:5000` automatically.

### Step 4: Seed the Database (Optional)

To populate the database with demo data:

```bash
cd server
npx prisma db seed
# This runs: node seed_data.js
```

This seeds: Users, Plans, Products, Members, Payments, Trainers, Training Sessions, Loyalty Rewards, Suppliers, and Expenses.

### Step 5: Set Up n8n for Email Webhooks (Optional)

For local email testing with Docker:

```bash
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

1. Open `http://localhost:5678` and create an owner account
2. Import the provided `.json` workflow file
3. Set up Gmail nodes with Switch node routing for roles (`MEMBER` vs `TRAINER`)

### Demo Credentials

| Role | Email | Password |
|---|---|---|
| Owner | `owner@gym.com` | `password123` |
| Admin | `admin@gym.com` | `password123` |
| Staff | `staff@gym.com` | `password123` |
| Member | `john@doe.com` | `password123` |

---

## 6. Environment Variables Reference

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port (default: `5000`) |
| `DATABASE_URL` | Yes | NeonDB PostgreSQL connection string with SSL |
| `JWT_SECRET` | Yes | Secret key for signing JWTs |
| `NEON_AUTH_URL` | No | Neon Auth endpoint for token verification |
| `NEON_AUTH_JWKS_URL` | No | JWKS endpoint for JWT key rotation |
| `N8N_ACTIVATION_WEBHOOK_URL` | No | n8n webhook for activation emails |
| `N8N_NOTIFICATIONS_WEBHOOK_URL` | No | n8n webhook for notification emails |
| `BREVO_API_KEY` | No | Brevo API key for password reset emails |
| `ENABLE_CACHE` | No | Enable in-memory auth cache (`true`/`false`) |
| `REDIS_URL` | No | Redis connection URL (default: `redis://localhost:6379`) |
| `FRONTEND_URL` | No | Frontend URL for email links |
| `CLIENT_URL` | No | Additional allowed CORS origin |
| `INITIAL_ADMIN_EMAIL` | No | Email for auto-seeded admin (default: `admin@gym.com`) |
| `INITIAL_ADMIN_PASSWORD` | No | Password for auto-seeded admin (default: `password123`) |

### Client (`client/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend API URL (local: `http://localhost:5000`, prod: empty for same-origin or Railway URL) |
| `VITE_NEON_AUTH_API_URL` | No | Neon Auth API URL for client-side auth |

### Client (`client/.env.production`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Set to Railway backend URL or leave empty if using proxy |
| `VITE_NEON_AUTH_URL` | Neon Auth URL for production |

---

## 7. Database — Prisma & NeonDB

### Connection

The system uses **NeonDB** (serverless PostgreSQL) hosted in `ap-southeast-1` (Singapore) with connection pooling enabled via the `-pooler` endpoint.

### Schema Overview

The Prisma schema (`server/prisma/schema.prisma`) contains **40+ models**. Key entities:

```
Tenant (top-level org)
  └── Gym (branch)
        ├── User (staff/admin/owner accounts)
        ├── Member (gym members)
        ├── Product → ProductStock
        ├── Payment → PaymentItem, PaymentCollection
        ├── Trainer → TrainingSession, TrainerAvailability
        ├── Class → ClassSession, Booking
        ├── Order → OrderItem
        ├── Expense
        ├── Notification
        ├── LoyaltyReward, LoyaltyTransaction
        ├── Coupon, PromoCode
        ├── Supplier → StockOrder → StockOrderItem
        ├── ServiceBundle → MemberBundle
        ├── PosConfig, ReceiptSettings
        └── AuditLog, AccessLog
```

### Prisma Extended Client (Auto-Scoping)

The Prisma client at `server/src/config/prisma.js` uses `$extends` to **automatically inject** `gymId` and `tenantId` filters on every query. This ensures **data isolation** between branches/tenants without manual filtering in controllers.

- **Read operations** (`findMany`, `findFirst`, `count`, etc.): Auto-filtered by `gymId`
- **Write operations** (`create`, `update`): Auto-inject `gymId` and `tenantId`
- **Global models** (Product, Plan, Category, etc.): Scoped by `tenantId` instead (shared across gyms)
- **Owner role**: Can override `gymId` for cross-branch queries

### Running Migrations

```bash
# Generate client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations in production
npx prisma migrate deploy

# Push schema without migration (dev only)
npx prisma db push

# View the database in browser
npx prisma studio
```

---

## 8. Authentication & Authorization

### Authentication Flow

1. **Login**: Client sends `email` + `password` to `POST /api/auth/login`
2. **Server**: Validates credentials via bcrypt, generates JWT with `email`, `role`, `sessionVersion`
3. **Token Delivery**: JWT is set as an httpOnly cookie AND returned in the response body
4. **Subsequent Requests**: Token sent via cookie or `Authorization: Bearer <token>` header
5. **Middleware** (`authenticateToken`):
   - Verifies JWT signature using `jose` / `jsonwebtoken`
   - Falls back to Neon Auth DB session lookup if JWT fails
   - Looks up user in `User` table, then `Member` table
   - Checks `sessionVersion` to invalidate old sessions
   - Attaches `req.user` with `{ id, email, role, gymId, tenantId, trainerId }`
   - Runs subsequent middleware inside `AsyncLocalStorage` context for Prisma scoping

### Authorization

The `authorize(roles)` middleware enforces role hierarchy:

```
SUPERADMIN > OWNER > ADMIN > STAFF
```

- `SUPERADMIN`: Passes all authorization checks
- `OWNER`: Passes `OWNER`, `ADMIN`, and `STAFF` checks
- `ADMIN`: Passes `ADMIN` and `STAFF` checks
- `STAFF`: Passes `STAFF` checks only
- `MEMBER` / `TRAINER`: Exact match only (no hierarchy)

### Session Invalidation

Each user/member has a `sessionVersion` integer. When incremented (e.g., password change, forced logout), all existing tokens with the old version are rejected.

---

## 9. Multi-Tenancy Architecture

The system supports **two levels of isolation**:

### Tenant Level

- A `Tenant` represents a **gym organization** (company)
- All data belongs to a tenant via `tenantId` foreign key
- `SUPERADMIN` role manages tenants at `/superadmin/tenants`

### Gym (Branch) Level

- A `Gym` represents a **physical branch** within a tenant
- Most data is scoped to a specific gym via `gymId`
- **Owners** can switch between branches via the `x-gym-id` HTTP header
- **Staff/Admin**: Locked to their assigned `gymId`
- **Global models** (Products, Plans, etc.) use `tenantId` scoping and can optionally be shared across all gyms within a tenant (`isGlobal: true`)

### Auto-Bootstrapping

On server startup, if no Tenant/Gym/User exists, the system automatically creates:
1. A "Default Tenant" (`tenantId: 'DEFAULT'`)
2. A "Default Gym" (`currency: 'PHP'`, `timezone: 'Asia/Manila'`)
3. An admin user from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`

---

## 10. Backend Feature Modules

All backend feature code lives in `server/src/features/`. Each module follows the pattern:

```
features/<module>/
  ├── <module>Controller.js   # Business logic
  └── <module>Routes.js       # Express router with middleware
```

### Module Map

| Module | Route Prefix | Key Capabilities |
|---|---|---|
| **auth** | `/api/auth` | Login, signup, activation, password reset, token refresh |
| **dashboard** | `/api/dashboard` | KPI stats, revenue charts, member trends |
| **admin** | `/api/admin` | User management, branches, payroll, service bundles, seed |
| **members** | `/api/members` | CRUD, freeze/unfreeze, plan assignment, access logs, notes |
| **pos** | `/api/payments`, `/api/shop`, `/api/pos/*` | Checkout, payments, refunds, voids, split payments, promo codes, stock reserves, loyalty, plans |
| **inventory** | `/api/products`, `/api/inventory`, `/api/suppliers` | Product CRUD, categories, stock orders, supplier management |
| **training** | `/api/trainers`, `/api/training-sessions`, `/api/classes` | Trainer profiles, availability, 1-on-1 booking, group classes, change requests |
| **analytics** | `/api/analytics`, `/api/expenses`, `/api/owner/projection` | Revenue analytics, expense tracking, financial projections |
| **settings** | `/api/settings` | Gym settings, receipt settings, financial institutions |
| **superadmin** | `/api/superadmin` | Tenant CRUD for platform administrators |
| **notifications** | `/api/notifications` | In-app notifications, preferences |

### Services Layer (`server/src/services/`)

| Service | Purpose |
|---|---|
| `schedulingService` | Cron jobs: hourly session reminders, weekly notification cleanup |
| `notificationService` | Unified notification dispatch (in-app + email via n8n) |
| `emailService` | Activation emails (n8n webhook) + password reset (Brevo API) |
| `loyaltyService` | Points calculation, earning, redemption logic |
| `cacheService` | In-memory TTL cache for auth lookups (30s TTL) |
| `auditService` | Action logging to `AuditLog` table |
| `configService` | Dynamic config loading from database |
| `receiptSettingsService` | Receipt template configuration |
| `trainerAvailabilityService` | Complex availability/conflict resolution |

### Redis Integration

Redis is used for **POS cart stock reservations** (`/api/pos/reserve`). When a staff member adds items to a cart, stock is temporarily held in Redis to prevent overselling.

- **With Redis**: Real-time stock holds via `cart:reserve:*` keys
- **Without Redis**: Automatic fallback to `InMemoryRedis` class (Map-based)
- **Reconnection**: Silently retries every 30 seconds in background

---

## 11. Frontend Architecture

### Project Structure

```
client/src/
├── App.jsx                  # Root component with context providers
├── main.jsx                 # Entry point, renders App
├── index.css                # Global styles
├── ErrorBoundary.jsx        # React error boundary
├── config/
│   ├── api.js               # Axios config, CORS, gym-id interceptor
│   ├── businessConfig.js    # Currency, timezone defaults
│   ├── queryClient.js       # TanStack Query client setup
│   └── setupAxios.js        # Axios defaults
├── constants/
│   ├── roles.js             # OWNER, ADMIN, STAFF, MEMBER, TRAINER, SUPERADMIN
│   ├── categories.js        # Product categories
│   └── memberConstants.js   # Member status constants
├── context/
│   ├── AuthContext.jsx       # Auth state, login/logout, token management
│   ├── CurrencyContext.jsx   # Currency formatting (PHP)
│   ├── SettingsContext.jsx   # Gym settings provider
│   └── ConfirmContext.jsx    # Global confirmation dialog
├── stores/
│   ├── usePOSStore.js        # Zustand store for POS cart state
│   └── useUIStore.js         # UI state (sidebar collapse, etc.)
├── routes/
│   └── AppRoutes.jsx         # All route definitions + ProtectedRoute + ActiveMembershipGate
├── features/                 # Feature-based page components (see below)
├── components/               # Shared components (Sidebar, BottomNav, Receipt, etc.)
├── hooks/                    # Custom hooks (useMemberData, usePWA, etc.)
├── services/                 # API service functions
└── utils/                    # Date, member utility functions
```

### Feature Pages by Role

**Admin / Owner Pages** (`features/admin/`):

| Page | Description |
|---|---|
| `AdminDashboard` | KPI cards, revenue charts, member stats |
| `Analytics` | Revenue breakdown, trends, exportable reports |
| `Expenses` | Expense tracking and categorization |
| `Inventory` | Full product/stock/supplier management |
| `Trainers` | Trainer CRUD, commission rates, change requests |
| `TrainingManager` | Session overview, booking management |
| `Classes` | Group class scheduling and management |
| `Transactions` | Payment history, filtering, export |
| `Refunds` | Process refunds and voids |
| `PosSettings` | POS configuration, discount presets, PIN management |
| `Payroll` | Staff/trainer payroll calculation |
| `Projections` | Financial projections and forecasting |
| `Branches` | Multi-branch management (Owner only) |
| `Members` | Admin-level member management |

**Staff Pages** (`features/staff/`):

| Page | Description |
|---|---|
| `StaffDashboard` | Simplified dashboard for frontdesk |
| `Members` | Member lookup, check-in |
| `MemberDetail` | Full member profile with notes, history |
| `POS` | Point-of-sale checkout interface |
| `Access` | Access log viewer |
| `DoorScanner` | QR code scanner for gym entry |
| `Trainers` / `Classes` | Read-only trainer/class views |
| `Refunds` | Staff-level refund processing |

**Member Pages** (`features/member/`):

| Page | Description |
|---|---|
| `MemberDashboard` | Personal stats, upcoming sessions |
| `Profile` | Profile management, plan info, freeze requests |
| `Schedule` | Class schedule and booking |
| `TrainerBooking` | Book 1-on-1 training sessions |
| `MemberShop` | Browse and purchase products |
| `ShopCheckout` | Cart and payment |
| `Attendance` | Personal attendance history |
| `PurchaseHistory` | Order history |
| `PaymentMethods` | Saved payment methods |
| `Rewards` | Loyalty points and rewards redemption |
| `GymTraffic` | Live gym occupancy view |

**Trainer Pages** (`features/trainer/`):

| Page | Description |
|---|---|
| `TrainerDashboard` | Session stats, upcoming bookings |
| `TrainerProfile` | Profile, availability, member card, change requests |
| `TrainerClassesSessions` | Manage classes and 1-on-1 sessions |
| `TrainerShop` | Browse gym shop |
| `TrainerCommissionHistory` | Commission tracking |
| `TrainerRewards` | Loyalty rewards |

**SuperAdmin Pages** (`features/superadmin/`):

| Page | Description |
|---|---|
| `TenantManagement` | Create/manage tenants (organizations) |

### Routing & Access Control

The routing system in `AppRoutes.jsx` uses two key components:

- **`ProtectedRoute`**: Wraps all authenticated pages. Checks `user` from `AuthContext`, redirects to `/login` if unauthenticated, enforces `allowedRoles`, and renders the appropriate layout:
  - **Staff/Admin/Owner** → Sidebar layout
  - **Member/Trainer** → Bottom navigation layout
  - **SuperAdmin** → Custom admin layout

- **`ActiveMembershipGate`**: Members-only guard that checks if membership is expired or frozen, showing appropriate UI or redirecting.

### State Management

| Layer | Technology | Usage |
|---|---|---|
| Server State | TanStack React Query | API data fetching, caching, background refetch |
| Client State | Zustand | POS cart, UI toggles |
| Auth State | React Context | User session, login/logout |
| App Settings | React Context | Currency, gym settings, confirm dialogs |

---

## 12. Role-Based Access Control (RBAC)

### Role Hierarchy

```
SUPERADMIN ─── Platform-level tenant management
    │
  OWNER ────── Full access, multi-branch, audit logs, projections
    │
  ADMIN ────── Full operational access, analytics, settings
    │
  STAFF ────── Frontdesk operations: POS, members, check-in
    │
  TRAINER ──── Self-service: profile, sessions, classes, shop
    │
  MEMBER ───── Self-service: booking, shop, profile, attendance
```

### Permission Matrix

| Feature | SUPERADMIN | OWNER | ADMIN | STAFF | TRAINER | MEMBER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Tenant Management | ✅ | — | — | — | — | — |
| Branch Management | — | ✅ | — | — | — | — |
| Audit Logs | — | ✅ | — | — | — | — |
| Projections | — | ✅ | — | — | — | — |
| Analytics | — | ✅ | ✅ | — | — | — |
| Expenses | — | ✅ | ✅ | — | — | — |
| Settings | — | ✅ | ✅ | — | — | — |
| User Management | — | ✅ | ✅ | — | — | — |
| POS Settings | — | ✅ | ✅ | — | — | — |
| Transactions | — | ✅ | ✅ | — | — | — |
| Payroll | — | ✅ | ✅ | — | — | — |
| Dashboard | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| POS Checkout | — | ✅ | ✅ | ✅ | — | — |
| Members CRUD | — | ✅ | ✅ | ✅ | — | — |
| Inventory | — | ✅ | ✅ | ✅ | — | — |
| Trainers Mgmt | — | ✅ | ✅ | ✅(RO) | — | — |
| Classes Mgmt | — | ✅ | ✅ | ✅(RO) | — | — |
| Access / Scanner | — | ✅ | ✅ | ✅ | — | — |
| Refunds | — | ✅ | ✅ | ✅(Ltd) | — | — |
| Loyalty Mgmt | — | ✅ | ✅ | ✅ | — | — |
| Trainer Profile | — | — | — | — | ✅ | — |
| Trainer Sessions | — | — | — | — | ✅ | — |
| Member Profile | — | — | — | — | — | ✅ |
| Booking | — | — | — | — | — | ✅ |
| Shop (Browse) | — | — | — | — | ✅ | ✅ |
| Announcements | — | ✅ | ✅ | ✅ | ✅ | ✅ |

*(RO = Read Only, Ltd = Limited)*

---

## 13. API Route Reference

All routes are prefixed with `/api/`. Auth-protected routes require a valid JWT cookie or `Authorization: Bearer <token>` header.

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/login` | No | Login with email/password |
| POST | `/signup` | No | Register new member account |
| POST | `/activate` | No | Activate account via token |
| POST | `/forgot-password` | No | Request password reset email |
| POST | `/reset-password` | No | Reset password with token |

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/stats` | Yes | O/A/S | Dashboard KPIs |
| GET | `/charts` | Yes | O/A | Revenue chart data |

### Members (`/api/members`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/` | Yes | O/A/S | List all members |
| GET | `/:id` | Yes | O/A/S/M | Get member by ID |
| POST | `/` | Yes | O/A/S | Create new member |
| PUT | `/:id` | Yes | O/A/S | Update member |
| POST | `/:id/freeze` | Yes | O/A/S | Freeze membership |
| POST | `/:id/unfreeze` | Yes | O/A/S | Unfreeze membership |
| POST | `/:id/renew` | Yes | O/A/S | Renew membership |
| GET | `/:id/notes` | Yes | O/A/S | Get member notes |
| POST | `/:id/notes` | Yes | O/A/S | Add member note |

### Payments (`/api/payments`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/` | Yes | O/A/S | List payments |
| POST | `/checkout` | Yes | O/A/S | Process POS checkout |
| POST | `/:id/refund` | Yes | O/A | Process refund |
| POST | `/:id/void` | Yes | O/A | Void transaction |
| GET | `/settings` | Yes | O/A | Get POS config |
| PUT | `/settings` | Yes | O/A | Update POS config |

### Products (`/api/products`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/` | Yes | O/A/S | List products |
| POST | `/` | Yes | O/A | Create product |
| PUT | `/:id` | Yes | O/A | Update product |
| DELETE | `/:id` | Yes | O/A | Delete product |

### Inventory (`/api/inventory`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/categories` | Yes | O/A/S | List categories |
| POST | `/categories` | Yes | O/A | Create category |
| GET | `/stock-orders` | Yes | O/A/S | List stock orders |
| POST | `/stock-orders` | Yes | O/A/S | Create stock order |
| PUT | `/stock-orders/:id` | Yes | O/A | Update stock order |

### Suppliers (`/api/suppliers`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/` | Yes | O/A | List suppliers |
| POST | `/` | Yes | O/A | Create supplier |
| PUT | `/:id` | Yes | O/A | Update supplier |
| DELETE | `/:id` | Yes | O/A | Delete supplier |

### Trainers (`/api/trainers`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/` | Yes | O/A/S/M | List trainers |
| GET | `/:id` | Yes | O/A/S/M | Get trainer details |
| POST | `/` | Yes | O/A | Create trainer |
| PUT | `/:id` | Yes | O/A | Update trainer |
| GET | `/:id/availability` | Yes | All | Get availability |
| PUT | `/:id/availability` | Yes | O/A/T | Update availability |

### Training Sessions (`/api/training-sessions`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/` | Yes | O/A/S | List sessions |
| POST | `/book` | Yes | O/A/S/M | Book a session |
| PUT | `/:id/status` | Yes | O/A/S/T | Update session status |

### Classes (`/api/classes`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/` | Yes | All | List classes |
| POST | `/` | Yes | O/A | Create class |
| PUT | `/:id` | Yes | O/A | Update class |
| DELETE | `/:id` | Yes | O/A | Delete class |
| POST | `/:id/book` | Yes | M | Book class slot |

### Loyalty (`/api/loyalty`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/rewards` | Yes | O/A/S/M | List rewards |
| POST | `/rewards` | Yes | O/A | Create reward |
| POST | `/redeem` | Yes | M | Redeem points |
| GET | `/transactions` | Yes | O/A/S/M | Point history |

### Analytics (`/api/analytics`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/revenue` | Yes | O/A | Revenue analytics |
| GET | `/members` | Yes | O/A | Member analytics |
| GET | `/products` | Yes | O/A | Product performance |

### Access Control (`/api/access`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/logs` | Yes | O/A/S | Access log history |
| POST | `/checkin` | Yes | O/A/S | Process check-in |

### Stock Reservation (`/api/pos/reserve`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/hold` | Yes | O/A/S | Reserve stock in cart |
| POST | `/release` | Yes | O/A/S | Release stock hold |

### Settings (`/api/settings`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/gym` | Yes | O/A | Get gym settings |
| PUT | `/gym` | Yes | O/A | Update gym settings |
| GET | `/receipt` | Yes | O/A | Get receipt settings |
| PUT | `/receipt` | Yes | O/A | Update receipt settings |

### SuperAdmin (`/api/superadmin`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/tenants` | Yes | SA | List all tenants |
| POST | `/tenants` | Yes | SA | Create tenant |
| PUT | `/tenants/:id` | Yes | SA | Update tenant |
| DELETE | `/tenants/:id` | Yes | SA | Delete tenant |

*Role abbreviations: O=Owner, A=Admin, S=Staff, M=Member, T=Trainer, SA=SuperAdmin*

---

## 14. POS & Payment System

### Payment Types

| Type | Description |
|---|---|
| `POS_SALE` | Retail product sale |
| `MEMBERSHIP` | Membership plan payment |
| `TRAINING` | Training session payment |
| `CLASS_PACKAGE` | Class session package purchase |
| `BUNDLE` | Service bundle purchase |

### Payment Methods

Supported: `CASH`, `CARD`, `GCASH`, `MAYA`, `BANK_TRANSFER`, `SPLIT`

### Split Payments

The system supports splitting a single payment across multiple methods. Each split is recorded as a `PaymentCollection` linked to the parent `Payment`.

### Refund & Void Flow

1. **Void**: Cancels a payment entirely (requires PIN from POS config)
2. **Refund**: Partial or full refund, tracks `refundedAmount` and `returnedQuantity`
3. Both operations reverse loyalty points (`pointsReversed`) and restore stock

### POS Config

Stored in `PosConfig` table per gym:
- `voidPinHash` / `returnPinHash`: Hashed PINs for authorization
- `discountPresets`: Pre-configured discount options (JSON)
- `loyaltyPointsRate`: Points earned per PHP spent (default: 0.1)

### Tax & Rounding

- Tax rate configurable per gym (`Gym.taxRate`, default 12%)
- Rounding rule configurable (`NONE`, `UP`, `DOWN`, `NEAREST`)
- Payment tracks: `taxableAmount`, `taxAmount`, `roundingAdjustment`, `payableAmount`

---

## 15. Inventory System

### Product Management

- Products have: name, category, price, stock, minStock, SKU, imageUrl, supplyCost
- Categories are tenant-scoped
- Products can be **global** (shared across branches) or **gym-specific**

### Stock Tracking

- `Product.stock`: Legacy aggregate field
- `ProductStock`: Per-gym stock quantities (for multi-branch)
- `minStock` / `minQuantity`: Low-stock alert thresholds

### Stock Orders

Lifecycle: `PENDING` → `RECEIVED` (auto-updates stock) → or `CANCELLED`

Each order tracks: supplier, line items, subtotal, quantities, creator, timestamps.

---

## 16. Training & Class System

### 1-on-1 Training Sessions

- Members book sessions with specific trainers
- Trainers set availability via `TrainerAvailability` (JSON schedule)
- Session lifecycle: `SCHEDULED` → `COMPLETED` / `CANCELLED` / `NO_SHOW`
- Supports session materials tracking and commission calculation
- Members can rate sessions after completion

### Group Classes

- Recurring or one-time schedule types
- Capacity tracking with enrollment limits
- `ClassSession`: Individual instances of a recurring class
- Members book via `Booking` (status: `CONFIRMED` / `CANCELLED`)
- Class history tracks attendance and commission per session

### Trainer Types

- `FULLTIME`: Regular salary + commission
- `FREELANCER`: Commission-only

### Trainer Change Requests

Trainers can submit profile update requests that go through a two-tier approval:
1. **Admin Review** (`PENDING_ADMIN`)
2. **Owner Review** (`PENDING_OWNER`)
3. **Applied** (changes merged to trainer profile)

---

## 17. Notification & Email System

### In-App Notifications

Stored in the `Notification` table with:
- `type`: `CLASS_REMINDER`, `TRAINING_REMINDER`, `ANNOUNCEMENT`, etc.
- `targetGroup`: `ALL`, `MEMBERS`, `TRAINERS`, specific member
- `isAnnouncement`: Broadcast to all users
- Preferences controlled via `NotificationPreference` per user/member

### Email Delivery

Two channels:

1. **n8n Webhooks** (activation emails, notification emails):
   - `N8N_ACTIVATION_WEBHOOK_URL`: Sends registration activation emails
   - `N8N_NOTIFICATIONS_WEBHOOK_URL`: Sends notification emails
   - n8n handles Gmail routing based on role (`MEMBER` vs `TRAINER`)

2. **Brevo API** (password reset emails):
   - Direct API call via `@getbrevo/brevo` package
   - HTML email template with reset link
   - Uses `BREVO_API_KEY` for authentication

---

## 18. Background Jobs & Scheduling

The `schedulingService` uses `node-cron` for automated tasks:

| Schedule | Task | Description |
|---|---|---|
| Every hour (`0 * * * *`) | `sendSessionReminders` | Sends 24h and 2h class booking reminders |
| Every hour (`0 * * * *`) | `sendTrainingReminders` | Sends 24h and 2h training session reminders |
| Sunday midnight (`0 0 * * 0`) | `cleanupNotifications` | Deletes read notifications older than 30 days |

### Reminder Logic

- **24-hour reminder**: Email + in-app notification, sets `reminderSent = true`
- **2-hour reminder**: In-app only (no email), sets `finalReminderSent = true`
- Prevents duplicate sends via boolean flags on Booking/TrainingSession

---

## 19. PWA Configuration

### Manifest

Located at `client/public/manifest.json` with:
- App name: "POS GYM"
- Theme color: `#F97316` (orange)
- Icons: `pwa-192x192.png`, `pwa-512x512.png`

### Service Worker

A custom `service-worker.js` in `/public` provides basic offline caching. The `index.html` includes an emergency SW cleanup script to prevent infinite reload loops.

### Install Prompt

`PWAInstallPrompt.jsx` shows a native-style install banner for supported browsers.

### Mobile Optimization

- Viewport: `width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no`
- Apple-specific meta tags for standalone mode
- Bottom navigation for mobile users (Member/Trainer roles)

---

## 20. Deployment Guide

### Frontend → Vercel

#### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com) and import the GitHub repository
2. Set the **Root Directory** to `client`
3. Framework preset: **Vite**

#### Step 2: Configure Build

These are auto-detected from `vercel.json`:

```json
{
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "rewrites": [
        { "source": "/(.*)", "destination": "/index.html" }
    ]
}
```

The rewrite rule ensures all routes serve `index.html` for SPA client-side routing.

#### Step 3: Set Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Your Railway backend URL (e.g., `https://your-app.up.railway.app`) |
| `VITE_NEON_AUTH_URL` | Your Neon Auth endpoint |

#### Step 4: Deploy

Push to `main` branch → Vercel auto-deploys.

Preview deployments are created for every PR/branch. All `*.vercel.app` subdomains are whitelisted in the server CORS config.

---

### Backend → Railway

#### Step 1: Connect Repository

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Set the **Root Directory** to `server`

#### Step 2: Build & Start Configuration

Pre-configured in `railway.toml`:

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npx prisma generate"

[deploy]
startCommand = "npx prisma migrate deploy && node server.js"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

The deploy command runs migrations before starting the server, ensuring the DB schema is always up to date.

#### Step 3: Set Environment Variables

In Railway Dashboard → Service → Variables:

| Variable | Value |
|---|---|
| `PORT` | `5000` (or Railway auto-assigns) |
| `DATABASE_URL` | NeonDB connection string |
| `JWT_SECRET` | Strong random secret (change from default!) |
| `NEON_AUTH_URL` | Neon Auth endpoint |
| `NEON_AUTH_JWKS_URL` | JWKS URL for key verification |
| `N8N_ACTIVATION_WEBHOOK_URL` | n8n webhook URL |
| `N8N_NOTIFICATIONS_WEBHOOK_URL` | n8n notifications webhook |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `ENABLE_CACHE` | `true` |
| `FRONTEND_URL` | Vercel frontend URL |
| `CLIENT_URL` | Same as FRONTEND_URL |
| `NODE_ENV` | `production` |

#### Step 4: Add Redis (Optional)

1. In Railway, click **+ New** → **Database** → **Redis**
2. Railway auto-sets `REDIS_URL` in your service variables
3. The server auto-connects on startup

#### Step 5: Deploy

Push to `main` branch → Railway auto-deploys.

---

### Database → NeonDB

#### Initial Setup

1. Create a project at [neon.tech](https://neon.tech)
2. Choose region: `ap-southeast-1` (Singapore) for Asia-Pacific
3. Copy the **connection string** (pooled endpoint) to `DATABASE_URL`

#### Migrations in Production

Migrations run automatically on deploy via the Railway start command:

```bash
npx prisma migrate deploy && node server.js
```

#### Creating New Migrations

During development:

```bash
cd server
npx prisma migrate dev --name describe_your_change
```

This generates a migration file in `server/prisma/migrations/` and applies it locally.

---

### n8n Email Automation → Railway

1. Deploy n8n to Railway using the official Docker image
2. Set up workflows for:
   - **Activation Emails**: Receives webhook → sends Gmail with activation link
   - **Notification Emails**: Receives webhook → routes by role → sends Gmail
3. Configure the webhook URLs in the server `.env`

---

## 21. Production Checklist

### Security

- [ ] Change `JWT_SECRET` from default to a strong random value (32+ chars)
- [ ] Change default admin password (`password123`)
- [ ] Verify CORS `allowedOrigins` only includes your domains
- [ ] Remove or protect `/api/debug/env` endpoint in production
- [ ] Ensure `DATABASE_URL` uses SSL (`sslmode=require`)
- [ ] Set `NODE_ENV=production`
- [ ] Review rate limiting configuration in `rateLimiter.js`
- [ ] Audit `Helmet` CSP settings if using external CDNs

### Database

- [ ] Run `npx prisma migrate deploy` before going live
- [ ] Verify auto-seeded default Tenant, Gym, and Admin user
- [ ] Set up NeonDB connection pooling for production loads
- [ ] Enable Neon auto-suspend for cost optimization

### Monitoring

- [ ] Test health check endpoint: `GET /api/health`
- [ ] Verify Redis connectivity (or confirm fallback mode)
- [ ] Monitor Railway deployment logs for startup errors
- [ ] Set up uptime monitoring for both Vercel and Railway URLs

### Email

- [ ] Verify n8n webhooks are accessible from Railway
- [ ] Test activation email flow end-to-end
- [ ] Test password reset email via Brevo
- [ ] Verify `FRONTEND_URL` generates correct links in emails

### PWA

- [ ] Verify `manifest.json` is served correctly
- [ ] Test service worker registration on mobile
- [ ] Confirm install prompt appears on supported browsers
- [ ] Test offline behavior

---

## 22. Troubleshooting

### Common Issues

#### Server won't start: "Can't reach database server"

- Verify `DATABASE_URL` is correct and NeonDB project is active
- Check if Neon project is suspended (auto-suspend after inactivity)
- Ensure SSL is enabled in connection string (`sslmode=require`)

#### CORS errors in browser

- Check `allowedOrigins` array in `server.js` includes your frontend URL
- Ensure `credentials: true` is set in both CORS config and Axios
- Verify the `CLIENT_URL` env var is set on Railway

#### Authentication fails with 403

- Check if the user exists in both Neon Auth AND the local `User`/`Member` table
- Verify `sessionVersion` matches between token and database
- Clear browser cookies and re-login
- Check auth middleware logs: `[DEBUG] Token verified for:` / `[DEBUG] User not found`

#### Redis connection warnings

- These are **non-fatal** — the system falls back to in-memory storage automatically
- To use real Redis, add a Redis service in Railway
- Logs will show: `Redis not found on startup. Using In-Memory fallback.`

#### Infinite reload loop on Vercel

- The `index.html` includes emergency SW cleanup code
- If persists: clear all service workers from DevTools → Application → Service Workers
- Clear `sessionStorage.removeItem('pwa-auto-reloaded')`

#### Prisma migration errors

```bash
# Reset and re-apply all migrations (DEV ONLY - destroys data)
npx prisma migrate reset

# Force apply to production
npx prisma migrate deploy
```

#### Split payment 400 errors

- Ensure `SPLIT` is included as a valid payment method
- The `collections` array must be provided in the request body
- Each collection needs: `amount`, `method`, `financialInstitutionId`

---

## 23. Database Schema Reference

### Core Enums

```prisma
enum TrainerType {
  FREELANCER
  FULLTIME
}
```

### Key Model Relationships

```
Tenant (1) ──── (*) Gym
Tenant (1) ──── (*) User
Gym    (1) ──── (*) User
Gym    (1) ──── (*) Member
Gym    (1) ──── (*) Product ──── (*) ProductStock
Gym    (1) ──── (*) Payment ──── (*) PaymentItem
                                 (*) PaymentCollection
Member (1) ──── (*) Payment
Member (1) ──── (*) TrainingSession
Member (1) ──── (*) Booking
Member (1) ──── (*) Order ──── (*) OrderItem
Member (1) ──── (*) MemberBundle
Member (1) ──── (*) MembershipPeriod
Member (1) ──── (1) NotificationPreference
Trainer (1) ──── (*) TrainingSession
Trainer (1) ──── (*) Class ──── (*) ClassSession
Trainer (1) ──── (1) TrainerAvailability
Trainer (1) ──── (1) User (linked account)
Supplier (1) ──── (*) StockOrder ──── (*) StockOrderItem
ServiceBundle (1) ──── (*) ServiceBundleBucket
                       (*) MemberBundle ──── (*) MemberBundleBucket
```

### Multi-Tenant Fields

Nearly every model includes:
- `tenantId Int @default(1)` — Organization-level isolation
- `gymId Int?` — Branch-level isolation
- `@@index([tenantId])` and `@@index([gymId])` — Query performance

---

## 24. Project File Map

```
POS-GYM/
├── README.md
├── package.json                     # Root (prisma-erd-generator)
│
├── client/                          # FRONTEND
│   ├── index.html                   # Entry HTML with PWA setup
│   ├── package.json
│   ├── vite.config.js               # Vite config with API proxy
│   ├── tailwind.config.js           # Dark theme, custom colors
│   ├── vercel.json                  # Vercel deployment config
│   ├── .env.local                   # Local env vars
│   ├── public/                      # Static assets, manifest, SW
│   └── src/
│       ├── App.jsx                  # Root with providers
│       ├── main.jsx                 # ReactDOM entry
│       ├── index.css                # Global styles
│       ├── assets/                  # Images, brand assets
│       ├── config/                  # API, query client, axios setup
│       ├── constants/               # Roles, categories, member constants
│       ├── context/                 # Auth, Currency, Settings, Confirm
│       ├── stores/                  # Zustand (POS cart, UI)
│       ├── routes/AppRoutes.jsx     # All route definitions
│       ├── features/
│       │   ├── admin/               # 21 admin/owner pages
│       │   ├── staff/               # 14 staff pages + pos/
│       │   ├── member/              # 13 member pages + components/
│       │   ├── trainer/             # 12 trainer pages + components/
│       │   ├── auth/                # Login, Signup, Activate, Reset
│       │   ├── shared/              # Dashboard, Payments, Loyalty, etc.
│       │   └── superadmin/          # Tenant management
│       ├── components/              # Shared components
│       │   ├── analytics/           # Chart components, financial views
│       │   ├── common/              # Buttons, inputs, modals, cards
│       │   ├── dashboard/           # KPI cards, stat widgets
│       │   ├── Sidebar.jsx
│       │   ├── BottomNav.jsx
│       │   └── Receipt.jsx
│       ├── hooks/                   # useMemberData, usePWA, etc.
│       ├── services/                # memberService, planService
│       ├── utils/                   # dateUtils, memberUtils
│       └── polyfills/               # Compatibility layers
│
├── server/                          # BACKEND
│   ├── server.js                    # Express entry, routes, bootstrap
│   ├── package.json
│   ├── railway.toml                 # Railway deployment config
│   ├── .env                         # Server environment variables
│   ├── seed_data.js                 # Database seeding script
│   ├── data/                        # Static seed data (JSON)
│   ├── scratch/                     # Maintenance & fix scripts
│   ├── prisma/
│   │   ├── schema.prisma            # Full DB schema
│   │   └── migrations/              # Prisma migration history
│   └── src/
│       ├── config/                  # Prisma, Redis, Business rules
│       ├── middleware/              # Auth, Rate limiting
│       ├── services/                # Notification, Email, Loyalty, etc.
│       ├── features/
│       │   ├── auth/                # Login, registration logic
│       │   ├── admin/               # Admin & branch management
│       │   ├── members/             # Member & access logic
│       │   ├── pos/                 # Checkout & payment processing
│       │   ├── inventory/           # Product & stock management
│       │   ├── training/            # Trainer & class scheduling
│       │   ├── analytics/           # Financial reporting & projections
│       │   ├── dashboard/           # KPI & notification handlers
│       │   ├── settings/            # System & receipt configuration
│       │   └── superadmin/          # Tenant isolation management
│       └── utils/                   # authUtils, context, prismaError
└── docs/                            # Documentation sources
```
```

---

## Appendix A: Quick Command Reference

```bash
# ── LOCAL DEVELOPMENT ──
cd server && npm run dev          # Start backend with nodemon
cd client && npm run dev          # Start frontend with Vite

# ── DATABASE ──
npx prisma generate               # Regenerate Prisma client
npx prisma migrate dev --name x   # Create + apply migration
npx prisma migrate deploy         # Apply pending migrations
npx prisma studio                 # Visual database browser
npx prisma db seed                # Run seed_data.js

# ── BUILD ──
cd client && npm run build        # Production frontend build
cd client && npm run preview      # Preview production build locally

# ── LINTING ──
cd client && npm run lint         # Run ESLint

# ── DEPLOYMENT ──
git push origin main              # Triggers auto-deploy on Vercel + Railway
```

---

## Appendix B: Key Design Decisions

1. **Extended Prisma Client**: All queries are auto-scoped by `gymId`/`tenantId` via `$extends`, eliminating repetitive filtering in every controller.

2. **Redis with Fallback**: The system never crashes if Redis is unavailable. An `InMemoryRedis` class provides identical API surface for development and degraded production environments.

3. **Dual Auth Strategy**: JWT verification with fallback to Neon Auth DB session lookup ensures reliability even during token key rotation.

4. **Session Versioning**: Each user has a `sessionVersion` counter. Incrementing it instantly invalidates all existing tokens without needing a token blacklist.

5. **Role Hierarchy in Authorization**: The `authorize()` middleware implements hierarchical access (Owner > Admin > Staff) so higher roles automatically pass lower-role checks.

6. **Global vs Gym-scoped Models**: Products, Plans, Categories, and similar catalog items can be shared across all gyms within a tenant (`isGlobal: true`) or restricted to a specific gym.

7. **Feature-based Architecture**: Both frontend and backend organize code by business feature rather than technical layer, improving maintainability and discoverability.

---

*End of FitOS Documentation*
