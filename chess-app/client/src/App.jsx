import { useEffect, useState, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');
const INITIAL_TIME = 10 * 60;

export default function App() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [roomId, setRoomId] = useState('');
  const [playerColor, setPlayerColor] = useState(null);
  const [status, setStatus] = useState('Digite o ID da sala para entrar');
  const [players, setPlayers] = useState({ w: 'Jogador 1', b: 'Jogador 2' });

  const [clock, setClock] = useState({ w: INITIAL_TIME, b: INITIAL_TIME });
  const clockRef = useRef({ w: INITIAL_TIME, b: INITIAL_TIME });
  const intervalRef = useRef(null);
  const [highlightedSquares, setHighlightedSquares] = useState({});
  const [lastMoveSquares, setLastMoveSquares] = useState({});

  function formatTime(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function startClock() {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const turn = gameRef.current.turn();
      if (turn === playerColor) {
        clockRef.current[turn] -= 1;
        setClock({ ...clockRef.current });

        if (clockRef.current[turn] <= 0) {
          setStatus(`${turn === 'w' ? 'Branco' : 'Preto'} perdeu por tempo`);
          clearInterval(intervalRef.current);
        }
      }
    }, 1000);
  }

  function handleJoin() {
    const name = prompt('Digite seu nome:');
    if (!roomId || !name) return;
    socket.emit('join-game', roomId);
    socket.emit('set-name', { name });
  }

  function handleDrawOffer() {
    socket.emit('offer-draw');
    setStatus('Empate oferecido. Aguardando resposta...');
  }

  function handleResign() {
    socket.emit('resign');
    setStatus('Você desistiu. Fim de jogo.');
    clearInterval(intervalRef.current);
  }

  function handleNewGame() {
    socket.emit('restart');
    setStatus('Nova partida iniciada!');
  }

  function highlightMoves(square) {
    const game = gameRef.current;
    const moves = game.moves({ square, verbose: true });

    if (moves.length === 0) {
      setHighlightedSquares({});
      return;
    }

    const highlights = {};
    moves.forEach(move => {
      highlights[move.to] = {
        background:
          game.get(move.to)
            ? 'radial-gradient(circle, #fffc 25%, transparent 30%)'
            : 'radial-gradient(circle, #88ff88cc 20%, transparent 25%)',
      };
    });

    highlights[square] = {
      background: '#ffff0033',
    };

    setHighlightedSquares(highlights);
  }

  function clearHighlights() {
    setHighlightedSquares({});
  }

  function onDrop(sourceSquare, targetSquare) {
    const game = gameRef.current;

    if (!playerColor) {
      setStatus('Espere a partida iniciar...');
      return false;
    }

    if (game.turn() !== playerColor) {
      setStatus('Não é sua vez.');
      return false;
    }

    const legalMoves = game.moves({ square: sourceSquare, verbose: true });
    const isLegal = legalMoves.some(move => move.to === targetSquare);

    if (!isLegal) {
      setStatus('Movimento inválido.');
      return false;
    }

    socket.emit('move', {
      roomId,
      move: { from: sourceSquare, to: targetSquare },
    });

    setHighlightedSquares({});
    return true;
  }

  useEffect(() => {
    socket.on('player-color', (color) => {
      setPlayerColor(color);
      setStatus(`Você é o jogador ${color === 'w' ? 'BRANCO' : 'PRETO'}`);
    });

    socket.on('player-names', (names) => {
      setPlayers(names);
    });

    socket.on('room-full', () => {
      setStatus('Sala cheia. Tente outra sala.');
    });

    socket.on('move-made', (data) => {
      gameRef.current.load(data.board);
      setFen(data.board);

      clearInterval(intervalRef.current);

      if (data.lastMove) {
        setLastMoveSquares({
          [data.lastMove.from]: { backgroundColor: '#f6f669' },
          [data.lastMove.to]: { backgroundColor: '#f6f669' }
        });
      } else {
        setLastMoveSquares({});
      }

      if (data.lastMove === null) {
        setClock({ w: INITIAL_TIME, b: INITIAL_TIME });
        clockRef.current = { w: INITIAL_TIME, b: INITIAL_TIME };

        if (data.turn === playerColor) {
          startClock();
        }
      } else if (data.turn === playerColor) {
        startClock();
      }

      if (data.gameOver) {
        setStatus('Fim de jogo');
        return;
      }

      setStatus(data.turn === playerColor ? 'Sua vez' : 'Esperando o adversário...');
    });

    socket.on('invalid-move', () => {
      setStatus('Movimento inválido.');
    });

    socket.on('draw-offered', () => {
      setStatus('Seu oponente ofereceu empate.');
    });

    socket.on('resigned', (message) => {
      setStatus(message);
      clearInterval(intervalRef.current);
    });

    socket.on('opponent-left', (msg) => {
      setStatus(msg);
      clearInterval(intervalRef.current);
    });

    return () => {
      socket.off('player-color');
      socket.off('player-names');
      socket.off('room-full');
      socket.off('move-made');
      socket.off('invalid-move');
      socket.off('draw-offered');
      socket.off('resigned');
      socket.off('opponent-left');
      clearInterval(intervalRef.current);
    };
  }, [playerColor]);

  return (
    <div className="main-container">
      <h2 className="room-title">🧩 Sala: {roomId || '(nenhuma)'}</h2>

      <div className="board-section">
        <div className={`player top ${gameRef.current.turn() === (playerColor === 'w' ? 'b' : 'w') ? 'active-turn' : ''}`}>
          <div>👤 {playerColor === 'w' ? players.b : players.w}</div>
          <div className="clock">⏱ {formatTime(clock[playerColor === 'w' ? 'b' : 'w'])}</div>
        </div>

        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          boardOrientation={playerColor === 'b' ? 'black' : 'white'}
          boardWidth={480}
          onMouseOverSquare={highlightMoves}
          onMouseOutSquare={clearHighlights}
          customSquareStyles={{ ...highlightedSquares, ...lastMoveSquares }}
          customDarkSquareStyle={{ backgroundColor: '#769656' }}
          customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
          transitionDuration={300}
        />

        <div className={`player bottom ${gameRef.current.turn() === playerColor ? 'active-turn' : ''}`}>
          <div>👤 {playerColor === 'w' ? players.w : players.b} (você)</div>
          <div className="clock">⏱ {formatTime(clock[playerColor])}</div>
        </div>
      </div>

      <div className="info-panel">
        <p><strong>Status:</strong> {status}</p>
        <input
          type="text"
          placeholder="ID da sala"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={handleJoin}>Entrar na sala</button>
        <button onClick={handleNewGame}>Nova Partida</button>
        <button onClick={handleDrawOffer}>Oferecer Empate</button>
        <button onClick={handleResign}>Desistir</button>
      </div>
    </div>
  );
}
