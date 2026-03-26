const axios = require('axios');

const sendEmailWebhook = async (webhookUrl, payload) => {
    if (!webhookUrl) {
        console.warn(`[EmailService] Webhook URL not configured. Skipping email.`);
        return;
    }

    console.log(`[EmailService] Attempting to send webhook to: ${webhookUrl.substring(0, 15)}... (len: ${webhookUrl.length})`);

    try {
        const response = await axios.post(webhookUrl, payload);
        console.log(`[EmailService] Webhook SUCCESS for ${payload.email} (Status: ${response.status})`);
    } catch (error) {
        console.error(`[EmailService] Webhook FAILED for ${payload.email}:`, error.message);
        if (error.response) {
            console.error(`[EmailService] Response data:`, JSON.stringify(error.response.data));
            console.error(`[EmailService] Response status:`, error.response.status);
        }
    }
};

const sendActivationEmail = async (email, name, token, planName, expiryDate, phone, birthDate, gender, role = 'MEMBER', gymContext = {}) => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const activationLink = `${frontendUrl}/activate?token=${token}`.trim();

    const payload = {
        email,
        name,
        role, // 'MEMBER' or 'TRAINER'
        activationLink,
        planName,
        expiryDate,
        phone: phone || 'N/A',
        birthDate: birthDate || 'N/A',
        gender: gender || 'N/A',
        gymName: gymContext?.name || null,
        gymId: gymContext?.id || null
    };

    console.log(`[EmailService] Sending activation email payload for ${email}`);
    await sendEmailWebhook(process.env.N8N_ACTIVATION_WEBHOOK_URL, payload);
};

const sendPasswordResetEmail = async (email, name, token, gymContext = {}) => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const resetLink = `${frontendUrl}/reset-password?token=${token}`.trim();

    const payload = {
        email,
        name,
        role: 'FORGOT_PASSWORD', // Matches the exact n8n rule!
        resetLink,
        gymName: gymContext?.name || null,
        gymId: gymContext?.id || null
    };

    console.log(`[EmailService] Sending password reset payload for ${email}`);
    await sendEmailWebhook(process.env.N8N_ACTIVATION_WEBHOOK_URL, payload);
};

module.exports = { sendActivationEmail, sendPasswordResetEmail, sendEmailWebhook };
