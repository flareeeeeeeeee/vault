const fs = require('fs');
const path = require('path');

const assets = [
  { src: 'src/renderer/index.html', dest: 'dist/renderer/index.html' },
  { src: 'src/renderer/styles.css', dest: 'dist/renderer/styles.css' }
];

for (const { src, dest } of assets) {
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('Assets copied.');
