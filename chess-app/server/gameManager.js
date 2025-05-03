const { Chess } = require('chess.js');

const games = {}; 

function createGame(roomId) {
  games[roomId] = {
    game: new Chess(),
    players: {},
    names: {},
  };
}

function getGame(roomId) {
  return games[roomId] || null;
}

function assignPlayer(roomId, socketId) {
  const game = games[roomId];
  if (!game) return null;

  const { players } = game;

  if (!players.white) {
    players.white = socketId;
    return 'w';
  }

  if (!players.black) {
    players.black = socketId;
    return 'b';
  }

  return null;
}

function setPlayerName(roomId, color, name) {
  const game = games[roomId];
  if (game) {
    game.names[color] = name;
  }
}

function getNames(roomId) {
  const game = games[roomId];
  return game?.names || {};
}

function getPlayerColor(roomId, socketId) {
  const game = games[roomId];
  if (!game) return null;

  const { players } = game;
  if (players.white === socketId) return 'w';
  if (players.black === socketId) return 'b';
  return null;
}

function makeMove(roomId, move, socketId) {
  const gameWrapper = games[roomId];
  if (!gameWrapper) return { error: 'Jogo não encontrado' };

  const game = gameWrapper.game;
  const playerColor = getPlayerColor(roomId, socketId);

  if (playerColor !== game.turn()) {
    return { error: 'Não é sua vez' };
  }

  try {
    const result = game.move(move);
    if (!result) return { error: 'Movimento inválido' };

    return {
      board: game.fen(),
      lastMove: result,
      gameOver: game.isGameOver(),
      inCheckmate: game.isCheckmate(),
      inDraw: game.isDraw(),
      turn: game.turn(),
    };
  } catch (err) {
    return { error: `Invalid move: ${JSON.stringify(move)}` };
  }
}

function restartGame(roomId) {
  if (games[roomId]) {
    games[roomId].game = new Chess();
    return games[roomId].game.fen();
  }
  return null;
}

module.exports = {
  createGame,
  getGame,
  assignPlayer,
  getPlayerColor,
  setPlayerName,
  getNames,
  makeMove,
  restartGame,
};
