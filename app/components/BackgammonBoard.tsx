'use client';

import { useEffect, useState } from 'react';
import { GameState, PieceColor, Point } from '../types/backgammon';
import { getPossibleMoves, makeMove, checkWinner, isValidMove } from '../utils/gameLogic';

const initialGameState: GameState = {
  points: Array.from({ length: 24 }, (_, i) => ({
    position: i + 1,
    pieces: i === 5 ? Array(5).fill('black')          // Point 6: 5 black (bottom left)
      : i === 7 ? Array(3).fill('black')          // Point 8: 3 black (bottom left)
      : i === 12 ? Array(5).fill('black')         // Point 13: 5 black (top left)
      : i === 23 ? Array(2).fill('black')         // Point 24: 2 black (top right)
      : i === 0 ? Array(2).fill('white')          // Point 1: 2 white (bottom right)
      : i === 11 ? Array(5).fill('white')         // Point 12: 5 white (bottom right)
      : i === 16 ? Array(3).fill('white')         // Point 17: 3 white (top right)
      : i === 18 ? Array(5).fill('white')         // Point 19: 5 white (top right)
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
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<GameState[]>([initialGameState]);

  // Trigger AI move when it's black's turn
  useEffect(() => {
    const triggerAIMove = async () => {
      if (gameState.currentPlayer === 'black' && 
          gameState.gamePhase === 'rolling' && 
          !gameState.winner && 
          !isAIThinking) {
        // AI rolls dice
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const values = die1 === die2 ? [die1, die1, die1, die1] : [die1, die2];
        
        setGameState(prev => ({
          ...prev,
          dice: { values, available: [...values] },
          gamePhase: 'moving'
        }));
      } else if (gameState.currentPlayer === 'black' && 
                 gameState.gamePhase === 'moving' && 
                 !gameState.winner && 
                 !isAIThinking) {
        await handleAIMove();
      }
    };

    triggerAIMove();
  }, [gameState.currentPlayer, gameState.gamePhase, gameState.winner, isAIThinking]);

  // Add new useEffect to check for no valid moves
  useEffect(() => {
    if (gameState.gamePhase === 'moving' && !gameState.winner) {
      // Check if there are any valid moves available for any of the current dice
      let hasValidMovesForAnyDie = false;
      const availableDice = [...gameState.dice.available];
      
      // Check moves from bar first
      if (gameState.bar[gameState.currentPlayer] > 0) {
        for (const die of availableDice) {
          const targetPoint = gameState.currentPlayer === 'white' ? die : 25 - die;
          if (isValidMove(gameState, -1, targetPoint, gameState.currentPlayer)) {
            hasValidMovesForAnyDie = true;
            break;
          }
        }
      } else {
        // Check moves from each point for each die
        for (const die of availableDice) {
          for (let i = 0; i < 24; i++) {
            const point = gameState.points[i];
            if (point.pieces.some(p => p === gameState.currentPlayer)) {
              const targetPoint = gameState.currentPlayer === 'white' 
                ? i + 1 + die 
                : i + 1 - die;
              if (targetPoint >= 1 && targetPoint <= 24 && 
                  isValidMove(gameState, i + 1, targetPoint, gameState.currentPlayer)) {
                hasValidMovesForAnyDie = true;
                break;
              }
            }
          }
          if (hasValidMovesForAnyDie) break;
        }
      }

      // If no valid moves are available, switch to the other player
      if (!hasValidMovesForAnyDie && gameState.dice.available.length > 0) {
        setGameState(prev => ({
          ...prev,
          currentPlayer: prev.currentPlayer === 'white' ? 'black' : 'white',
          gamePhase: 'rolling',
          dice: { values: [], available: [] }
        }));
      }
    }
  }, [gameState.dice.available, gameState.currentPlayer, gameState.gamePhase, gameState.winner]);

  const handleAIMove = async () => {
    setIsAIThinking(true);

    // Collect all possible moves for the AI
    const availableMoves: Record<string, number[]> = {};  // Changed type to use string keys
    
    // Check moves from bar first
    if (gameState.bar.black > 0) {
      const moves = getPossibleMoves(gameState, -1);
      if (moves.length > 0) {
        availableMoves['-1'] = moves;  // Use string key
      }
    } else {
      // Check moves from each point
      for (let i = 0; i < 24; i++) {
        const point = gameState.points[i];
        if (point.pieces.some(p => p === 'black')) {
          const moves = getPossibleMoves(gameState, i + 1);
          if (moves.length > 0) {
            availableMoves[(i + 1).toString()] = moves;  // Convert to string key
          }
        }
      }
    }

    // If no moves are available, skip turn
    if (Object.keys(availableMoves).length === 0) {
      setGameState(prev => ({
        ...prev,
        currentPlayer: 'white',
        gamePhase: 'rolling'
      }));
      setIsAIThinking(false);
      return;
    }

    try {
      const response = await fetch('/api/ai-move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameState,
          availableMoves,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI move');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Execute the AI's move
      const newState = makeMove(gameState, {
        from: data.move.from,
        to: data.move.to,
        color: 'black'
      });

      // Check for winner
      const winner = checkWinner(newState);
      if (winner) {
        newState.winner = winner;
        newState.gamePhase = 'gameOver';
      }

      // If there are still dice available, keep the same phase
      // Otherwise, switch to white's turn
      if (newState.dice.available.length === 0) {
        newState.currentPlayer = 'white';
        newState.gamePhase = 'rolling';
      }

      setGameState(newState);
    } catch (error) {
      console.error('Error getting AI move:', error);
      // On error, skip AI's turn
      setGameState(prev => ({
        ...prev,
        currentPlayer: 'white',
        gamePhase: 'rolling'
      }));
    } finally {
      setIsAIThinking(false);
    }
  };

  const rollDice = () => {
    if (gameState.gamePhase !== 'rolling') return;
    
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const values = die1 === die2 ? [die1, die1, die1, die1] : [die1, die2];
    
    const newState: GameState = {
      ...gameState,
      dice: { values, available: [...values] },
      gamePhase: 'moving' as const
    };

    // Create deep copy for history
    const historyState = JSON.parse(JSON.stringify(newState)) as GameState;
    
    setGameState(newState);
    setMoveHistory([historyState]); // Reset move history when rolling new dice
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

  // Function to check if both dice can be used together
  const canUseBothDice = (state: GameState): boolean => {
    const originalDice = [...state.dice.available];
    if (originalDice.length < 2) return false;

    // Try each possible first move
    for (let i = 0; i < 24; i++) {
      const point = state.points[i];
      if (point.pieces.some(p => p === state.currentPlayer)) {
        for (const die of originalDice) {
          const firstMoveTo = state.currentPlayer === 'white' ? i + 1 + die : i + 1 - die;
          if (firstMoveTo >= 1 && firstMoveTo <= 24 && isValidMove(state, i + 1, firstMoveTo, state.currentPlayer)) {
            // Try the move
            const afterFirstMove = makeMove(state, {
              from: i + 1,
              to: firstMoveTo,
              color: state.currentPlayer
            });
            
            // Check if second die can be used
            const remainingDie = originalDice.find(d => d !== die);
            if (remainingDie) {
              for (let j = 0; j < 24; j++) {
                const point2 = afterFirstMove.points[j];
                if (point2.pieces.some(p => p === state.currentPlayer)) {
                  const secondMoveTo = state.currentPlayer === 'white' ? j + 1 + remainingDie : j + 1 - remainingDie;
                  if (secondMoveTo >= 1 && secondMoveTo <= 24 && 
                      isValidMove(afterFirstMove, j + 1, secondMoveTo, state.currentPlayer)) {
                    return true;
                  }
                }
              }
            }
          }
        }
      }
    }
    return false;
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
      // Only check for forced moves if we have exactly two different dice values
      const diceValues = new Set(gameState.dice.available);
      const hasTwoDifferentDice = diceValues.size === 2;
      
      const newState = makeMove(gameState, {
        from: gameState.selectedPoint,
        to: position,
        color: gameState.currentPlayer
      });

      // Only check for forced moves with two different dice
      if (hasTwoDifferentDice) {
        const couldUseBothDice = canUseBothDice(gameState);
        if (couldUseBothDice && newState.dice.available.length === 1) {
          const hasValidMovesWithRemaining = getPossibleMoves(newState, position).length > 0;
          if (!hasValidMovesWithRemaining) {
            alert("You must use both dice if possible. Try a different move order.");
            return;
          }
        }
      }

      // Check for winner
      const winner = checkWinner(newState);
      if (winner) {
        newState.winner = winner;
        newState.gamePhase = 'gameOver';
      }

      const finalState = {
        ...newState,
        selectedPoint: null,
        possibleMoves: []
      };

      // Create deep copy for history
      const historyState = JSON.parse(JSON.stringify(finalState)) as GameState;
      
      setGameState(finalState);
      setMoveHistory(prev => [...prev, historyState]);
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

      const finalState = {
        ...newState,
        selectedPoint: null,
        possibleMoves: []
      };

      // Create deep copy for history
      const historyState = JSON.parse(JSON.stringify(finalState)) as GameState;

      setGameState(finalState);
      setMoveHistory(prev => [...prev, historyState]);
    }
  };

  const handleUndo = () => {
    if (moveHistory.length > 1 && gameState.currentPlayer === 'white' && gameState.gamePhase === 'moving') {
      // Get the previous state from history
      const previousState = JSON.parse(JSON.stringify(moveHistory[moveHistory.length - 2])) as GameState;
      
      // Reset selection and possible moves
      previousState.selectedPoint = null;
      previousState.possibleMoves = [];
      
      setGameState(previousState);
      setMoveHistory(prev => prev.slice(0, -1));
    }
  };

  const renderPoint = (point: Point, index: number) => {
    const isTopHalf = index < 12;
    const isSelected = point.position === gameState.selectedPoint;
    const isPossibleMove = gameState.possibleMoves.includes(point.position);
    
    return (
      <div
        key={point.position}
        className={`relative w-16 h-[240px] ${
          index % 2 === 0 ? 'bg-[#e8d5b5]' : 'bg-[#b89b72]'
        } ${isSelected ? 'ring-1 ring-yellow-400' : ''} 
        ${isPossibleMove ? 'ring-1 ring-green-400' : ''}`}
        onClick={() => handlePointClick(point.position)}
      >
        <div 
          className={`absolute w-0 h-0 left-0 ${
            isTopHalf 
              ? 'top-0 border-t-[240px]' 
              : 'bottom-0 border-b-[240px]'
          } border-l-[32px] border-r-[32px] border-l-transparent border-r-transparent ${
            index % 2 === 0 
              ? 'border-t-[#e8d5b5] border-b-[#e8d5b5]' 
              : 'border-t-[#b89b72] border-b-[#b89b72]'
          }`}
        />
        {point.pieces.map((color, i) => (
          <div
            key={i}
            className={`absolute w-12 h-12 rounded-full border ${
              color === 'white' ? 'bg-white' : 'bg-black'
            } ${color === 'white' ? 'border-gray-300' : 'border-gray-700'} z-10`}
            style={{
              left: '8px',
              [isTopHalf ? 'top' : 'bottom']: `${i * 20}px`,
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
        <div className="bg-[#e8d5b5] border-2 border-black">
          <div className="flex">
            {/* Black's home */}
            <div 
              className="w-16 h-[480px] bg-[#e8d5b5] flex flex-col items-center justify-center border-r border-black"
              onClick={() => handleBearOffClick('black')}
            >
              <div className="text-black mb-2">Home</div>
              <div className="text-black text-2xl">{gameState.home.black}</div>
            </div>
            
            <div className="flex flex-col">
              {/* Top half (points 13-24) */}
              <div className="flex">
                <div className="flex">
                  {gameState.points.slice(12, 18).reverse().map((point, i) => renderPoint(point, 23 - i))}
                </div>
                {/* Vertical gap */}
                <div className="w-16 bg-[#e8d5b5] border-x border-black relative">
                  {/* Dice */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-center items-center">
                    <div className="flex gap-2">
                      {isAIThinking && gameState.currentPlayer === 'black' && (
                        <div className="text-black text-sm">AI...</div>
                      )}
                      {gameState.dice.values.map((value, i) => (
                        <div 
                          key={i} 
                          className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold
                            ${gameState.currentPlayer === 'black' 
                              ? 'bg-black text-white' 
                              : 'bg-white text-black'} border border-black`}
                        >
                          {value}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex">
                  {gameState.points.slice(18, 24).reverse().map((point, i) => renderPoint(point, 17 - i))}
                </div>
              </div>
              
              {/* Bottom half (points 1-12) */}
              <div className="flex">
                <div className="flex">
                  {gameState.points.slice(0, 6).map((point, i) => renderPoint(point, i))}
                </div>
                {/* Vertical gap */}
                <div className="w-16 bg-[#e8d5b5] border-x border-black">
                  {/* Bar pieces */}
                  <div className="h-full flex flex-col justify-between py-2">
                    {/* Black captured pieces */}
                    {gameState.bar.black > 0 && (
                      <div 
                        className="cursor-pointer flex flex-col items-center"
                        onClick={() => handleBarClick('black')}
                      >
                        <div className="w-12 h-12 rounded-full bg-black border border-gray-700" />
                        <span className="text-black text-sm mt-1">x{gameState.bar.black}</span>
                      </div>
                    )}
                    {/* White captured pieces */}
                    {gameState.bar.white > 0 && (
                      <div 
                        className="cursor-pointer flex flex-col items-center"
                        onClick={() => handleBarClick('white')}
                      >
                        <div className="w-12 h-12 rounded-full bg-white border border-gray-300" />
                        <span className="text-black text-sm mt-1">x{gameState.bar.white}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex">
                  {gameState.points.slice(6, 12).map((point, i) => renderPoint(point, i + 6))}
                </div>
              </div>
            </div>

            {/* White's home */}
            <div 
              className="w-16 h-[480px] bg-[#e8d5b5] flex flex-col items-center justify-center border-l border-black"
              onClick={() => handleBearOffClick('white')}
            >
              <div className="text-black mb-2">Home</div>
              <div className="text-black text-2xl">{gameState.home.white}</div>
            </div>
          </div>
        </div>
      )}
      
      {gameState.gamePhase === 'rolling' && !gameState.winner && gameState.currentPlayer === 'white' && (
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

      {gameState.gamePhase === 'moving' && 
       gameState.currentPlayer === 'white' && 
       moveHistory.length > 1 && (
        <button
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          onClick={handleUndo}
        >
          Undo Move
        </button>
      )}
    </div>
  );
} 