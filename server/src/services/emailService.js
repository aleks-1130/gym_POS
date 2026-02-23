const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends an activation email to a newly registered member.
 * 
 * @param {string} email - Member's email
 * @param {string} name - Member's name
 * @param {string} token - Activation token
 */
const sendActivationEmail = async (email, name, token) => {
    // Determine frontend URL - falling back to localhost if not set
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/activate-account?token=${token}`;

    try {
        await resend.emails.send({
            from: 'FitOS Gym <onboarding@resend.dev>', // Note: In production, use your own domain
            to: email,
            subject: 'Activate Your Gym Member Account',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #333;">Welcome to the Gym, ${name}!</h2>
                    <p>Your membership has been registered at the front desk. To access your member portal and set your password, please click the button below:</p>
                    <a href="${activationLink}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Activate Account</a>
                    <p style="color: #666; font-size: 14px;">If you didn't expect this email, please ignore it.</p>
                </div>
            `
        });
        console.log(`[EmailService] Activation email sent to ${email}`);
    } catch (error) {
        console.error(`[EmailService] Failed to send email to ${email}:`, error.message);
        throw error;
    }
};

module.exports = { sendActivationEmail };
