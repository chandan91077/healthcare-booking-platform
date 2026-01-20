const fs = require('fs');
const path = require('path');

function renderTemplate(templatePath, context = {}) {
    let content = fs.readFileSync(templatePath, 'utf-8');
    
    // Handle {{#if variable}} ... {{/if}} conditionals
    content = content.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, innerContent) => {
        return context[variable] ? innerContent : '';
    });
    
    // Handle {{#each array}} ... {{/each}} loops
    content = content.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, variable, innerContent) => {
        const array = context[variable];
        if (!Array.isArray(array) || array.length === 0) return '';
        
        return array.map(item => {
            let itemContent = innerContent;
            // Replace {{this.property}} with actual values
            if (typeof item === 'object' && item !== null) {
                for (const key of Object.keys(item)) {
                    const re = new RegExp(`{{\\s*this\\.${key}\\s*}}`, 'g');
                    let value = item[key];
                    // Convert arrays and objects to strings or handle them gracefully
                    if (typeof value === 'object') {
                        value = JSON.stringify(value);
                    }
                    itemContent = itemContent.replace(re, String(value || ''));
                }
            } else {
                // If item is a primitive, replace {{this}} with the value
                itemContent = itemContent.replace(/{{this}}/g, String(item));
            }
            return itemContent;
        }).join('');
    });
    
    // Handle simple {{variable}} replacements
    for (const key of Object.keys(context)) {
        const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        const value = context[key];
        // Only replace if it's not an object or array (those are handled by #if and #each)
        if (typeof value !== 'object' || value === null) {
            content = content.replace(re, value || '');
        }
    }
    
    return content;
}

module.exports = { renderTemplate };
