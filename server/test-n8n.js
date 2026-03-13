require('dotenv').config();
const axios = require('axios');

async function testN8N() {
    const webhookUrl = process.env.N8N_NOTIFICATIONS_WEBHOOK_URL;
    
    if (!webhookUrl || webhookUrl.includes('your-n8n-instance')) {
        console.error('❌ Error: N8N_NOTIFICATIONS_WEBHOOK_URL is not set or still has the placeholder.');
        console.log('Please add it to your server/.env file first!');
        return;
    }

    console.log(`🚀 Sending test payload to: ${webhookUrl}`);

    const testPayload = {
        email: "test-member@example.com",
        name: "Test Member",
        eventType: "ANNOUNCEMENT",
        title: "Test Connection",
        message: "If you see this, your n8n integration is working! 🎉"
    };

    try {
        const response = await axios.post(webhookUrl, testPayload);
        console.log('✅ Success! n8n responded with:', response.status, response.data);
        console.log('Now check your n8n "Executions" tab to see the incoming data.');
    } catch (e) {
        console.error('❌ Failed to reach n8n:', e.message);
        if (e.response) {
            console.error('Response details:', e.response.status, e.response.data);
        }
    }
}

testN8N();
