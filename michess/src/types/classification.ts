export type MoveClassificationType = 
  | 'brilliant' 
  | 'great' 
  | 'best' 
  | 'excellent' 
  | 'good' 
  | 'book' 
  | 'inaccuracy' 
  | 'mistake' 
  | 'miss' 
  | 'blunder' 
  | 'unclassified';

export interface MoveClassification {
  id: MoveClassificationType;
  name: string;
  symbol: string;
  colorClass: string;
}

export const CLASSIFICATIONS: Record<MoveClassificationType, MoveClassification> = {
  brilliant: { id: 'brilliant', name: 'Brilliant', symbol: '!!', colorClass: 'bg-teal-500 text-white' },
  great: { id: 'great', name: 'Great Move', symbol: '!', colorClass: 'bg-blue-500 text-white' },
  best: { id: 'best', name: 'Best Move', symbol: '★', colorClass: 'bg-green-500 text-white' },
  excellent: { id: 'excellent', name: 'Excellent', symbol: '👍', colorClass: 'bg-lime-500 text-white' },
  good: { id: 'good', name: 'Good', symbol: '✓', colorClass: 'bg-emerald-600 text-white' },
  book: { id: 'book', name: 'Book', symbol: '📖', colorClass: 'bg-amber-700 text-white' },
  inaccuracy: { id: 'inaccuracy', name: 'Inaccuracy', symbol: '?!', colorClass: 'bg-yellow-500 text-white' },
  mistake: { id: 'mistake', name: 'Mistake', symbol: '?', colorClass: 'bg-orange-500 text-white' },
  miss: { id: 'miss', name: 'Miss', symbol: 'X', colorClass: 'bg-red-400 text-white' },
  blunder: { id: 'blunder', name: 'Blunder', symbol: '??', colorClass: 'bg-red-600 text-white' },
  unclassified: { id: 'unclassified', name: 'Unclassified', symbol: '', colorClass: 'bg-gray-500 text-transparent' }
};
