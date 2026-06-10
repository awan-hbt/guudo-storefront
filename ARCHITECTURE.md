# Guudo Storefront Architecture Diagram

## Overview
Guudo is a Japanese street food storefront built with Next.js, featuring both online ordering and POS (Point of Sale) capabilities with real-time stock management.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GUUDO STOREFRONT                                 │
│                        Japanese Street Food System                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼────────┐           ┌──────────▼──────────┐
            │   Next.js App  │           │   Supabase Cloud    │
            │   (Frontend)   │◄──────────►│   (Backend)         │
            │                │   API      │                    │
            └───────┬────────┘           └──────────┬───────────┘
                    │                               │
    ┌───────────────┼───────────────┐               │
    │               │               │               │
┌───▼────┐   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
│ Landing│   │  Order    │   │    POS    │   │ Database  │
│  Page  │   │  Page     │   │   Page    │   │           │
│  (/)   │   │ (/order)  │   │  (/pos)   │   │ PostgreSQL│
└────────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                    │               │               │
                    └───────┬───────┘               │
                            │                       │
                    ┌───────▼───────────────────────┴───────┐
                    │           API Routes                    │
                    │  /api/orders, /api/stock, /api/config   │
                    └───────┬───────────────────────┬───────┘
                            │                       │
                    ┌───────▼───────┐       ┌───────▼───────┐
                    │  Watzap API   │       │  iPaymu API   │
                    │  (WhatsApp)   │       │  (QRIS Pay)   │
                    └───────────────┘       └───────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 16.2.6 (App Router)
- **UI Library**: React 19.2.4
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript 5
- **Fonts**: Geist Sans & Geist Mono (Google Fonts)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (menu images)
- **Auth**: Supabase Auth (service role for server operations)

### Integrations
- **WhatsApp**: Watzap API (customer & admin notifications)
- **Payment**: iPaymu (QRIS payment gateway via proxy)

## Directory Structure

```
guudo-storefront/
├── app/
│   ├── api/                    # API Routes
│   │   ├── config/            # App configuration endpoint
│   │   ├── orders/            # Order management endpoints
│   │   │   ├── payment-callback/  # iPaymu webhook
│   │   │   ├── qrcode/            # QR code generation
│   │   │   ├── qris/              # QRIS payment generation
│   │   │   ├── receipt/           # Receipt upload
│   │   │   ├── status/            # Order status check
│   │   │   └── route.ts           # Order creation
│   │   ├── pos/                # POS-specific endpoints
│   │   └── stock/              # Stock & menu endpoint
│   ├── faq/                   # FAQ page
│   ├── order/                 # Online ordering page
│   ├── pos/                   # Point of Sale page
│   ├── refund-policy/         # Refund policy page
│   ├── terms/                 # Terms & conditions page
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Landing page
├── lib/
│   ├── supabase-browser.ts    # Supabase browser client
│   ├── supabase-server.ts     # Supabase server client
│   └── watzap.ts              # WhatsApp notification functions
├── public/                    # Static assets
├── supabase/
│   └── schema.sql             # Database schema
└── package.json
```

## Database Schema

### Tables

**menu_items**
- id (text, primary key)
- name (text)
- description (text)
- price (integer)
- category (text: 'main' | 'addon')
- unit (text: 'porsi' | 'pcs' | etc.)
- image_url (text)
- stock_group_id (text, foreign key)
- stock_available (integer)
- sort_order (integer)

**orders**
- id (uuid, primary key)
- reference_code (text, unique: "GD-XXXX")
- name (text)
- phone (text)
- total_price (integer)
- payment_status (text: 'pending' | 'paid')
- receipt_url (text)
- ipaymu_trx_id (text)
- memo (text)
- source (text: 'online' | 'pos')
- cash_tendered (integer)
- change_due (integer)
- created_at (timestamp)

**order_items**
- id (uuid, primary key)
- order_id (uuid, foreign key)
- menu_item_id (text, foreign key)
- quantity (integer)
- unit_price (integer)

**stock_groups**
- id (text, primary key)
- available (integer)

**app_config**
- key (text, primary key)
- value (text)

### Storage Buckets
- `menu-images` (public) - Product photos

## Data Flow

### Online Ordering Flow

```
Customer
  │
  ├─> Landing Page (/)
  │   └─> View Menu (from Supabase)
  │
  └─> Order Page (/order)
      ├─> Select Items
      ├─> Enter Details (name, phone, memo)
      └─> Submit Order
          │
          ├─> POST /api/orders
          │   ├─> Generate Reference Code (GD-XXXX)
          │   ├─> Call RPC: place_order (atomic stock deduction)
          │   ├─> Insert Order
          │   ├─> Insert Order Items
          │   ├─> Send WhatsApp: notifyCustomerOrderReceived
          │   └─> Create iPaymu QRIS (if enabled)
          │
          ├─> Payment Options
          │   ├─> QRIS: Scan & Pay
          │   │   └─> iPaymu Callback → /api/orders/payment-callback
          │   │       └─> Update payment_status to 'paid'
          │   │
          │   └─> Transfer: Upload Receipt
          │       └─> POST /api/orders/receipt
          │           ├─> Upload to Supabase Storage
          │           ├─> Send WhatsApp: notifyAdminReceiptUploaded
          │           └─> Admin confirms manually
          │
          └─> Order Confirmation
              └─> Send WhatsApp: notifyCustomerConfirmed
```

