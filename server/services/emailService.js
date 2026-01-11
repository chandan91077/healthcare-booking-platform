const fs = require('fs');
const path = require('path');

// provider: sendgrid | mailgun | smtp
async function sendEmail({ to, subject, text, html }) {
    const provider = process.env.EMAIL_PROVIDER || '';

    if (provider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            const msg = {
                to,
                from: process.env.EMAIL_FROM,
                subject,
                text,
                html,
            };
            await sgMail.send(msg);
            return true;
        } catch (err) {
            console.error('SendGrid send failed', err);
            // fallthrough to try other providers
        }
    }

    if (provider === 'mailgun' && process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
        try {
            const formData = require('form-data');
            const Mailgun = require('mailgun.js');
            const mailgun = new Mailgun(formData);
            const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });
            await mg.messages.create(process.env.MAILGUN_DOMAIN, {
                from: process.env.EMAIL_FROM,
                to,
                subject,
                text,
                html,
            });
            return true;
        } catch (err) {
            console.error('Mailgun send failed', err);
        }
    }

    // Fallback to SMTP (nodemailer)
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to,
                subject,
                text,
                html,
            });
            return true;
        } catch (err) {
            console.error('SMTP send failed', err);
        }
    }

    // No provider configured
    console.warn('No email provider configured or all providers failed');
    return false;
}

module.exports = { sendEmail };
