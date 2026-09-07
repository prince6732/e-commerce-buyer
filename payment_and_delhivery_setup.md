# Cashfree Payment Gateway & Delhivery Shipment Setup Guide
*(Local / Sandbox / Staging vs Production / Live Setup & Environment Switching)*

---

## 1. Cashfree Payment Gateway Configuration

### Environment Comparison

| Setting | Local / Sandbox / Test Mode | Production / Live Mode |
| :--- | :--- | :--- |
| **Backend Base URL** | `https://sandbox.cashfree.com/pg` | `https://api.cashfree.com/pg` |
| **Frontend SDK Mode** | `"sandbox"` | `"production"` |
| **Dashboard** | [Cashfree Merchant Sandbox](https://sandbox.cashfree.com) | [Cashfree Merchant Dashboard](https://merchant.cashfree.com) |
| **API Keys** | Test App ID & Secret Key (`TEST...`) | Production App ID & Secret Key |
| **API Version** | `2023-08-01` | `2023-08-01` |

---

### Step-by-Step Code Configuration for Cashfree

#### A. Backend Setup (`nest-api`)

File: [`nest-api/src/payment/payment.service.ts`](file:///d:/Zelton-new/nest-api/src/payment/payment.service.ts#L34-L50)

```ts
// --- LOCAL / TEST (SANDBOX) CONFIG (Active by default for local testing) ---
this.baseUrl = this.config.get<string>('CASHFREE_BASE_URL', 'https://sandbox.cashfree.com/pg');

// --- LIVE / PRODUCTION CONFIG (Uncomment when going live) ---
// this.baseUrl = this.config.get<string>('CASHFREE_BASE_URL', 'https://api.cashfree.com/pg');
```

##### Environment Variables in `nest-api/.env` for Cashfree:
```env
# Cashfree Production / Live Keys (Active)
CASHFREE_APP_ID=1135536262db36c353241d304a56355311
CASHFREE_SECRET_KEY=cfsk_ma_prod_0cce22df61c43085874a8769265fe9ba_8d2e6f55
CASHFREE_API_VERSION=2023-08-01
CASHFREE_BASE_URL=https://api.cashfree.com/pg
```

---

#### B. Frontend Setup (`next-app`)

Files:
- [`next-app/src/app/(marketing)/checkout/page.tsx`](file:///d:/Zelton-new/next-app/src/app/%28marketing%29/checkout/page.tsx#L235-L245)
- [`next-app/src/app/(marketing)/checkout/single/CheckoutSingleContent.tsx`](file:///d:/Zelton-new/next-app/src/app/%28marketing%29/checkout/single/CheckoutSingleContent.tsx#L282-L292)

```tsx
// Local / Sandbox (Active by default)
const cashfreeMode = process.env.NEXT_PUBLIC_CASHFREE_MODE || "sandbox"; 

const cashfree = new (window as any).Cashfree({
    mode: cashfreeMode // "sandbox" for Local, "production" for Live
});
```

##### Environment Variables in `next-app/.env.local`:
```env
# Local / Sandbox Mode
NEXT_PUBLIC_CASHFREE_MODE=sandbox

# Production / Live Mode (Set on Live deployment server)
# NEXT_PUBLIC_CASHFREE_MODE=production
```

---

## 2. Delhivery Courier Shipment Configuration

### Environment Comparison

| Setting | Local / Staging / Test Mode | Production / Live Mode |
| :--- | :--- | :--- |
| **Backend Base URL** | `https://staging-express.delhivery.com/api` | `https://track.delhivery.com/api` |
| **API Token** | Delhivery Staging Token | Delhivery Production Client API Token |
| **Client Name** | Registered Warehouse Name (e.g. `Zelton`) | Production Registered Warehouse Name |
| **Pickup Location** | `Zelton` | Production Pickup Location Name |

---

### Step-by-Step Code Configuration for Delhivery

#### Backend Setup (`nest-api`)

File: [`nest-api/src/delhivery/delhivery.service.ts`](file:///d:/Zelton-new/nest-api/src/delhivery/delhivery.service.ts#L30-L50)

```ts
// --- LOCAL / TEST (STAGING) CONFIG (Active by default for local testing) ---
this.baseUrl = this.config.get<string>('DELHIVERY_BASE_URL', 'https://staging-express.delhivery.com/api');

// --- LIVE / PRODUCTION CONFIG (Uncomment when going live) ---
// this.baseUrl = this.config.get<string>('DELHIVERY_BASE_URL', 'https://track.delhivery.com/api');
```

##### Environment Variables in `nest-api/.env` for Delhivery:
```env
# Delhivery Credentials (Your Delhivery One Token)
DELHIVERY_API_KEY=01f9c0dc1b34a02b830fdc5b232c7ca7d41466ad
DELHIVERY_BASE_URL=https://track.delhivery.com/api
DELHIVERY_CLIENT_NAME=Zelton
DELHIVERY_PICKUP_LOCATION=Zelton
DELHIVERY_RETURN_ADDRESS=#129 naib colony Village kanwla Ambala city
DELHIVERY_RETURN_CITY=Ambala
DELHIVERY_RETURN_STATE=Haryana
DELHIVERY_RETURN_PIN=134003
DELHIVERY_RETURN_PHONE=9729310456

# Local Testing Flag:
# Set to 'true' to simulate shipment creation, tracking & labels locally without ₹0 wallet balance errors
# Set to 'false' on live production to generate real shipments via Delhivery API
DELHIVERY_TEST_MODE=true
```

---

## 3. Checklist for Going Live (Production Deployment)

When deploying to live production server:

1. **NestJS Backend (`nest-api`)**:
   - In `.env`, set `CASHFREE_BASE_URL=https://api.cashfree.com/pg` and update `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` with live merchant production credentials.
   - In `.env`, set `DELHIVERY_BASE_URL=https://track.delhivery.com/api` and update `DELHIVERY_API_KEY` with production Delhivery token.
   - In [`payment.service.ts`](file:///d:/Zelton-new/nest-api/src/payment/payment.service.ts), toggle `this.baseUrl` default to `https://api.cashfree.com/pg`.
   - In [`delhivery.service.ts`](file:///d:/Zelton-new/nest-api/src/delhivery/delhivery.service.ts), toggle `this.baseUrl` default to `https://track.delhivery.com/api`.

2. **Next.js Frontend (`next-app`)**:
   - In `.env.production` or environment settings, set `NEXT_PUBLIC_CASHFREE_MODE=production`.

3. **Webhook URL Setup**:
   - **Cashfree Webhook Endpoint**: `https://api.zelton.co.in/api/payment/verify`
   - **Delhivery Webhook Endpoint**: `https://api.zelton.co.in/api/delhivery/webhook`
