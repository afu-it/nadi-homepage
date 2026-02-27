const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const parts = code.split('if (/^d{3,4}$/.test(trimmed)) return trimmed;');
if (parts.length > 1) {
  code = parts.join('if (/^\\d{3,4}$/.test(trimmed)) return trimmed;');
  fs.writeFileSync('js/app.js', code);
  console.log('Replaced successfully');
}
