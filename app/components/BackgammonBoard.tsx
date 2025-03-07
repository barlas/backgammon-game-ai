'use client';

import { useEffect, useState } from 'react';
import { GameState, PieceColor, Point } from '../types/backgammon';
import { getPossibleMoves, makeMove, checkWinner } from '../utils/gameLogic';

const initialGameState: GameState = {
  points: Array.from({ length: 24 }, (_, i) => ({
    position: i + 1,
    pieces: i === 23 ? Array(2).fill('black')         // Point 24: 2 black
      : i === 12 ? Array(5).fill('black')         // Point 13: 5 black
      : i === 7 ? Array(3).fill('black')          // Point 8: 3 black
      : i === 5 ? Array(5).fill('black')          // Point 6: 5 black
      : i === 0 ? Array(2).fill('white')          // Point 1: 2 white
      : i === 11 ? Array(5).fill('white')         // Point 12: 5 white
      : i === 16 ? Array(3).fill('white')         // Point 17: 3 white
      : i === 18 ? Array(5).fill('white')         // Point 19: 5 white
      : []
  })),
  bar: { white: 0, black: 0 },
  home: { white: 0, black: 0 },
  currentPlayer: 'white',
  dice: { values: [], available: [] },
  selectedPoint: null,
  possibleMoves: [],
  gamePhase: 'rolling',
  winner: null,
};

