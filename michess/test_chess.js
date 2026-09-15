import { Chess } from 'chess.js';

const game = new Chess();
try {
  const result = game.move({ from: 'e2', to: 'e4', promotion: 'q' });
  console.log('Success:', result);
} catch (e) {
  console.error('Error:', e.message);
}
