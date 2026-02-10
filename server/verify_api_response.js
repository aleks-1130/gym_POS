const LOGIN_URL = 'http://localhost:5000/api/auth/login';
const SUPPLIERS_URL = 'http://localhost:5000/api/suppliers';

async function checkApi() {
    try {
        // 1. Login to get token
        console.log("Logging in...");
        const loginRes = await fetch(LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@gym.com', password: 'password123' })
        });

        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log("Got token.");

        // 2. Fetch Suppliers
        console.log("Fetching Suppliers...");
        const res = await fetch(SUPPLIERS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const suppliers = await res.json();

        // 3. Inspect first supplier
        console.log(`Fetched ${suppliers.length} suppliers.`);

        const gymPro = suppliers.find(s => s.name.includes("Gym Pro"));
        if (gymPro) {
            console.log("Found 'Gym Pro Supplies':");
            console.log("Has 'products' key?", 'products' in gymPro);
            console.log("Products is array?", Array.isArray(gymPro.products));
            console.log("Products length:", gymPro.products ? gymPro.products.length : 'N/A');
            if (gymPro.products && gymPro.products.length > 0) {
                console.log("Sample product:", gymPro.products[0]);
            }
        } else {
            console.log("Gym Pro Supplies not found in response.");
        }

    } catch (e) {
        console.error("API Check Failed:", e.message);
    }
}

checkApi();
