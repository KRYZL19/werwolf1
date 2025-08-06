const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const { Game } = require('./game');
const { Room } = require('./room');

const app = express();
const server = http.createServer(app);

// CORS für Produktionsumgebung konfigurieren
app.use(cors());

// Socket.IO mit CORS-Konfiguration
const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:3000',
    methods: ["GET", "POST"]
  }
});

// Statische Dateien aus dem public-Ordner bereitstellen
app.use(express.static(path.join(__dirname, '../public')));

// Grundlegende Route für Gesundheitscheck
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Aktive Räume speichern
const rooms = {};

io.on('connection', (socket) => {
  console.log('Neuer Benutzer verbunden:', socket.id);

  // Einen neuen Raum erstellen
  socket.on('createRoom', ({ playerName, roomId, werewolfCount, playerCount }) => {
    if (rooms[roomId]) {
      socket.emit('error', 'Raum-ID bereits vergeben. Bitte wähle eine andere ID.');
      return;
    }

    const room = new Room(roomId, playerCount, werewolfCount);
    rooms[roomId] = room;

    const player = room.addPlayer(socket.id, playerName, true);
    socket.join(roomId);

    socket.emit('roomCreated', { roomId, player });
    io.to(roomId).emit('playerJoined', { players: room.getPlayersInfo() });

    console.log(`Raum ${roomId} erstellt von ${playerName}`);
  });

  // Einem vorhandenen Raum beitreten
  socket.on('joinRoom', ({ playerName, roomId }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit('error', 'Raum nicht gefunden.');
      return;
    }

    if (room.isFull()) {
      socket.emit('error', 'Raum ist bereits voll.');
      return;
    }

    if (room.isGameStarted()) {
      socket.emit('error', 'Spiel hat bereits begonnen.');
      return;
    }

    const player = room.addPlayer(socket.id, playerName, false);
    socket.join(roomId);

    socket.emit('roomJoined', { roomId, player });
    io.to(roomId).emit('playerJoined', { players: room.getPlayersInfo() });

    console.log(`${playerName} ist Raum ${roomId} beigetreten`);

    // Wenn der Raum voll ist, starte den Countdown
    if (room.isFull()) {
      io.to(roomId).emit('startCountdown');

      setTimeout(() => {
        room.startGame();

        // Sende jedem Spieler seine Rolle
        room.players.forEach(player => {
          io.to(player.socketId).emit('roleAssigned', {
            role: player.role
          });
        });

        // Starte die erste Nachtphase
        startNightPhase(roomId);
      }, 5000);
    }
  });

  // Werwolf-Abstimmung
  socket.on('werewolfVote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.getPlayerBySocketId(socket.id);
    if (!player || player.role !== 'werewolf') return;

    room.werewolfVote(player.id, targetId);

    // Prüfen, ob alle Werwölfe abgestimmt haben
    if (room.allWerewolvesVoted()) {
      const victim = room.resolveWerewolfVotes();
      room.eliminatePlayer(victim.id);

      io.to(roomId).emit('nightResult', {
        eliminated: victim.name,
        remainingPlayers: room.getPlayersInfo()
      });

      // Prüfe Spielende
      if (room.checkGameEnd()) {
        io.to(roomId).emit('gameOver', {
          winner: room.getWinner(),
          werewolves: room.getWerewolves()
        });
      } else {
        // Starte die Tagphase
        startDayPhase(roomId);
      }
    }
  });

  // Dorfbewohner-Abstimmung
  socket.on('villagerVote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.getPlayerBySocketId(socket.id);
    if (!player || !player.isAlive) return;

    room.villagerVote(player.id, targetId);

    // Sende aktuellen Abstimmungsstand an alle
    io.to(roomId).emit('voteUpdate', room.getVoteCounts());

    // Prüfen, ob alle Spieler abgestimmt haben
    if (room.allPlayersVoted()) {
      const victim = room.resolveVillagerVotes();
      room.eliminatePlayer(victim.id);

      io.to(roomId).emit('dayResult', {
        eliminated: victim.name,
        remainingPlayers: room.getPlayersInfo()
      });

      // Prüfe Spielende
      if (room.checkGameEnd()) {
        io.to(roomId).emit('gameOver', {
          winner: room.getWinner(),
          werewolves: room.getWerewolves()
        });
      } else {
        // Starte die nächste Nachtphase
        startNightPhase(roomId);
      }
    }
  });

  // Spieler-Verbindung getrennt
  socket.on('disconnect', () => {
    console.log('Benutzer getrennt:', socket.id);

    // Finde den Raum, in dem der Spieler ist
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const player = room.getPlayerBySocketId(socket.id);

      if (player) {
        room.removePlayer(player.id);
        io.to(roomId).emit('playerLeft', {
          playerId: player.id,
          players: room.getPlayersInfo()
        });

        // Wenn der Raum leer ist, entferne ihn
        if (room.isEmpty()) {
          delete rooms[roomId];
          console.log(`Raum ${roomId} entfernt`);
        }
        break;
      }
    }
  });
});

function startNightPhase(roomId) {
  const room = rooms[roomId];
  room.startNightPhase();

  // Benachrichtige alle Spieler über die Nachtphase
  io.to(roomId).emit('nightPhaseStarted');

  // Sende Werwölfen die Liste der möglichen Opfer
  const werewolves = room.getWerewolves();
  const targets = room.getAlivePlayersInfo();

  werewolves.forEach(werewolf => {
    io.to(werewolf.socketId).emit('werewolfTurn', { targets });
  });
}

function startDayPhase(roomId) {
  const room = rooms[roomId];
  room.startDayPhase();

  // Benachrichtige alle Spieler über die Tagphase
  io.to(roomId).emit('dayPhaseStarted', {
    targets: room.getAlivePlayersInfo()
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

