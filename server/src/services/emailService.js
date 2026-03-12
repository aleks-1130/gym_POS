const axios = require('axios');

const sendEmailWebhook = async (webhookUrl, payload) => {
    if (!webhookUrl) {
        console.warn(`[EmailService] Webhook URL not configured. Skipping email.`);
        return;
    }
    try {
        await axios.post(webhookUrl, payload);
        console.log(`[EmailService] Webhook sent for ${payload.email}`);
    } catch (error) {
        console.error(`[EmailService] Webhook failed for ${payload.email}:`, error.message);
    }
};

const sendActivationEmail = async (email, name, token, planName, expiryDate, phone, birthDate, gender, role = 'MEMBER') => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const activationLink = `${frontendUrl}/activate?token=${token}`.trim();

    const payload = {
        email,
        name,
        role, // 'MEMBER' or 'TRAINER'
        activationLink,
        planName,
        expiryDate
    };

    await sendEmailWebhook(process.env.N8N_ACTIVATION_WEBHOOK_URL, payload);
};

const sendPasswordResetEmail = async (email, name, token) => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const resetLink = `${frontendUrl}/reset-password?token=${token}`.trim();

    const payload = {
        email,
        name,
        role: 'FORGOT_PASSWORD', // Matches the exact n8n rule!
        resetLink
    };

    await sendEmailWebhook(process.env.N8N_ACTIVATION_WEBHOOK_URL, payload);
};

module.exports = { sendActivationEmail, sendPasswordResetEmail, sendEmailWebhook };
