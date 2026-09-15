import { Chess } from 'chess.js'; const g = new Chess(); const moves = ['e4', 'd5', 'Nf3', 'e6', 'Nh4', 'dxe4', 'Qg4', 'Nc6', 'Nf5']; for (const m of moves) g.move(m); console.log(g.fen());  
