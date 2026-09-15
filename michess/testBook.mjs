import { Chess } from 'chess.js';  
const game = new Chess();  
game.move('e4');  
console.log(game.fen());  