### POS Flow

```
Staff
  │
  └─> POS Page (/pos)
      ├─> PIN Authentication (if configured)
      ├─> Select Items
      ├─> Enter Customer Details
      ├─> Select Payment Method
      │   ├─> Cash: Enter amount tendered
      │   ├─> QRIS: Generate QR code
      │   └─> Transfer: Upload receipt
      └─> Submit Order
          │
          └─> POST /api/pos/orders
              ├─> Generate Reference Code
              ├─> Call RPC: place_order
              ├─> Insert Order (source: 'pos')
              ├─> Insert Order Items
              └─> Send WhatsApp: notifyAdminPosOrder
```

### Stock Management

```
Stock is managed through:
1. Individual item stock (stock_available in menu_items)
2. Grouped stock (stock_groups table)

When placing an order:
- RPC function place_order atomically deducts stock
- Raises INSUFFICIENT_STOCK error if not enough stock
- Transaction is rolled back if stock check fails
```

## API Endpoints

### GET /api/stock
Returns menu items with current stock levels
- Response: `{ items: [...] }`

### GET /api/config
Returns app configuration
- Response: `{ ipaymuEnabled: boolean, posPin: string }`

### POST /api/orders
Creates a new online order
- Body: `{ name, phone, items, totalPrice, memo, ipaymuEnabled }`
- Response: `{ success: true, referenceCode, qrString? }`

### POST /api/orders/qris
Generates QRIS payment for existing order
- Body: `{ referenceCode }`
- Response: `{ success: true, qrString }`

### POST /api/orders/payment-callback
iPaymu webhook for payment confirmation
- Headers: `x-proxy-secret`
- Body: `{ reference_id, status, status_code }`
- Updates order payment_status to 'paid'

### POST /api/orders/receipt
Uploads payment receipt image
- Body: `{ referenceCode, file, memo }`
- Uploads to Supabase Storage
- Sends WhatsApp notification to admin

### GET /api/orders/status
Checks order payment status
- Query: `?referenceCode=XXX`
- Response: `{ paymentStatus: 'pending' | 'paid' }`

### GET /api/orders/qrcode
Generates QR code image for reference code
- Query: `?referenceCode=XXX`
- Response: PNG image

## WhatsApp Notifications (Watzap)

### Customer Notifications
1. **Order Received**: Template `thankyou_order_tmp2`
   - Sent immediately after order creation
   - Includes: name, reference code, total price

2. **Order Confirmed**: Template `confirmed_order_tmp`
   - Sent after payment confirmation
   - Includes: name, reference code, total price

### Admin Notifications
1. **POS Order**: Direct message
   - Sent when POS order is created
   - Includes: reference code, total, payment method, change due, notes

2. **Receipt Uploaded**: Direct message
   - Sent when customer uploads transfer receipt
   - Includes: reference code, name, phone, total, location, receipt URL

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `NEXT_PUBLIC_BASE_URL` - Application base URL (default: https://guudo.id)

Optional (for QRIS):
- `IPAYMU_PROXY_URL` - iPaymu proxy service URL
- `PROXY_SECRET` - Proxy service secret key

Optional (for WhatsApp):
- `WATZAP_API_KEY` - Watzap API key
- `WATZAP_ACCESS_TOKEN` - Watzap access token
- `WATZAP_ADMIN_PHONE` - Admin phone number for notifications

## Key Features

1. **Dual Ordering Channels**: Online web ordering and in-store POS
2. **Real-time Stock Management**: Atomic stock deduction via PostgreSQL RPC
3. **Multiple Payment Methods**: QRIS (iPaymu), Bank Transfer, Cash (POS)
4. **WhatsApp Integration**: Automated customer and admin notifications
5. **Receipt Upload**: Customers can upload transfer receipts
6. **Reference Code System**: Unique GD-XXXX codes for order tracking
7. **Responsive Design**: Mobile-first Tailwind CSS styling
8. **Image Support**: Product photos via Supabase Storage

## Security Considerations

1. **Service Role Key**: Used server-side for database operations (bypasses RLS)
2. **Proxy Secret**: Validates iPaymu webhook callbacks
3. **POS PIN**: Optional PIN protection for POS interface
4. **Stock Validation**: Atomic transaction prevents overselling
5. **Input Validation**: All API endpoints validate required fields
