const axios = require('axios');

async function trigger() {
    console.log("--- Triggering Split Payment API ---");
    
    // Using ₱100 total
    const payload = {
        amount: 100,
        type: 'PRODUCT_PURCHASE',
        memberId: 68,
        items: [
            { id: 1, name: 'Test Drink', type: 'PRODUCT', quantity: 1, unitPrice: 100 }
        ],
        collections: [
            { method: 'CASH', amount: 30 },
            { method: 'GCASH', amount: 70, financialInstitutionId: 'VERIFY_SPLIT_01' }
        ]
    };

    try {
        // We simulate the req.user by bypassing auth or finding a working token
        // But for a simple backend test, we can just call the public endpoint if it is exposed,
        // OR we can just use the Prisma test script to verify the logic directly.
        
        console.log("Since auth might be required, we will use the Prisma script to verify the logic directly.");
    } catch (err) {
        console.error("Trigger failed:", err.response?.data || err.message);
    }
}

trigger();
