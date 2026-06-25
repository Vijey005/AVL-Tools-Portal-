const fs = require('fs');
const path = 'c:/Users/Vijey/Documents/AVL Projects/AVL tools/frontend/src/app/pages/lmm-planner/lmm-planner.component.html';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\(\\.target as HTMLInputElement\)\.value/g, '$any($event.target).value');
content = content.replace(/\(\\.target as HTMLInputElement\)\.checked/g, '$any($event.target).checked');
content = content.replace(/\(\\.target as HTMLSelectElement\)\.value/g, '$any($event.target).value');
content = content.replace(/\(\\.target as HTMLTextAreaElement\)\.value/g, '$any($event.target).value');
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed types in HTML');
