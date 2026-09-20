export interface PuzzleData {
  id: string;
  fen: string;
  moves: string[]; // Array of UCI moves (e.g. ['e2e4', 'e7e5'])
  rating: number;
}
