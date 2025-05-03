const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';
const ROOM_ID = 'sala-de-teste';

const player1 = io(SERVER_URL);
const player2 = io(SERVER_URL);

player1.on('connect', () => {
  console.log('Player 1 conectado');
  player1.emit('join-game', ROOM_ID);

  setTimeout(() => {
    player1.emit('move', {
      roomId: ROOM_ID,
      move: { from: 'e2', to: 'e4' }
    });
  }, 1000);
});

player2.on('connect', () => {
  console.log('Player 2 conectado');
  player2.emit('join-game', ROOM_ID);
  setTimeout(() => {
    player2.emit('move', {
      roomId: ROOM_ID,
      move: { from: 'e7', to: 'e5' }
    });
  }, 2000);
});

[player1, player2].forEach((player, i) => {
  player.on('move-made', (data) => {
    console.log(`Player ${i + 1} recebeu movimento:`, data);
  });

  player.on('invalid-move', (msg) => {
    console.log(`Player ${i + 1} recebeu erro: ${msg}`);
  });
});
