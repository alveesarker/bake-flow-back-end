# BakeFlow Backend (Express + MySQL)

A minimal, well-structured Express.js API for the BakeFlow bakery ERP, connected to the `bakeflow` MySQL database (the one you manage through phpMyAdmin). This first version implements the **Products** resource end-to-end: list (with category name + live stock quantity), get one, create, edit, and delete — deleting a product also removes its `product_inventory` row.

## Project structure

```
bakeflow-backend/
├── src/
│   ├── server.js              # entry point — starts Express + checks the DB
│   ├── app.js                 # express app: cors, json, routes, error handling
│   ├── config/
│   │   └── db.js              # mysql2 connection pool
│   ├── routes/
│   │   ├── index.js           # mounts /api/products (add more resources here)
│   │   └── product.routes.js
│   ├── controllers/
│   │   └── product.controller.js
│   └── middleware/
│       ├── notFound.js
│       └── errorHandler.js
├── .env.example
├── package.json
└── README.md
```

This shape is meant to grow: add `raw-material.routes.js` / `raw-material.controller.js`, `production.routes.js`, etc. the same way `product.routes.js` was built, then mount them in `src/routes/index.js`.

## 1. Set up the database

You already have the `bakeflow` database created via phpMyAdmin from the SQL dump. Nothing else to do here — just make sure MySQL/MariaDB is running (e.g. via XAMPP/WAMP/MAMP) and that the database is named `bakeflow`.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your local MySQL credentials (phpMyAdmin's default is usually `root` with no password):

```env
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=bakeflow

CORS_ORIGIN=*
```

`CORS_ORIGIN` can be `*` (any origin — fine for local dev) or a comma-separated list like `http://localhost:5173,http://localhost:5174` to lock it down to your frontend's dev server(s).

## 3. Install & run

```bash
npm install

npm run dev     # starts with nodemon (auto-restarts on file changes)
# or
npm start       # plain node
```

On startup you should see:

```
🚀 BakeFlow API running on http://localhost:3000
✅ Connected to MySQL database "bakeflow"
```

If the second line shows a connection error instead, double-check the `DB_*` values in `.env` and that MySQL is actually running.

## API reference

Base URL: `http://localhost:3000/api`

### `GET /products`
Returns every product joined with its category name (`product_category`) and current stock quantity (`product_inventory`, defaults to `0` if no inventory row exists yet).

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "product_id": 1,
      "product_name": "Butter Croissant",
      "product_code": "BC-001",
      "category_id": 2,
      "category_name": "Pastries",
      "description": "Classic French croissant",
      "customer_price": "120.00",
      "distributor_price": "90.00",
      "unit": "pc",
      "weight": "80.00",
      "minimum_stock": 40,
      "status": "Active",
      "inventory_id": 1,
      "stock_quantity": 96,
      "stock_last_updated": "2026-07-24 10:12:03"
    }
  ]
}
```

### `GET /products/:id`
Same shape as above, single object in `data`. Returns `404` if the product doesn't exist.

### `POST /products`
Creates a product **and** its matching `product_inventory` row in one transaction.

```json
{
  "product_name": "Sourdough Loaf",
  "product_code": "SD-002",
  "category_id": 1,
  "description": "24-hour ferment",
  "customer_price": 260,
  "distributor_price": 200,
  "unit": "pc",
  "weight": 750,
  "minimum_stock": 20,
  "status": "Active",
  "stock_quantity": 0
}
```
`product_name`, `category_id`, `customer_price`, `distributor_price`, and `unit` are required; everything else is optional.

### `PUT /products/:id`
Edits any subset of product fields. Send only the fields you want to change — everything else is left as-is. Include `stock_quantity` in the body to also update (or create) the `product_inventory` row for that product in the same request.

```json
{
  "customer_price": 130,
  "status": "Inactive",
  "stock_quantity": 42
}
```

### `DELETE /products/:id`
Deletes the product. Runs in a transaction: the `product_inventory` row is deleted first, then the `product` row. If the product is still referenced elsewhere (e.g. `product_recipe`, `customer_sale_item`, `production`), the delete is rolled back and you get a `409` with a clear message instead of a raw SQL error.

```json
{ "success": true, "message": "Product 7 and its product_inventory record were deleted" }
```

## Notes

- All responses use the shape `{ success, data | message }` so the frontend can handle them consistently.
- Errors (validation, not-found, MySQL constraint violations) are funneled through one error handler (`src/middleware/errorHandler.js`) so every endpoint fails predictably.
- The connection pool (`src/config/db.js`) is reused across requests rather than opening a new MySQL connection per call.
