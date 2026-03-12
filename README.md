# Tao Bin Malaysia — Warehouse Inventory System

A LAN-based warehouse inventory management system built for **Tao Bin Malaysia**. Runs on Windows 11 (or any OS with Node.js) and is accessible by all devices on the local network.

## Features

- **Dashboard** — Real-time overview of stock levels, low-stock alerts, and recent transactions
- **Product Management** — Full CRUD for products with SKU, categories, stock levels, and warehouse locations
- **Category Management** — Organize products into categories
- **Stock In / Out** — Record incoming and outgoing stock with reference numbers and notes; automatic quantity updates
- **Low Stock Alerts** — Configurable minimum stock thresholds per product
- **User Management** — Admin and staff roles with JWT authentication
- **LAN Access** — Runs as a local web server accessible from any device on the same network
- **Responsive UI** — Bootstrap 5 interface that works on desktops, tablets, and phones

## Tech Stack

| Layer     | Technology                  |
|-----------|-----------------------------|
| Backend   | Node.js + Express           |
| Database  | SQLite (via better-sqlite3) |
| Auth      | JWT (jsonwebtoken + bcryptjs) |
| Frontend  | HTML / CSS / JavaScript + Bootstrap 5 |
| Tests     | Jest + Supertest            |

## Quick Start (Windows 11)

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

### Setup

1. **Download / clone** this repository
2. **Double-click `start.bat`** — it will install dependencies, create the config file, and start the server
3. Open a browser and go to **http://localhost:3000**

### Default Login

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | Admin |

> **Important:** Change the default admin password and the `JWT_SECRET` in `.env` before using in production.

## Manual Setup

```bash
# Install dependencies
npm install

# Create config file
cp .env.example .env
# Edit .env to set your JWT_SECRET

# Start the server
npm start
```

The server will be available at `http://localhost:3000`.

Other devices on the LAN can access it at `http://<your-ip>:3000` (use `ipconfig` on Windows to find your IP address).

## Configuration

Edit the `.env` file:

```
PORT=3000                              # Server port
JWT_SECRET=change-this-to-a-secret     # Secret key for JWT tokens
DB_PATH=./inventory.db                 # Path to SQLite database file
```

## API Endpoints

### Authentication
| Method | Endpoint           | Description      |
|--------|--------------------|------------------|
| POST   | `/api/auth/login`  | Login and get JWT token |

### Categories
| Method | Endpoint              | Description           |
|--------|-----------------------|-----------------------|
| GET    | `/api/categories`     | List all categories   |
| GET    | `/api/categories/:id` | Get category by ID    |
| POST   | `/api/categories`     | Create a category     |
| PUT    | `/api/categories/:id` | Update a category     |
| DELETE | `/api/categories/:id` | Delete a category     |

### Products
| Method | Endpoint            | Description                        |
|--------|---------------------|------------------------------------|
| GET    | `/api/products`     | List products (filter by `category_id`, `search`, `low_stock`) |
| GET    | `/api/products/:id` | Get product by ID                  |
| POST   | `/api/products`     | Create a product                   |
| PUT    | `/api/products/:id` | Update a product                   |
| DELETE | `/api/products/:id` | Delete a product                   |

### Transactions (Stock In/Out)
| Method | Endpoint             | Description              |
|--------|----------------------|--------------------------|
| GET    | `/api/transactions`  | List transactions (filter by `product_id`, `type`) |
| POST   | `/api/transactions`  | Create stock IN or OUT   |

### Dashboard
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/api/dashboard/stats`            | Get summary statistics   |
| GET    | `/api/dashboard/low-stock`        | Get low-stock products   |
| GET    | `/api/dashboard/recent-transactions` | Get recent transactions |

### Users (Admin only)
| Method | Endpoint          | Description        |
|--------|-------------------|--------------------|
| GET    | `/api/users`      | List all users     |
| POST   | `/api/users`      | Create a user      |
| PUT    | `/api/users/:id`  | Update a user      |

## Running Tests

```bash
npm test
```

## Project Structure

```
├── server.js                # Express server entry point
├── start.bat                # Windows startup script
├── package.json
├── .env.example             # Environment config template
├── public/                  # Frontend static files
│   ├── index.html           # Single-page application
│   ├── css/style.css        # Custom styles
│   └── js/app.js            # Frontend JavaScript
├── src/
│   ├── config/database.js   # SQLite database setup & schema
│   ├── middleware/auth.js   # JWT authentication middleware
│   └── routes/
│       ├── auth.js          # Login endpoint
│       ├── categories.js    # Category CRUD
│       ├── products.js      # Product CRUD
│       ├── transactions.js  # Stock in/out
│       ├── users.js         # User management
│       └── dashboard.js     # Dashboard & reports
└── tests/
    └── api.test.js          # API integration tests
```

## License

MIT