const { redisClient, connectRedis } = require('./server/src/config/redisClient');

async function verifyPOSLogic() {
    console.log('--- POS Logic Verification (Simulated Failure) ---');
    
    // 1. Initial connection (should trigger fallback if redis is down)
    console.log('Step 1: Connecting...');
    await connectRedis();
    
    try {
        const sessionId = 'test-session-' + Date.now();
        const productId = '101';
        
        // 2. Test hSet
        console.log('Step 2: Reserving stock (hSet)...');
        await redisClient.hSet(`cart:reserve:${sessionId}`, productId, '5');
        
        // 3. Test keys
        console.log('Step 3: Finding all reservations (keys)...');
        const keys = await redisClient.keys('cart:reserve:*');
        console.log('Found keys:', keys);
        
        // 4. Test hGetAll
        console.log('Step 4: Fetching reservation details (hGetAll)...');
        const details = await redisClient.hGetAll(`cart:reserve:${sessionId}`);
        console.log('Details:', details);
        
        // 5. Validation logic from reserveController
        console.log('Step 5: Running reservation calculation logic...');
        let globalHold = 0;
        for (const key of keys) {
            const hdata = await redisClient.hGetAll(key);
            if (hdata[productId]) {
                globalHold += Number(hdata[productId]);
            }
        }
        console.log('Global Hold calculated:', globalHold);
        
        if (globalHold === 5 && details[productId] === '5') {
            console.log('\n✅ SUCCESS: Redis fallback handled the full POS reservation flow correctly.');
            process.exit(0);
        } else {
            console.log('\n❌ FAILURE: Logic mismatch in fallback.');
            process.exit(1);
        }
        
    } catch (err) {
        console.error('\n❌ CRASH: POS logic failed under fallback:', err);
        process.exit(1);
    }
}

verifyPOSLogic();
