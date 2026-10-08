const fs = require('fs');

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const helperStr = `
  const getNavBtnClass = (isActive) => {
    const base = 'transition-colors font-semibold flex items-center gap-2 text-[15px] active:scale-95 px-3 py-2 rounded-lg';
    if (view === '404') {
      return \`\${base} text-red-900 hover:text-red-500 hover:bg-red-950/30\`;
    }
    return \`\${base} \${isActive ? 'text-accent bg-accent/10' : 'text-content-2 hover:text-content-1 hover:bg-surface-3'}\`;
  };

  return (
    <div className="min-h-screen flex flex-col">
`;

content = content.replace('  return (\n    <div className="min-h-screen flex flex-col">', helperStr);

// Replace button classes
content = content.replace(/className=\{`transition-colors font-semibold flex items-center gap-2 text-\[15px\] active:scale-95 px-3 py-2 rounded-lg \$\{view === '([^']+)' \? 'text-accent bg-accent\/10' : 'text-content-2 hover:text-content-1 hover:bg-surface-3'\}`\}/g, "className={getNavBtnClass(view === '$1')}");

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
