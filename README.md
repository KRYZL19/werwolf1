# Werwolf Mobile Webspiel

Ein mobilfreundliches browserbasiertes Werwolf-Spiel mit Echtzeit-Kommunikation über Socket.IO.

## Funktionen

- **Raumverwaltung**: Erstellen und Beitreten von Spielräumen über eine Raum-ID
- **Rollenverteilung**: Zufällige Verteilung von Werwolf- und Dorfbewohner-Rollen
- **Spielphasen**: Nachts treffen die Werwölfe eine geheime Entscheidung, tags stimmen alle Spieler ab
- **Echtzeit-Updates**: Abstimmungen und Ergebnisse werden in Echtzeit übertragen
- **Responsive Design**: Optimiert für mobile Geräte und Desktop-Browser

## Installation

1. Repository klonen
   ```bash
   git clone <repository-url>
   cd werwolf1
   ```

2. Abhängigkeiten installieren
   ```bash
   npm install
   ```

3. Server starten
   ```bash
   npm start
   ```

4. Im Browser öffnen: `http://localhost:3000`

## Deployment auf Render.com

Das Spiel kann einfach auf Render.com deployt werden:

1. Erstelle ein kostenloses Konto auf [Render.com](https://render.com)

2. Klicke auf "New" und wähle "Web Service"

3. Verbinde dein GitHub-Repository oder lade dein Projekt manuell hoch

4. Konfiguriere den Dienst:
   - **Name**: Wähle einen Namen für deinen Dienst
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. Klicke auf "Create Web Service"

6. Nach dem Deployment kannst du dein Spiel unter der zugewiesenen URL erreichen

## Spielregeln

1. **Raumeinrichtung**:
   - Ein Spieler erstellt einen Raum mit einer eindeutigen Raum-ID
   - Der Ersteller legt die Anzahl der Werwölfe (1-3) und die Gesamtspielerzahl (5-15) fest
   - Andere Spieler treten mit der Raum-ID bei

2. **Spielbeginn**:
   - Sobald die festgelegte Anzahl an Spielern beigetreten ist, startet ein 5-Sekunden-Countdown
   - Jeder Spieler erhält zufällig eine Rolle: Werwolf oder Dorfbewohner

3. **Spielablauf**:
   - **Nachtphase**: Die Werwölfe stimmen geheim ab, wen sie eliminieren möchten
   - **Tagphase**: Alle verbleibenden Spieler stimmen öffentlich ab, wen sie verdächtigen

4. **Spielende**:
   - Die Dorfbewohner gewinnen, wenn alle Werwölfe eliminiert sind
   - Die Werwölfe gewinnen, wenn ihre Anzahl der der Dorfbewohner entspricht

## Technologien

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js mit Express
- **Echtzeit-Kommunikation**: Socket.IO
- **Hosting**: Render.com

## Code

```javascript
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { Game } = require('./game');
const { Room } = require('./room');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Statische Dateien aus dem public-Ordner bereitstellen
app.use(express.static(path.join(__dirname, '../public')));

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
```
