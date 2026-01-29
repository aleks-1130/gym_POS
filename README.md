# FitOS - Gym POS System

A full-stack Gym Management System built with React, Node.js, Prisma, and Tailwind CSS.

## Features
- **Dashboard**: Real-time stats and visual analytics (Chart.js).
- **Members**: Complete management (Add/Edit) with status tracking.
- **Payments**: POS interface for memberships and retail items.
- **Access Control**: Live feed simulation and entry logging.
- **Authentication**: JWT-based secure login for staff.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Chart.js, Axios
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: SQLite (Dev) / PostgreSQL (Prod ready)

## How to Run

### 1. Setup & Start Backend
Open a terminal and run:
```bash
cd server
npm install
npx prisma db push
node server.js
```
*Wait for the message: "Server running on port 5000".*
*Note: On first run, it will automatically create the admin user.*

### 2. Start Frontend
Open a **new** terminal window (keep the server running) and run:
```bash
cd client
npm install
npm run dev
```
*Ctrl+Click the link shown (usually http://localhost:5173).*

## Demo Credentials
Login with these pre-configured credentials:
- **Email**: `admin@gym.com`
- **Password**: `password123`

> **Note**: The database is a local file (`server/dev.db`). If you want to reset data, just delete that file and restart the server.