export default function BackgammonBoard() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  const rollDice = () => {
    if (gameState.gamePhase !== 'rolling') return;
    
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const values = die1 === die2 ? [die1, die1, die1, die1] : [die1, die2];
    
    setGameState(prev => ({
      ...prev,
      dice: { values, available: [...values] },
      gamePhase: 'moving'
    }));
  };

  const handleBarClick = (color: PieceColor) => {
    if (gameState.gamePhase !== 'moving' || color !== gameState.currentPlayer) return;
    if (gameState.bar[color] === 0) return;

    const possibleMoves = getPossibleMoves(gameState, -1);
    setGameState(prev => ({
      ...prev,
      selectedPoint: -1,
      possibleMoves
    }));
  };

  const handlePointClick = (position: number) => {
    if (gameState.gamePhase !== 'moving') return;

    // If no point is selected, select this point if it has current player's pieces
    if (gameState.selectedPoint === null) {
      // If there are pieces on the bar, player must move those first
      if (gameState.bar[gameState.currentPlayer] > 0) {
        return;
      }

      const point = gameState.points[position - 1];
      if (point.pieces.length > 0 && point.pieces[0] === gameState.currentPlayer) {
        const possibleMoves = getPossibleMoves(gameState, position);
        setGameState(prev => ({
          ...prev,
          selectedPoint: position,
          possibleMoves
        }));
      }
      return;
    }

    // If a point is already selected, try to move to the clicked point
    if (gameState.possibleMoves.includes(position)) {
      const newState = makeMove(gameState, {
        from: gameState.selectedPoint,
        to: position,
        color: gameState.currentPlayer
      });

      // Check for winner
      const winner = checkWinner(newState);
      if (winner) {
        newState.winner = winner;
        newState.gamePhase = 'gameOver';
      }

      setGameState({
        ...newState,
        selectedPoint: null,
        possibleMoves: []
      });
    } else {
      // Deselect the current point
      setGameState(prev => ({
        ...prev,
        selectedPoint: null,
        possibleMoves: []
      }));
    }
  };

  const handleBearOffClick = (color: PieceColor) => {
    if (gameState.gamePhase !== 'moving' || color !== gameState.currentPlayer) return;
    if (gameState.selectedPoint === null) return;

    const bearOffPosition = color === 'white' ? 25 : 0;
    if (gameState.possibleMoves.includes(bearOffPosition)) {
      const newState = makeMove(gameState, {
        from: gameState.selectedPoint,
        to: bearOffPosition,
        color
      });

      // Check for winner
      const winner = checkWinner(newState);
      if (winner) {
        newState.winner = winner;
        newState.gamePhase = 'gameOver';
      }

      setGameState({
        ...newState,
        selectedPoint: null,
        possibleMoves: []
      });
    }
  };

  const renderPoint = (point: Point, index: number) => {
    const isTopHalf = index < 12;
    const isSelected = point.position === gameState.selectedPoint;
    const isPossibleMove = gameState.possibleMoves.includes(point.position);
    
    return (
      <div
        key={point.position}
        className={`relative w-16 h-48 ${
          index % 2 === 0 ? 'bg-amber-700' : 'bg-amber-900'
        } ${isSelected ? 'ring-2 ring-yellow-400' : ''} 
        ${isPossibleMove ? 'ring-2 ring-green-400' : ''}`}
        onClick={() => handlePointClick(point.position)}
      >
        {point.pieces.map((color, i) => (
          <div
            key={i}
            className={`absolute w-14 h-14 rounded-full border-2 ${
              color === 'white' ? 'bg-white' : 'bg-black'
            } ${color === 'white' ? 'border-gray-300' : 'border-gray-700'}`}
            style={{
              left: '4px',
              [isTopHalf ? 'top' : 'bottom']: `${i * 35}px`,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8">
      {gameState.winner ? (
        <div className="text-2xl font-bold text-green-600">
          {gameState.winner.charAt(0).toUpperCase() + gameState.winner.slice(1)} wins!
        </div>
      ) : (
        <div className="bg-amber-600 p-8 rounded-lg shadow-xl">
          <div className="flex gap-4">
            {/* Black's home */}
            <div 
              className="w-16 h-48 bg-amber-800 flex flex-col items-center justify-center"
              onClick={() => handleBearOffClick('black')}
            >
              <div className="text-white mb-2">Home</div>
              <div className="text-white text-2xl">{gameState.home.black}</div>
            </div>
            
            <div className="flex flex-col gap-4">
              {/* Top half (points 13-24) - Reversed for proper mirroring */}
              <div className="flex">
                {gameState.points.slice(12, 24).reverse().map((point, i) => renderPoint(point, 23 - i))}
              </div>
              
              <div className="h-16 bg-amber-800 flex justify-between px-4 items-center">
                <div className="flex gap-4">
                  {Object.entries(gameState.bar).map(([color, count]) => (
                    count > 0 && (
                      <div 
                        key={color} 
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => handleBarClick(color as PieceColor)}
                      >
                        <div className={`w-10 h-10 rounded-full ${
                          color === 'white' ? 'bg-white' : 'bg-black'
                        }`} />
                        <span className="text-white">x{count}</span>
                      </div>
                    )
                  ))}
                </div>
                <div className="flex gap-4">
                  {gameState.dice.values.map((value, i) => (
                    <div key={i} className="w-10 h-10 bg-white rounded flex items-center justify-center text-xl font-bold">
                      {value}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Bottom half (points 1-12) */}
              <div className="flex">
                {gameState.points.slice(0, 12).map((point, i) => renderPoint(point, i))}
              </div>
            </div>

            {/* White's home */}
            <div 
              className="w-16 h-48 bg-amber-800 flex flex-col items-center justify-center"
              onClick={() => handleBearOffClick('white')}
            >
              <div className="text-white mb-2">Home</div>
              <div className="text-white text-2xl">{gameState.home.white}</div>
            </div>
          </div>
        </div>
      )}
      
      {gameState.gamePhase === 'rolling' && !gameState.winner && (
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          onClick={rollDice}
        >
          Roll Dice
        </button>
      )}
      
      <div className="text-xl font-bold text-gray-800 dark:text-white">
        {gameState.winner ? (
          <button
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            onClick={() => setGameState(initialGameState)}
          >
            Play Again
          </button>
        ) : (
          `Current Player: ${gameState.currentPlayer.charAt(0).toUpperCase() + gameState.currentPlayer.slice(1)}`
        )}
      </div>
    </div>
  );
} 