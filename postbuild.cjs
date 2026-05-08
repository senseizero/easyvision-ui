// postbuild.cjs
// Renames hashed CSS files to stable names after tsup build
const fs = require('fs');
const path = require('path');
const dist = path.resolve(__dirname, 'dist');
if (fs.existsSync(dist)) {
  const cssFiles = fs.readdirSync(dist).filter(f => f.endsWith('.css'));
  let easyvisionCss = null;
  let tableCss = null;
  cssFiles.forEach(f => {
    if (f.startsWith('easyvision-')) {
      fs.renameSync(path.join(dist, f), path.join(dist, 'easyvision.css'));
      easyvisionCss = f;
    }
    if (f.startsWith('EasyVisionTable-')) {
      fs.renameSync(path.join(dist, f), path.join(dist, 'EasyVisionTable.css'));
      tableCss = f;
    }
  });

  // Patch import statements in dist/index.js and dist/index.cjs
  ['index.js', 'index.cjs'].forEach(jsFile => {
    const jsPath = path.join(dist, jsFile);
    if (fs.existsSync(jsPath)) {
      let content = fs.readFileSync(jsPath, 'utf8');
      if (easyvisionCss) content = content.replace(new RegExp(`\\./${easyvisionCss.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")}`), './easyvision.css');
      if (tableCss) content = content.replace(new RegExp(`\\./${tableCss.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")}`), './EasyVisionTable.css');
      fs.writeFileSync(jsPath, content, 'utf8');
    }
  });
}
