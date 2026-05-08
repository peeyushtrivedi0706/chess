import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface MoveRecord {
  san: string;
  fen: string;
}

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { player } = useAuth();
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [status, setStatus] = useState<string>('Your turn');
  const [difficulty] = useState<Difficulty>('intermediate');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.emit('game:join', { gameId });

    socket.on('game:state', ({ fen: serverFen }: { fen: string }) => {
      chess.load(serverFen);
      setFen(serverFen);
    });

    socket.on('game:move', ({ san, fen: newFen }: { san: string; fen: string }) => {
      chess.load(newFen);
      setFen(newFen);
      setMoves((prev) => [...prev, { san, fen: newFen }]);
      if (chess.isGameOver()) {
        setStatus(chess.isCheckmate() ? 'Checkmate!' : 'Game over');
      } else {
        setStatus('Your turn');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [gameId, chess]);

  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      try {
        const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
        if (!move) return false;
        const newFen = chess.fen();
        setFen(newFen);
        setMoves((prev) => [...prev, { san: move.san, fen: newFen }]);
        setStatus('Thinking...');
        socketRef.current?.emit('game:move', { gameId, from: sourceSquare, to: targetSquare, promotion: 'q' });
        return true;
      } catch {
        return false;
      }
    },
    [chess, gameId]
  );

  return (
    <div style={{ display: 'flex', gap: 24, padding: 24 }}>
      <div style={{ width: 560 }}>
        <Chessboard
          id="main-board"
          position={fen}
          onPieceDrop={onDrop}
          boardWidth={560}
          arePiecesDraggable={!chess.isGameOver()}
        />
      </div>
      <div style={{ minWidth: 200 }}>
        <h3>Status</h3>
        <p>{status}</p>
        <h3>Moves</h3>
        <ol>
          {moves.map((m, i) => (
            <li key={i}>{m.san}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
