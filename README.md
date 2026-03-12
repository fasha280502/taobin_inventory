# Tao Bin Malaysia – Warehouse Inventory System

A full-stack **LAN Server Warehouse Inventory System** designed for Tao Bin Malaysia, running on Windows 11. Access it from any browser on the same network — no internet required.

## Screenshots

### Login Page
![Login Page](https://github.com/user-attachments/assets/7d06e2cc-ad17-4e41-8a5a-9265582c2cbe)

### Dashboard
![Dashboard](https://github.com/user-attachments/assets/249f6345-c296-497b-8b3a-61b37129dd05)

### Products
![Products](https://github.com/user-attachments/assets/aa567cb0-c5aa-4256-9b09-0e0418208a4b)

---

## Features

| Module | Description |
|--------|-------------|
| 🔐 **Authentication** | JWT-based login with role-based access control (Admin / Manager / Staff) |
| 📦 **Products** | Full CRUD, auto-generated SKU, barcode, location, unit cost & selling price |
| 🏷️ **Categories** | Manage product categories (7 pre-seeded defaults for Tao Bin) |
| 🚚 **Suppliers** | Manage supplier contacts |
| 📥 **Stock IN** | Record goods received with PO/DO reference |
| 📤 **Stock OUT** | Issue stock with Work Order reference, with live stock validation |
| 🔄 **Adjustments** | Stock count adjustments (Manager/Admin only) |
| ↩️ **Returns** | Record returns to supplier |
| ⚠️ **Low Stock Alerts** | Dashboard alerts + red badges for items at or below reorder point |
| 📊 **Reports** | Printable inventory & transaction reports |
| 👥 **Users** | Admin can create/edit/deactivate staff accounts |
| 🔍 **Audit Log** | All actions are logged with user, IP, and timestamp |

---

## Quick Start (Windows 11)

### Prerequisites
- [Node.js LTS](https://nodejs.org/) (v18 or later)

### Run
1. Double-click **`start.bat`** — it installs dependencies and starts the server automatically.
2. Open a browser and go to: **`http://localhost:3000`**
3. Log in with: `admin` / `admin123`
4. **⚠️ Change the default password immediately after first login!**

### Access from other computers on the LAN
Other computers on the same network can open:
```
http://<server-ip>:3000
```
The server-IP is shown in the console when the server starts.

---

## Install as Windows Service (runs on boot, no window needed)

Run PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install-service.ps1 -Action install
```

To stop/uninstall:
```powershell
.\install-service.ps1 -Action stop
.\install-service.ps1 -Action uninstall
```

> Requires [NSSM](https://nssm.cc/) — the script will download it automatically.

---

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port to listen on |
| `JWT_SECRET` | *(dev default)* | **Set this in production!** Secret for JWT signing |
| `NODE_ENV` | — | Set to `production` to enforce JWT_SECRET |

Example:
```bat
set JWT_SECRET=your-very-secret-key
set PORT=3000
node server.js
```

---

## Tech Stack

- **Backend**: Node.js + Express 5
- **Database**: SQLite (`better-sqlite3`) — file-based, no separate DB server needed
- **Auth**: `bcryptjs` + `jsonwebtoken`
- **Security**: `helmet` (CSP, HSTS, XSS headers) + `express-rate-limit`
- **Frontend**: Bootstrap 5 + Font Awesome 6 (**all assets vendored locally** — no internet needed on the LAN)

---

## Default Categories

Pre-seeded for Tao Bin Malaysia warehouse operations:

1. Machine Parts
2. Beverages
3. Consumables
4. Cleaning Supplies
5. Packaging
6. Electronics
7. Office Supplies

---

## User Roles

| Role | Can Do |
|------|--------|
| **Admin** | Everything including user management, adjustments, deletes |
| **Manager** | Create/edit products, categories, suppliers, adjustments |
| **Staff** | Record stock IN / OUT only |

---

## Development

```bash
# Install dependencies
npm install

# Start server (development)
npm start

# Run tests
npm test
```

Data is stored in `data/inventory.db` (created automatically).
