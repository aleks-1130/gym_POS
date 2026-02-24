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
- **Database**: PostgreSQL (via NeonDB)

## 🚀 Developer Setup

### 1. Environment Variables (.env)
We use a shared PostgreSQL database. Due to security, the connection string is not in the repo.
1.  Navigate to the `server/` directory.
2.  Copy `.env.example` to a new file named `.env`.
3.  Fill in the keys:
    *   **PORT**: `5000`
    *   **DATABASE_URL**: *(Ask the project lead for this key)*
    *   **JWT_SECRET**: *(Ask the project lead for this key)*

### 2. Setup & Start Backend
Open a terminal and run:
```bash
cd server
npm install
npx prisma generate  # Creates the database client
node server.js
```
*Wait for the message: "Server running on port 5000".*

### 3. Start Frontend
Open a **new** terminal window (keep the server running) and run:
```bash
cd client
npm install
npm run dev
```
*Ctrl+Click the link shown (usually http://localhost:5173).*

### 4. Setup Local Email Webhooks (n8n)
We use **n8n** to handle email webhooks (e.g., Member and Trainer Account Activations). To test emails locally via Docker:
1. Open Docker and follow the setup based on PDF (check Documentation in DC)
2. Open `http://localhost:5678` in your browser and set up an owner account.
3. Import the `.json` file to add the Gmail nodes and Switch node routing for roles (`MEMBER` vs `TRAINER`).

## Demo Credentials
Login with these pre-configured credentials:
- **Email**: `admin@gym.com`
- **Password**: `password123`
