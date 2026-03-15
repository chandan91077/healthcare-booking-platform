// Email template utilities:
// Resolve localized template files and provide fallback-safe rendered email content.
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('./renderTemplate');

// Resolve a template pair (.txt + .html) by locale.
// If requested locale is missing, fallback to English templates.
function renderEmailTemplates({ locale = 'en', templateName, context = {} }) {
    const normalizedLocale =
        typeof locale === 'string' && locale.trim() ? locale.trim() : 'en';
    const localesToTry = [normalizedLocale, 'en'];

    let text = null;
    let html = null;

    for (const targetLocale of localesToTry) {
        const basePath = path.join(
            __dirname,
            '..',
            'email',
            'templates',
            targetLocale,
            templateName
        );

        const textPath = `${basePath}.txt`;
        const htmlPath = `${basePath}.html`;

        if (text === null && fs.existsSync(textPath)) {
            text = renderTemplate(textPath, context);
        }

        if (html === null && fs.existsSync(htmlPath)) {
            html = renderTemplate(htmlPath, context);
        }

        if (text !== null && html !== null) {
            break;
        }
    }

    return { text, html };
}

// Public helper used by routes/controllers:
// 1) Try file templates first
// 2) Fallback to a minimal generic message if template is unavailable
function renderEmailWithFallback({
    locale = 'en',
    templateName,
    context = {},
    fallbackText = 'Please check your latest update in MediConnect.',
    fallbackHtml = '<p>Please check your latest update in MediConnect.</p>',
}) {
    const rendered = renderEmailTemplates({ locale, templateName, context });

    const resolvedText = rendered.text ||
        (typeof fallbackText === 'function' ? fallbackText(context) : fallbackText);
    const resolvedHtml = rendered.html ||
        (typeof fallbackHtml === 'function' ? fallbackHtml(context) : fallbackHtml);

    return {
        text: resolvedText,
        html: resolvedHtml,
    };
}

module.exports = { renderEmailTemplates, renderEmailWithFallback };
