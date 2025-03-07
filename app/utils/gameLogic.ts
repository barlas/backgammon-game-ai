import { GameState, Move, PieceColor } from '../types/backgammon';

const isInHomeBoard = (position: number, color: PieceColor): boolean => {
  return color === 'white' ? position >= 1 && position <= 6 : position >= 19 && position <= 24;
};

const canBearOff = (gameState: GameState, color: PieceColor): boolean => {
  // All pieces must be in the home board to bear off
  for (let i = 0; i < 24; i++) {
    const point = gameState.points[i];
    if (point.pieces.some(p => p === color)) {
      if (!isInHomeBoard(point.position, color)) {
        return false;
      }
    }
  }
  return gameState.bar[color] === 0;
};

export const isValidMove = (
  gameState: GameState,
  from: number,
  to: number,
  color: PieceColor
): boolean => {
  // Handle bar pieces
  if (gameState.bar[color] > 0) {
    if (from !== -1) {
      return false; // Must move from bar first
    }
    // For pieces entering from bar
    const entryPoint = color === 'white' ? 25 - to : to;
    if (entryPoint < 1 || entryPoint > 6) {
      return false;
    }
  }

  // Check if the destination point is valid
  if (to < 1 || to > 24) {
    // Check if trying to bear off
    if (to === 25 || to === 0) {
      if (!canBearOff(gameState, color)) {
        return false;
      }
      // When bearing off, must use exact number if possible
      const exactNumberNeeded = color === 'white' ? from : 25 - from;
      if (!gameState.dice.available.includes(exactNumberNeeded)) {
        // Can only use larger number if no piece is further from home
        const largerNumberAvailable = gameState.dice.available.find(d => d > exactNumberNeeded);
        if (!largerNumberAvailable) {
          return false;
        }
        // Check if any piece is further from home
        const furthestPiecePos = color === 'white' 
          ? Math.max(...gameState.points.map((p, i) => p.pieces.includes(color) ? i + 1 : 0))
          : Math.min(...gameState.points.map((p, i) => p.pieces.includes(color) ? i + 1 : 25));
        if ((color === 'white' && furthestPiecePos > from) || 
            (color === 'black' && furthestPiecePos < from)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  // Prevent backward moves
  if (from !== -1) { // Not moving from bar
    if (color === 'white' && to < from) {
      return false; // White must move towards point 24 (clockwise)
    }
    if (color === 'black' && to > from) {
      return false; // Black must move towards point 1 (counterclockwise)
    }
  }

  const toPoint = gameState.points[to - 1];
  if (toPoint.pieces.length > 1 && toPoint.pieces[0] !== color) {
    return false;
  }

  // Check if the move distance is available in dice
  const distance = Math.abs(color === 'white' 
    ? (from === -1 ? 25 - to : from - to)
    : (from === -1 ? to : to - from));
  
  return gameState.dice.available.includes(distance);
};

export const getPossibleMoves = (
  gameState: GameState,
  position: number
): number[] => {
  const color = gameState.currentPlayer;
  const possibleMoves: number[] = [];

  // If pieces are on the bar, only moves from the bar are allowed
  if (gameState.bar[color] > 0) {
    if (position !== -1) {
      return [];
    }
    // Check possible entry points
    const entryPoints = color === 'white' ? [19, 20, 21, 22, 23, 24] : [6, 5, 4, 3, 2, 1];
    entryPoints.forEach(point => {
      if (isValidMove(gameState, -1, point, color)) {
        possibleMoves.push(point);
      }
    });
    return possibleMoves;
  }

  // Check normal moves
  for (let i = 0; i < 24; i++) {
    const targetPosition = i + 1;
    if (isValidMove(gameState, position, targetPosition, color)) {
      possibleMoves.push(targetPosition);
    }
  }

  // Check bearing off
  if (canBearOff(gameState, color)) {
    const bearOffPosition = color === 'white' ? 0 : 25;
    if (isValidMove(gameState, position, bearOffPosition, color)) {
      possibleMoves.push(bearOffPosition);
    }
  }

  return possibleMoves;
};

export const makeMove = (
  gameState: GameState,
  move: Move
): GameState => {
  const newState = { ...gameState };
  const { from, to, color } = move;

  // Remove piece from source
  if (from === -1) {
    newState.bar[color]--;
  } else {
    const fromPoint = newState.points[from - 1];
    fromPoint.pieces.pop();
  }

  // Handle bearing off
  if (to === 0 || to === 25) {
    newState.home[color]++;
  } else {
    // Add piece to destination
    const toPoint = newState.points[to - 1];
    if (toPoint.pieces.length === 1 && toPoint.pieces[0] !== color) {
      // Hit opponent's blot
      const oppositeColor = color === 'white' ? 'black' : 'white';
      toPoint.pieces = [];
      newState.bar[oppositeColor]++;
    }
    toPoint.pieces.push(color);
  }

  // Remove used die
  const distance = Math.abs(color === 'white' 
    ? (from === -1 ? 25 - to : from - to)
    : (from === -1 ? to : to - from));
  const dieIndex = newState.dice.available.indexOf(distance);
  newState.dice.available.splice(dieIndex, 1);

  // Check if turn is over
  if (newState.dice.available.length === 0) {
    newState.currentPlayer = color === 'white' ? 'black' : 'white';
    newState.gamePhase = 'rolling';
  }

  return newState;
};

export const checkWinner = (gameState: GameState): PieceColor | null => {
  // Check if all pieces are in home
  if (gameState.home.white === 15) return 'white';
  if (gameState.home.black === 15) return 'black';
  return null;
}; 