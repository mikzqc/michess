

export const BOARD_THEMES: Record<string, { dark: string, light: string }> = {
  slate: { dark: '#475569', light: '#cbd5e1' },
  purple: { dark: '#6366f1', light: '#e0e7ff' },
  wood: { dark: '#b58863', light: '#f0d9b5' },
  green: { dark: '#779556', light: '#ebecd0' },
  darkKnight: { dark: '#2b2b2b', light: '#7a7a7a' },
  blue: { dark: '#4B7399', light: '#EAE9D2' },
  walnut: { dark: '#5C4033', light: '#987654' },
  mint: { dark: '#6D9E71', light: '#C4DEC7' },
  icy: { dark: '#7395AE', light: '#B1D4E0' },
  cherry: { dark: '#9E5B5B', light: '#E8C5C5' },
  lavender: { dark: '#7D7098', light: '#C9C2DB' },
  monochrome: { dark: '#555555', light: '#EEEEEE' },
  neon: { dark: '#1D1D2B', light: '#4FE0B6' },
  sand: { dark: '#C8A97E', light: '#EBE0CB' },
  coral: { dark: '#C76A6A', light: '#F0D0D0' }
};

const PIECES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];

export function getCustomPieces(pieceSet: string) {
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
