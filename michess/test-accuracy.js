import { calculateAccuracy } from './src/utils/accuracy.ts';

const runTest = (name, b, a, c, checkmate, book, expected) => {
  const acc = calculateAccuracy(b, a, c, checkmate, book);
  console.log(`[${name}] => ${acc.toFixed(1)}% | Expected: ${expected}`);
}

const cp = (val) => ({ score: { type: 'cp', value: val } });
const mate = (val) => ({ score: { type: 'mate', value: val } });

// Test A — Zero loss (evalLoss = 0)
// White plays a move, eval stays at +50
runTest('Test A - Zero loss', cp(50), cp(50), 'w', false, false, '100.0');

// Test B — Small loss (evalLoss = 10 cp)
runTest('Test B - Small loss', cp(50), cp(40), 'w', false, false, '> 95.0');

// Test C — Large loss (evalLoss = 300 cp in equal pos)
runTest('Test C - Large loss', cp(0), cp(-300), 'w', false, false, '< 80.0');

// Test D — White perspective (eval drops from +100 to -100)
runTest('Test D - White blunders', cp(100), cp(-100), 'w', false, false, 'low');

// Test E — Black perspective (eval rises from +100 to +300 -> bad for black)
runTest('Test E - Black blunders', cp(100), cp(300), 'b', false, false, 'low');

// Test F — Black improvement (eval goes from +300 to +100 -> good for black)
runTest('Test F - Black improves', cp(300), cp(100), 'b', false, false, '100.0');

// Test G — Genuine Black blunder (eval goes from 0 to +500)
runTest('Test G - Black huge blunder', cp(0), cp(500), 'b', false, false, 'low');

// Test H — Mate (player delivers mate)
runTest('Test H - Player delivers mate (w)', cp(900), mate(1), 'w', true, false, '100.0');
runTest('Test H - Player delivers mate (b)', cp(-900), mate(-1), 'b', true, false, '100.0');

// Test H — Mate (player allows mate)
runTest('Test H - Player allows mate (w)', cp(0), mate(-1), 'w', false, false, '< 10.0');

// Test J — Book
runTest('Test J - Book move (terrible eval loss but book)', cp(0), cp(-500), 'w', false, true, '100.0');

