const fs = require('fs');

const formatMovesToPGN = (moves) => {
  let pgn = '';
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      if (i > 0) pgn += ' ';
      pgn += `${Math.floor(i / 2) + 1}. ${moves[i]}`;
    } else {
      pgn += ` ${moves[i]}`;
    }
  }
  return pgn;
};

const findOpening = (moves, db) => {
  let longestMatch = null;
  let matchLength = 0;

  const maxSearchDepth = Math.min(moves.length, 30);
  
  for (let i = 1; i <= maxSearchDepth; i++) {
    const sequence = formatMovesToPGN(moves.slice(0, i));
    if (db[sequence]) {
      longestMatch = db[sequence];
      matchLength = i;
    }
  }

  return { opening: longestMatch, matchLength };
};

const db = JSON.parse(fs.readFileSync('public/openings.json', 'utf8'));
console.log(findOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], db));
