const axios = require('axios');

const sendEmailWebhook = async (webhookUrl, payload) => {
    if (!webhookUrl) {
        console.warn(`[EmailService] Webhook URL not configured for ${payload.type}. Skipping email.`);
        return;
    }
    try {
        await axios.post(webhookUrl, payload);
        console.log(`[EmailService] Webhook sent for ${payload.type} to ${payload.email}`);
    } catch (error) {
        console.error(`[EmailService] Webhook failed for ${payload.email}:`, error.message);
    }
};

/**
 * Sends an activation email to a member when staff approves them.
 */
const sendActivationEmail = async (email, name, token, planName, expiryDate, phone, birthDate, gender, role = 'MEMBER') => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const activationLink = `${frontendUrl}/activate?token=${token}`.trim();
    const webhookUrl = process.env.N8N_ACTIVATION_WEBHOOK_URL;

    await sendEmailWebhook(webhookUrl, {
        type: 'ACCOUNT_ACTIVATED',
        role,
        email,
        name,
        activationLink,
        planName,
        expiryDate,
        phone,
        birthDate,
        gender
    });
};

module.exports = { sendActivationEmail };
