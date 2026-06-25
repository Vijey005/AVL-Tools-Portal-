const fs = require('fs');
const path = 'c:/Users/Vijey/Documents/AVL Projects/AVL tools/frontend/src/app/pages/lmm-planner/lmm-planner.component.html';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\(\\.target\s+as\s+[a-zA-Z]+\)\.(value|checked)/g, '$any($event.target).');
fs.writeFileSync(path, content, 'utf8');
console.log('Regex matched any type assertions and replaced them.');
