// postbuild.cjs
// Renames hashed CSS files to stable names after tsup build
const fs = require('fs');
const path = require('path');
const dist = path.resolve(__dirname, 'dist');
if (fs.existsSync(dist)) {
  const cssFiles = fs.readdirSync(dist).filter(f => f.endsWith('.css'));
  cssFiles.forEach(f => {
    if (f.startsWith('easyvision-')) fs.renameSync(path.join(dist, f), path.join(dist, 'easyvision.css'));
    if (f.startsWith('EasyVisionTable-')) fs.renameSync(path.join(dist, f), path.join(dist, 'EasyVisionTable.css'));
  });
}
