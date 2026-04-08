# Restaurant Billing Backend

Production-ready Express + MongoDB + Socket.IO backend for restaurant billing, order management, and live table synchronization.

## Highlights

- JWT authentication with `admin`, `waiter`, and `cashier` roles
- Tenant-ready `restaurantId` scoping for future multi-restaurant support
- Live Socket.IO events for order, bill, and table status updates
- Basic offline-safe order sync through optional `clientOrderId` idempotency keys
- Bill generation with GST and discount handling
- Locked orders after billing to prevent accidental edits

## Project Structure

```text
backend/
  scripts/
  src/
    config/
    constants/
    controllers/
    middleware/
    models/
    routes/
    services/
    sockets/
    utils/
```

## Setup

1. Copy `.env.example` to `.env`
2. Install packages
3. Seed demo users, tables, orders, and bills
4. Start the API

```bash
cd backend
npm install
npm run seed
npm run dev
```

## Demo Credentials

After seeding, use:

- `admin@demo.com` / `Admin@123`
- `cashier@demo.com` / `Cashier@123`
- `waiter@demo.com` / `Waiter@123`

Seeded restaurant state includes:

- Table `1` with an active order
- Table `2` with a served order
- Table `3` with a locked billed order and printable receipt

## API Endpoints

- `POST /auth/login`
- `GET /tables`
- `POST /tables/:id/release`
- `GET /items`
- `POST /items`
- `PUT /items/:id`
- `GET /users`
- `POST /users`
- `POST /order`
- `PUT /order/:id`
- `GET /orders`
- `POST /bill/generate`
- `GET /bill/:id`
- `GET /health`

## Socket Events

- `connected`
- `order_created`
- `order_updated`
- `table_updated`
- `bill_generated`

Connect with a JWT:

```js
const socket = io("http://localhost:5000", {
  auth: {
    token: "<jwt>"
  }
});
```

Event payloads are sent as room-scoped envelopes with `eventId`, `entityId`, `version`, and minimal `data.patch` diffs for update events. See [`../REALTIME_ARCHITECTURE.md`](../REALTIME_ARCHITECTURE.md).

## Example Order Payload

```json
{
  "tableId": "6613a2fba6d7be5ce9876543",
  "clientOrderId": "mobile-device-42-order-1001",
  "items": [
    { "name": "Paneer Tikka", "qty": 2, "price": 220 },
    { "name": "Butter Naan", "qty": 4, "price": 35 }
  ],
  "status": "preparing"
}
```

## Example Bill Payload

```json
{
  "orderId": "6613a30ea6d7be5ce9876544",
  "taxRate": 5,
  "discountType": "percentage",
  "discountValue": 10
}
```

The backend also accepts the legacy flat discount format:

```json
{
  "orderId": "6613a30ea6d7be5ce9876544",
  "taxRate": 5,
  "discount": 50
}
```

## Master Data

- `GET /items` is available to admin, cashier, and waiter for menu reads
- `POST /items` and `PUT /items/:id` are available to admin and cashier
- `GET /users` and `POST /users` are admin-only for staff management
