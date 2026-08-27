# 📦 YM Inventory — Precision Logistics & Inventory Management System

YM Inventory is a state-of-the-art, multi-location inventory and logistics management application built for electronics, mobile device retailers, and repair businesses. It provides real-time stock tracking across **Warehouse** and **Shop** locations, dual tracking modes (**Quantity** vs. **Serialized / IMEI**), comprehensive movement audit logging, physical audit reconciliation, and strict role-based access control (RBAC).

---

## ✨ Features & Highlights

### 🏢 Multi-Location & Dual Tracking
- **Warehouse & Shop Locations:** Receive new shipments into the Warehouse and transfer retail stock to the Shop.
- **Quantity Tracking:** Bulk inventory counting for repair parts, screens, chargers, and accessories.
- **Serialized / IMEI Tracking:** Per-unit lifecycle tracking for mobile phones, tablets, laptops, and smartwatches.

### 🔄 End-to-End Stock Operations
- **Receive Stock (Stock-In):** Receive new inventory shipments into the Warehouse with custom supplier batch references.
- **Transfer Stock:** Move inventory seamlessly from Warehouse to Shop.
- **Sell Stock:** Record retail sales from the Shop floor.
- **Return Stock:** Process customer returns back to Shop or Warehouse.
- **Damage & Loss:** Record damaged or lost items with specific location logging.
- **Physical Reconciliation:** Audit physical stock counts against system ledgers with automatic adjustment logging.

### 📜 Complete Audit Trail & Movement History
- **Immutable Log:** Every stock change creates a structured `StockMovement` and `StockMovementUnit` log.
- **Quick Date Filters:** Filter movement history with presets: *All Time, Today, Yesterday, This Week, Last Week, This Month, Last Month,* or *Custom Date Ranges*.
- **Unit History:** View complete lifecycle history for any device by IMEI or Serial Number.

### 🛡️ Consolidated RBAC
- **ADMIN:** Sole administrative and operational management role. Full access to create products, manage categories, receive stock, transfer, sell, return, record damage/loss, and perform reconciliations.
- **USER:** Optional read-only staff role for viewing inventory balances, product details, unit history, and movement reports without modification rights.

### 📱 Responsive Mobile-First UX
- Custom bounded popover components prevent dropdown overflow on mobile viewports.
- Real-time stock status indicators (*IN_STOCK*, *LOW_STOCK*, *OUT_OF_STOCK*).
- Interactive dashboard metrics with fast in-memory caching.

---

## 🛠️ Technology Stack

### Backend
- **Framework:** [NestJS](https://nestjs.com/) (Node.js & TypeScript)
- **Database ORM:** [Prisma ORM](https://www.prisma.io/)
- **Database Engine:** [PostgreSQL](https://www.postgresql.org/) (Supabase / Railway)
- **Authentication:** Passport.js JWT Authentication with `bcrypt` password hashing
- **API Validation & Docs:** `class-validator`, `class-transformer`, `@nestjs/swagger`

### Frontend
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router & Turbopack)
- **Language:** TypeScript
- **Styling:** Vanilla CSS & TailwindCSS (Dark/Light mode support)
- **UI Components:** Custom Bounded Popovers, Skeleton Loaders, Modals

---

## 📐 System Lifecycle Architecture

```
                       [ Supplier Shipment ]
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   WAREHOUSE LOCATION  │
                     │  (Available Stock)    │
                     └───────────┬───────────┘
                                 │
                         Transfer Stock
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │     SHOP LOCATION     │
                     │    (Retail Floor)     │
                     └───────────┬───────────┘
                                 │
                         ┌───────┴───────┐
                         ▼               ▼
                     [ SALE ]       [ DAMAGE / LOSS ]
                         │
                    Return Stock
                         │
                         ▼
             [ WAREHOUSE / SHOP ]
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v20.x` or higher
- npm `v10.x` or higher
- PostgreSQL database instance (Local or Cloud)

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure Environment Variables (.env)
# Create a .env file based on .env.example
cp .env.example .env

# Run Database Migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Build Production Assets
npm run build

# Start Local Backend Server
npm run start:dev
```

#### Backend Environment Variables (`backend/.env`)
```env
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/postgres"
PORT=3000
JWT_SECRET="your-256-bit-hex-secret-key"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"
```

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Configure Environment Variables (.env.local)
cp .env.example .env.local

# Run Development Server
npm run dev

# Build Production Assets
npm run build
```

#### Frontend Environment Variables (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 📖 API Documentation & Swagger

When the backend server is running, you can access the interactive Swagger documentation at:

```
http://localhost:3000/api
```

### Core API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | User authentication & JWT generation |
| `GET` | `/products` | Admin, User | Get paginated product catalog |
| `POST` | `/products` | Admin | Create a new product |
| `GET` | `/inventory` | Admin, User | Get current inventory stock balances |
| `GET` | `/inventory/summary` | Admin, User | Get aggregated dashboard metrics |
| `POST` | `/stock/receive` | Admin | Receive stock into Warehouse |
| `POST` | `/stock/transfer` | Admin | Transfer stock from Warehouse to Shop |
| `POST` | `/stock/sell` | Admin | Record a retail sale from Shop |
| `POST` | `/stock/return` | Admin | Return sold stock |
| `POST` | `/stock/damage` | Admin | Log damaged stock |
| `POST` | `/stock/reconcile` | Admin | Physical audit reconciliation |
| `GET` | `/stock/movements` | Admin, User | Get audit movement history |

---

## 🌐 Production Deployment

### Backend Deployment (Railway / Render / VPS)
1. Set Root Directory: `backend`
2. Build Command: `npm run build`
3. Start Command: `npm run start:prod`
4. Configure environment variables (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`).

### Frontend Deployment (Vercel)
1. Set Root Directory: `frontend`
2. Framework Preset: Next.js
3. Build Command: `npm run build`
4. Set Environment Variable: `NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app`

---

## 📄 License

This project is proprietary software created for YM Inventory Management. All rights reserved.