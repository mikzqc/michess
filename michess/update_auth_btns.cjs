const fs = require('fs');

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldDivider = '<div className="ml-1 sm:ml-2 pl-3 sm:pl-6 border-l border-border-1 shrink-0">';
const newDivider = '<div className={`ml-1 sm:ml-2 pl-3 sm:pl-6 border-l shrink-0 ${view === \'404\' ? \'border-red-900/30\' : \'border-border-1\'}`}>';

content = content.replace(oldDivider, newDivider);

const oldProfileBtn = `className={\`px-4 py-2 rounded-lg border transition-colors font-bold text-sm active:scale-95 flex items-center justify-center min-w-[80px] min-h-[38px] \${view === 'profile' ? 'bg-accent border-accent text-white' : 'bg-surface-3 border-border-2 hover:bg-border-1 text-content-1'}\`}`;
const newProfileBtn = `className={\`px-4 py-2 rounded-lg border transition-colors font-bold text-sm active:scale-95 flex items-center justify-center min-w-[80px] min-h-[38px] \${view === '404' ? 'bg-red-950/20 border-red-900/30 text-red-700 hover:text-red-500 hover:bg-red-900/40' : (view === 'profile' ? 'bg-accent border-accent text-white' : 'bg-surface-3 border-border-2 hover:bg-border-1 text-content-1')}\`}`;

content = content.replace(oldProfileBtn, newProfileBtn);

const oldLoginBtn = `className="bg-accent hover:bg-accent-light text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors active:scale-95"`;
const newLoginBtn = `className={\`px-5 py-2 rounded-lg font-bold text-sm transition-colors active:scale-95 \${view === '404' ? 'bg-red-950/20 text-red-700 hover:text-red-500 hover:bg-red-900/40 border border-red-900/30' : 'bg-accent hover:bg-accent-light text-white'}\`}`;

content = content.replace(oldLoginBtn, newLoginBtn);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
