export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface SquareInfo {
  type: PieceSymbol;
  color: Color;
}

export function fenToArray(fen: string): (SquareInfo | null)[][] {
  const [boardPart] = fen.split(' ');
  const rows = boardPart.split('/');
  const board: (SquareInfo | null)[][] = [];

  for (const row of rows) {
    const boardRow: (SquareInfo | null)[] = [];
    for (const char of row) {
      if (/[1-8]/.test(char)) {
        const spaces = parseInt(char, 10);
        for (let i = 0; i < spaces; i++) boardRow.push(null);
      } else {
        const color = char === char.toLowerCase() ? 'b' : 'w';
        boardRow.push({ type: char.toLowerCase() as PieceSymbol, color });
      }
    }
    board.push(boardRow);
  }
  return board;
}

export function arrayToFen(board: (SquareInfo | null)[][], turn: string = 'w', castling: string = '-', enPassant: string = '-', halfMove: number = 0, fullMove: number = 1): string {
  const rows: string[] = [];
  
  for (const row of board) {
    let emptyCount = 0;
    let rowStr = '';
    for (const square of row) {
      if (square === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        const char = square.color === 'w' ? square.type.toUpperCase() : square.type.toLowerCase();
        rowStr += char;
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }

  return `${rows.join('/')} ${turn} ${castling} ${enPassant} ${halfMove} ${fullMove}`;
}

export function squareToIndex(square: string): { row: number, col: number } {
  const col = square.charCodeAt(0) - 97; // 'a' = 97
  const row = 8 - parseInt(square[1], 10);
  return { row, col };
}

export function moveInFen(fen: string, from: string, to: string): string {
  const board = fenToArray(fen);
  const fromIdx = squareToIndex(from);
  const toIdx = squareToIndex(to);
  
  const piece = board[fromIdx.row][fromIdx.col];
  board[fromIdx.row][fromIdx.col] = null;
  board[toIdx.row][toIdx.col] = piece;
  
  const parts = fen.split(' ');
  return arrayToFen(board, parts[1] === 'w' ? 'b' : 'w', parts[2], parts[3], 0, parseInt(parts[5] || '1', 10) + (parts[1] === 'b' ? 1 : 0));
}

export function putInFen(fen: string, square: string, type: PieceSymbol, color: Color): string {
  const board = fenToArray(fen);
  const idx = squareToIndex(square);
  board[idx.row][idx.col] = { type, color };
  const parts = fen.split(' ');
  return arrayToFen(board, parts[1], parts[2], parts[3], parseInt(parts[4]||'0',10), parseInt(parts[5]||'1',10));
}

export function removeInFen(fen: string, square: string): string {
  const board = fenToArray(fen);
  const idx = squareToIndex(square);
  board[idx.row][idx.col] = null;
  const parts = fen.split(' ');
  return arrayToFen(board, parts[1], parts[2], parts[3], parseInt(parts[4]||'0',10), parseInt(parts[5]||'1',10));
}

export function switchTurnInFen(fen: string): string {
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  return parts.join(' ');
}
