const axios = require('axios');
const SibApiV3Sdk = require('@getbrevo/brevo');

// Initialize Brevo API
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
if (process.env.BREVO_API_KEY) {
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

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

/**
 * Registration/Activation Email
 * 🛡️ KEEPS USING n8n as requested
 */
const sendActivationEmail = async (email, name, token, planName, expiryDate, phone, birthDate, gender, role = 'MEMBER', gymContext = {}) => {
    const rawFrontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const frontendUrl = rawFrontendUrl.endsWith('/') ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;
    const activationLink = `${frontendUrl}/activate?token=${token}`.trim();

    const payload = {
        email,
        name,
        role,
        activationLink,
        planName,
        expiryDate,
        phone: phone || 'N/A',
        birthDate: birthDate || 'N/A',
        gender: gender || 'N/A',
        gymName: gymContext?.name || null,
        gymId: gymContext?.id || null
    };

    console.log(`[EmailService] Sending activation email payload via n8n for ${email}`);
    await sendEmailWebhook(process.env.N8N_ACTIVATION_WEBHOOK_URL, payload);
};

/**
 * Password Reset Email
 * 🚀 USES BREVO API for reliable production delivery on Railway
 */
const sendPasswordResetEmail = async (email, name, token, gymContext = {}) => {
    const rawFrontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const frontendUrl = rawFrontendUrl.endsWith('/') ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;
    const resetLink = `${frontendUrl}/reset-password?token=${token}`.trim();

    console.log(`[EmailService] Sending password reset email via Brevo API to ${email}`);

    const gymName = gymContext?.name || 'our gym';
    
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Reset Your Password - Gym POS";
    sendSmtpEmail.htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hello ${name},</p>
            <p>We received a request to reset your password for your account at <strong>${gymName}</strong>.</p>
            <p>Please click the button below to set a new password. This link is valid for 1 hour.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
            </div>
            <p>If you did not request this, please ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777;">
                Gym POS System | ${gymName}
            </p>
        </div>
    `;
    sendSmtpEmail.sender = { name: "Gym POS Support", email: process.env.SMTP_USER || "noreply@gym-pos.com" };
    sendSmtpEmail.to = [{ email: email, name: name }];

    try {
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`[EmailService] Brevo SUCCESS for ${email} (MessageID: ${data.messageId})`);
    } catch (error) {
        console.error(`[EmailService] Brevo FAILED for ${email}:`, error.response?.body || error.message);
        throw new Error("Failed to send reset email via Brevo.");
    }
};

module.exports = { sendActivationEmail, sendPasswordResetEmail, sendEmailWebhook };
