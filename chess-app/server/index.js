const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const {
  createGame,
  getGame,
  assignPlayer,
  getPlayerColor,
  setPlayerName,
  getNames,
  makeMove,
  restartGame,
} = require('./gameManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

const savedGames = [];

app.get('/', (req, res) => {
  res.send('Servidor de xadrez rodando!');
});

app.get('/games', (req, res) => {
  res.json(savedGames); 
});

io.on('connection', (socket) => {
  console.log(`Conectado: ${socket.id}`);

  socket.on('join-game', (roomId) => {
    socket.join(roomId);

    if (!getGame(roomId)) {
      createGame(roomId);
    }

    const color = assignPlayer(roomId, socket.id);

    if (!color) {
      socket.emit('room-full');
      return;
    }

    socket.data.roomId = roomId;
    socket.data.color = color;

    socket.emit('player-color', color);
    socket.emit('player-names', getNames(roomId));
  });

  socket.on('set-name', ({ name }) => {
    const { roomId, color } = socket.data;
    if (!roomId || !color) return;

    setPlayerName(roomId, color, name);
    io.to(roomId).emit('player-names', getNames(roomId));
  });

  socket.on('move', ({ roomId, move }) => {
    const result = makeMove(roomId, move, socket.id);
    if (result.error) {
      socket.emit('invalid-move', result.error);
      return;
    }

    if (result.gameOver) {
      const finalState = {
        roomId,
        timestamp: Date.now(),
        result,
      };
      savedGames.push(finalState);
    }

    io.to(roomId).emit('move-made', result);
  });

  socket.on('offer-draw', () => {
    const { roomId } = socket.data;
    socket.to(roomId).emit('draw-offered');
  });

  socket.on('resign', () => {
    const { roomId, color } = socket.data;
    const loser = color === 'w' ? 'Branco' : 'Preto';

    const game = getGame(roomId);
    if (game) {
      savedGames.push({
        roomId,
        timestamp: Date.now(),
        result: {
          board: game.game.fen(),
          outcome: `${loser} desistiu`,
        },
      });
    }

    io.to(roomId).emit('resigned', `${loser} desistiu. Fim de jogo.`);
  });

  socket.on('restart', () => {
    const { roomId } = socket.data;
    const newFen = restartGame(roomId);
    if (newFen) {
      io.to(roomId).emit('move-made', {
        board: newFen,
        lastMove: null,
        gameOver: false,
        inCheckmate: false,
        inDraw: false,
        turn: 'w',
      });
    }
  });

  socket.on('disconnect', () => {
    const { roomId, color } = socket.data;
    console.log(`Desconectado: ${socket.id}`);

    if (!roomId) return;

    const game = getGame(roomId);
    if (!game) return;

    const { players } = game;

    const opponentId = (color === 'w') ? players.black : players.white;
    if (opponentId) {
      io.to(opponentId).emit('opponent-left', 'Seu oponente saiu da partida.');
    }

    if (players.white === socket.id) players.white = null;
    if (players.black === socket.id) players.black = null;

    const stillActive = players.white || players.black;

    if (!stillActive) {
      delete games[roomId];
      console.log(`Sala ${roomId} excluída por inatividade.`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
