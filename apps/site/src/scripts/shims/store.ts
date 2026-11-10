/** In-memory stand-in for the working directory that tttui-axi writes its session file to. */
export const files = new Map<string, string>();

export interface TttSession {
  game: {
    board: (string | null)[];
    turn: 'X' | 'O';
    winner: string | null;
    winningLine: number[] | null;
    isDraw: boolean;
    isOver: boolean;
    scores: { X: number; O: number; ties: number };
  };
  difficulty: string;
  roundNumber: number;
}

export function readSession(): TttSession | undefined {
  const raw = [...files.entries()].find(([path]) => path.endsWith('.ttt-session.json'))?.[1];
  return raw ? (JSON.parse(raw) as TttSession) : undefined;
}
