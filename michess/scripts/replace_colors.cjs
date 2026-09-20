const fs = require('fs');
const path = require('path');

const files = [
  'src/components/ReviewArea.tsx',
  'src/components/ReviewStats.tsx',
  'src/components/SocialArea.tsx',
  'src/components/ImportGame.tsx'
];

const colorMap = {
  'bg-slate-900/50': 'bg-surface-1/50',
  'bg-slate-900': 'bg-surface-1',
  'bg-slate-800/80': 'bg-surface-2',
  'bg-slate-800/50': 'bg-surface-2/50',
  'bg-slate-800': 'bg-surface-2',
  'bg-slate-700': 'bg-surface-3',
  'bg-slate-600': 'bg-surface-3',
  
  'border-slate-700/50': 'border-border-1/50',
  'border-slate-700': 'border-border-1',
  'border-slate-600': 'border-border-2',
  
  'text-slate-300': 'text-content-2',
  'text-slate-400': 'text-content-3',
  'text-slate-500': 'text-content-3',
  'text-white': 'text-content-1',
  'text-gray-300': 'text-content-2',
  
  'bg-chess-panel': 'bg-surface-2',
  'border-chess-border': 'border-border-1',
  'text-chess-accent': 'text-accent',
  'border-chess-accent': 'border-accent',
  'bg-chess-accent': 'bg-accent',
  'bg-chess-accent/5': 'bg-accent/5',
  'bg-chess-accent/20': 'bg-accent/20',
  
  'hover:bg-slate-800': 'hover:bg-surface-2',
  'hover:bg-slate-700': 'hover:bg-surface-3',
  'hover:bg-slate-600': 'hover:bg-surface-3',
  'hover:bg-indigo-500': 'hover:bg-accent-hover',
  'hover:text-white': 'hover:text-content-1',
  'hover:text-indigo-400': 'hover:text-accent',
  
  'bg-red-900/20': 'bg-error/10',
  'bg-red-900/30': 'bg-error/10',
  'bg-red-900/50': 'bg-error/20',
  'text-red-400': 'text-error',
  'border-red-900/50': 'border-error/50',
  
  'bg-emerald-900/20': 'bg-success/10',
  'bg-emerald-900/30': 'bg-success/10',
  'text-emerald-400': 'text-success',
  
  'bg-yellow-400': 'bg-warning',
  'text-yellow-400': 'text-warning',
  
  'text-amber-400': 'text-warning',
  'bg-amber-900/40': 'bg-warning/20',
  'border-amber-500/50': 'border-warning/50'
};

files.forEach(file => {
  const p = path.join(__dirname, '..', file);
  if (!fs.existsSync(p)) return;
  
  let content = fs.readFileSync(p, 'utf8');
  
  // Basic string replacement loop
  Object.keys(colorMap).forEach(key => {
    // We use a regex to ensure we match whole class names where possible, 
    // but a global replace is fine for tailwind classes if we order correctly.
    // Wait, simple replace is safer. We'll do simple global replace.
  });
  
  // Actually, let's use a regex with word boundaries to avoid partial matches
  // Sort keys by length descending to replace longer strings first
  const sortedKeys = Object.keys(colorMap).sort((a, b) => b.length - a.length);
  
  sortedKeys.forEach(key => {
    // Escape special characters in key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Regex for class name boundary (space, quote, or end)
    const regex = new RegExp(`(?<=[\\s"'\\\`])${escapedKey}(?=[\\s"'\\\`])`, 'g');
    content = content.replace(regex, colorMap[key]);
  });
  
  fs.writeFileSync(p, content, 'utf8');
  console.log(`Updated ${file}`);
});
