// Email service:
// Sends transactional emails via SendGrid, Mailgun, or SMTP based on environment config.
const fs = require('fs');
const path = require('path');

function _errorMessage(err, fallback) {
    return err?.response?.body?.errors?.[0]?.message ||
        err?.response?.data?.message ||
        err?.message ||
        fallback;
}

// provider: sendgrid | mailgun | smtp
async function sendEmailDetailed({ to, subject, text, html }) {
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
            return { ok: true, provider: 'sendgrid' };
        } catch (err) {
            console.error('SendGrid send failed', err);
            return {
                ok: false,
                provider: 'sendgrid',
                reason: _errorMessage(err, 'SendGrid send failed'),
            };
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
            return { ok: true, provider: 'mailgun' };
        } catch (err) {
            console.error('Mailgun send failed', err);
            return {
                ok: false,
                provider: 'mailgun',
                reason: _errorMessage(err, 'Mailgun send failed'),
            };
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
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
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
            return { ok: true, provider: 'smtp' };
        } catch (err) {
            console.error('SMTP send failed', err);
            return {
                ok: false,
                provider: 'smtp',
                reason: _errorMessage(err, 'SMTP send failed'),
            };
        }
    }

    // No provider configured
    console.warn('No email provider configured or all providers failed');
    return {
        ok: false,
        provider: provider || 'none',
        reason: 'No email provider configured or all providers failed',
    };
}

async function sendEmail(payload) {
    const result = await sendEmailDetailed(payload);
    return result.ok;
}

module.exports = { sendEmail, sendEmailDetailed };
