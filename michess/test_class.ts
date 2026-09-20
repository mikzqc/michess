import { classifyMove } from './src/utils/classification';
import { Chess } from 'chess.js';

// Let's create an AnalyzedMove that simulates Qf5+
// Initial position before Qf5+: White Queen on some square, let's say d3.
// Wait, in the image, the White Queen moves TO f5.
// We just need a dummy fen that allows a Queen sacrifice.
const fenBefore = '2r2rk1/pp3p1p/2n3p1/3p2qk/4p3/2P3P1/PP3P1P/3R1RK1 w - - 0 1';
// Wait, the FEN doesn't matter for the *structure* of the move, but it matters for `chess.js` which needs legal moves!
// If I use a random FEN, chess.js will throw an error on illegal moves.
