const fs = require('fs');
const path = require('path');

function renderTemplate(templatePath, context = {}) {
    let content = fs.readFileSync(templatePath, 'utf-8');
    for (const key of Object.keys(context)) {
        const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        content = content.replace(re, context[key]);
    }
    return content;
}

module.exports = { renderTemplate };
