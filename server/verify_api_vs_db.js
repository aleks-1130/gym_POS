const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://127.0.0.1:5000';

async function main() {
    console.log("🔍 Starting Audit: API vs Database (using native fetch)...");

    // 1. DIRECT DATABASE CHECK
    console.log("\n--- [DATABASE DIRECT CHECK] ---");
    try {
        const dbTotal = await prisma.expense.aggregate({ _sum: { amount: true } });
        console.log(`DB Total Expenses Sum (All Time): ${dbTotal._sum.amount}`);

        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const mtdTotal = await prisma.expense.aggregate({
            _sum: { amount: true },
            where: { date: { gte: firstDayOfMonth } }
        });
        console.log(`DB MTD Expenses Sum (Since ${firstDayOfMonth.toISOString()}): ${mtdTotal._sum.amount}`);

        const count = await prisma.expense.count();
        console.log(`DB Expense Count: ${count}`);
    } catch (e) {
        console.error("DB Check Failed:", e.message);
    }

    // 2. API CHECK
    console.log("\n--- [API LIVE CHECK] ---");
    try {
        // Login
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@gym.com', password: 'password123' })
        });

        if (!loginRes.ok) throw new Error(`Login Failed: ${loginRes.status}`);
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log("Login Successful, Token received.");

        // Fetch Dashboard Stats
        const statsRes = await fetch(`${BASE_URL}/api/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsData = await statsRes.json();
        console.log("API /dashboard/stats Response Keys:", Object.keys(statsData));
        console.log("API /dashboard/stats monthlyRevenue:", statsData.monthlyRevenue); // Check specific value
        console.log(JSON.stringify(statsData, null, 2));

        // Fetch Expenses List
        const listRes = await fetch(`${BASE_URL}/api/expenses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const apiExpenses = await listRes.json();
        const apiSum = apiExpenses.reduce((sum, e) => sum + e.amount, 0);
        console.log(`API /expenses Manual Sum: ${apiSum}`);

    } catch (e) {
        console.error("API Check Failed:", e.message);
    }

    await prisma.$disconnect();
}

main();
