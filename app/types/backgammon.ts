export type PieceColor = 'white' | 'black';

export type Point = {
  position: number;  // 1-24
  pieces: PieceColor[];
};

export type Bar = {
  white: number;
  black: number;
};

export type Home = {
  white: number;
  black: number;
};

export type Dice = {
  values: number[];
  available: number[];
};

export type GameState = {
  points: Point[];
  bar: Bar;
  home: Home;
  currentPlayer: PieceColor;
  dice: Dice;
  selectedPoint: number | null;
  possibleMoves: number[];
  gamePhase: 'rolling' | 'moving' | 'gameOver';
  winner: PieceColor | null;
};

export type Move = {
  from: number;
  to: number;
  color: PieceColor;
}; 