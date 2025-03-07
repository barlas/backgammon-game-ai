import { OpenAI } from 'openai';
import { GameState, Move } from '@/app/types/backgammon';
import { getPossibleMoves } from '@/app/utils/gameLogic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are an expert backgammon AI player. You will receive the current game state and need to choose the best move.
Your goal is to win the game by moving all your pieces to your home board and bearing them off.
You play as black, moving counterclockwise from point 24 towards point 1.

Key rules to consider:
1. You can only move pieces in the direction of your home board (counterclockwise)
2. You must use dice values exactly
3. If you have pieces on the bar, you must move them first (use -1 as the 'from' position)
4. You can only bear off when all your pieces are in your home board (points 19-24)
5. You can hit single opponent pieces (blots)
6. You cannot move to a point with 2 or more opponent pieces

You will receive a list of valid moves in this format:
From [position]: can move to points [list of valid destinations]

You MUST choose one of these exact moves. Your response must be a JSON object with:
- 'from': the starting position (number, can be -1 for bar)
- 'to': the destination position (number)

Example response: { "from": 13, "to": 7 }`;

export async function POST(req: Request) {
  try {
    const { gameState, availableMoves } = await req.json();

    // Validate that there are available moves
    if (Object.keys(availableMoves).length === 0) {
      return Response.json({ error: 'No valid moves available' }, { status: 400 });
    }

    const moveDescription = generateGameStateDescription(gameState, availableMoves);
    console.log('Available moves:', availableMoves); // Debug log

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: moveDescription }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const move = completion.choices[0].message.content;
    if (typeof move !== 'string') {
      throw new Error('Invalid AI response format');
    }

    const parsedMove = JSON.parse(move) as { from: number; to: number };
    console.log('AI chose move:', parsedMove); // Debug log

    // Validate the move
    if (!isValidAIMove(parsedMove, availableMoves)) {
      console.log('Invalid move:', parsedMove, 'Available moves:', availableMoves); // Debug log
      throw new Error('Invalid AI move');
    }

    return Response.json({ move: parsedMove });
  } catch (error) {
    console.error('AI move error:', error);
    return Response.json({ error: 'Failed to generate AI move' }, { status: 500 });
  }
}

function generateGameStateDescription(gameState: GameState, availableMoves: Record<number, number[]>): string {
  const description = `
Current game state:
- Your pieces (black) positions: ${describePositions(gameState, 'black')}
- Opponent pieces (white) positions: ${describePositions(gameState, 'white')}
- Pieces on bar: ${gameState.bar.black} black, ${gameState.bar.white} white
- Pieces in home: ${gameState.home.black} black, ${gameState.home.white} white
- Dice values available: ${gameState.dice.available.join(', ')}

Available moves (you MUST choose one of these):
${Object.entries(availableMoves)
  .map(([from, tos]) => `From ${from}: can move to points [${tos.join(', ')}]`)
  .join('\n')}

Choose one move from the available moves above. Respond with a JSON object containing 'from' and 'to' properties.
The 'from' and 'to' values must exactly match one of the moves listed above.
`;

  return description;
}

function describePositions(gameState: GameState, color: 'black' | 'white'): string {
  return gameState.points
    .map((point, i) => {
      const count = point.pieces.filter(p => p === color).length;
      return count > 0 ? `${count} on point ${i + 1}` : null;
    })
    .filter(Boolean)
    .join(', ');
}

function isValidAIMove(
  move: { from: number; to: number },
  availableMoves: Record<string, number[]>
): boolean {
  // Convert move.from to string because object keys are strings
  const fromStr = move.from.toString();
  const validDestinations = availableMoves[fromStr];
  
  if (!validDestinations) {
    console.log(`No valid moves from position ${move.from}`);
    return false;
  }
  
  const isValid = validDestinations.includes(move.to);
  if (!isValid) {
    console.log(`Move to ${move.to} not in valid destinations:`, validDestinations);
  }
  
  return isValid;
} 