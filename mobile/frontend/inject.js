const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));
for (const file of files) {
    const filePath = path.join(__dirname, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('js/config.js') && content.includes('js/api.js')) {
        content = content.replace('<script src="js/api.js"></script>', '<script src="js/config.js"></script>\n    <script src="js/api.js"></script>');
        fs.writeFileSync(filePath, content);
    }
}
console.log('Done injecting config.js');
