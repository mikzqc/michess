

export const BOARD_THEMES = {
  slate: {
    dark: '#475569',
    light: '#cbd5e1'
  },
  purple: {
    dark: '#6366f1',
    light: '#e0e7ff'
  },
  wood: {
    dark: '#b58863',
    light: '#f0d9b5'
  },
  green: {
    dark: '#779556',
    light: '#ebecd0'
  },
  darkKnight: {
    dark: '#2b2b2b',
    light: '#7a7a7a'
  }
};

const PIECES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];

export function getCustomPieces(pieceSet: 'default' | 'alpha' | 'merida') {
  const fetchSet = pieceSet === 'default' ? 'cburnett' : pieceSet;
  
  const pieceComponents: Record<string, (props: any) => any> = {};
  
  PIECES.forEach((piece) => {
    pieceComponents[piece] = ({ squareWidth }: { squareWidth?: number }) => (
      <img
        src={`https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${fetchSet}/${piece}.svg`}
        style={{
          width: squareWidth || '100%',
          height: squareWidth || '100%',
          pointerEvents: 'none'
        }}
        alt={piece}
      />
    );
  });
  
  return pieceComponents;
}
