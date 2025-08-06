// Socket.IO-Verbindung herstellen mit dynamischer Server-URL
const socketUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : window.location.origin;
const socket = io(socketUrl);

// Spielzustand
let gameState = {
  playerName: '',
  roomId: '',
  playerId: '',
  role: '',
  isCreator: false,
  currentPhase: 'lobby',
  hasVoted: false
};

// DOM-Referenzen
const screens = {
  start: document.getElementById('startScreen'),
  createRoom: document.getElementById('createRoomScreen'),
  joinRoom: document.getElementById('joinRoomScreen'),
  lobby: document.getElementById('lobbyScreen'),
  role: document.getElementById('roleScreen'),
  werewolf: document.getElementById('werewolfScreen'),
  villagerNight: document.getElementById('villagerNightScreen'),
  day: document.getElementById('dayScreen'),
  gameOver: document.getElementById('gameOverScreen'),
  error: document.getElementById('errorOverlay')
};

// Formular-Eventlistener hinzufügen
document.getElementById('createRoomBtn').addEventListener('click', () => showScreen('createRoom'));
document.getElementById('joinRoomBtn').addEventListener('click', () => showScreen('joinRoom'));
document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => showScreen('start'));
});

// Bestehender Code für das Erstellen eines Raums
document.getElementById('createRoomForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const playerName = document.getElementById('creatorName').value.trim();
  const roomId = document.getElementById('roomId').value.trim();
  const werewolfCount = parseInt(document.getElementById('werewolfCount').value);
  const playerCount = parseInt(document.getElementById('playerCount').value);

  if (!playerName || !roomId) {
    showError('Bitte fülle alle Felder aus.');
    return;
  }

  gameState.playerName = playerName;
  gameState.roomId = roomId;
  gameState.isCreator = true;

  // Raum erstellen
  socket.emit('createRoom', {
    playerName,
    roomId,
    werewolfCount,
    playerCount
  });
});

// Bestehender Code für das Beitreten eines Raums
document.getElementById('joinRoomForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const playerName = document.getElementById('playerName').value.trim();
  const roomId = document.getElementById('joinRoomId').value.trim();

  if (!playerName || !roomId) {
    showError('Bitte fülle alle Felder aus.');
    return;
  }

  gameState.playerName = playerName;
  gameState.roomId = roomId;

  // Raum beitreten
  socket.emit('joinRoom', {
    playerName,
    roomId
  });
});

document.getElementById('continueBtn').addEventListener('click', () => {
  if (gameState.role === 'werewolf') {
    showScreen('werewolf');
  } else {
    showScreen('villagerNight');
  }
});

document.getElementById('errorCloseBtn').addEventListener('click', () => {
  screens.error.classList.remove('active');
});

document.getElementById('newGameBtn').addEventListener('click', () => {
  resetGame();
  showScreen('start');
});

// Socket.IO-Event-Handler mit verbesserten Reconnect-Funktionen
socket.on('connect', () => {
  console.log('Mit dem Server verbunden');

  // Wenn wir uns nach einem Verbindungsverlust wieder verbinden und in einem Spiel waren
  if (gameState.roomId && gameState.playerName) {
    // Versuche, wieder dem Raum beizutreten
    socket.emit('rejoinRoom', {
      playerName: gameState.playerName,
      roomId: gameState.roomId,
      playerId: gameState.playerId
    });
  }
});

socket.on('connect_error', () => {
  console.log('Verbindungsfehler - versuche erneut zu verbinden');
  showError('Verbindung zum Server verloren. Versuche erneut zu verbinden...');
});

// Bestehende Event-Handler
socket.on('roomCreated', ({ roomId, player }) => {
  gameState.playerId = player.id;
  gameState.roomId = roomId;

  // Lobby-Screen aktualisieren
  document.getElementById('lobbyRoomId').textContent = roomId;

  showScreen('lobby');
});

socket.on('roomJoined', ({ roomId, player }) => {
  gameState.playerId = player.id;
  gameState.roomId = roomId;

  // Lobby-Screen aktualisieren
  document.getElementById('lobbyRoomId').textContent = roomId;

  showScreen('lobby');
});

socket.on('playerJoined', ({ players }) => {
  updatePlayerList(players);
});

socket.on('startCountdown', () => {
  startCountdown();
});

socket.on('roleAssigned', ({ role }) => {
  gameState.role = role;
  displayRole(role);
  showScreen('role');
});

socket.on('nightPhaseStarted', () => {
  gameState.currentPhase = 'night';
  gameState.hasVoted = false;

  if (gameState.role !== 'werewolf') {
    showScreen('villagerNight');
  }
});

socket.on('werewolfTurn', ({ targets }) => {
  renderWerewolfTargets(targets);
  showScreen('werewolf');
});

socket.on('nightResult', ({ eliminated, remainingPlayers }) => {
  document.getElementById('nightResult').textContent =
    `${eliminated} wurde in der Nacht getötet.`;

  updatePlayerList(remainingPlayers);
});

socket.on('dayPhaseStarted', ({ targets }) => {
  gameState.currentPhase = 'day';
  gameState.hasVoted = false;
  renderVillagerTargets(targets);
  showScreen('day');
});

socket.on('voteUpdate', (voteCounts) => {
  updateVoteResults(voteCounts);
});

socket.on('dayResult', ({ eliminated, remainingPlayers }) => {
  alert(`${eliminated} wurde vom Dorf verbannt.`);
  updatePlayerList(remainingPlayers);
});

socket.on('gameOver', ({ winner, werewolves }) => {
  showGameResult(winner, werewolves);
  showScreen('gameOver');
});

socket.on('error', (message) => {
  showError(message);
});

// Bestehende Hilfsfunktionen
function showScreen(screenId) {
  // Alle Screens ausblenden
  Object.values(screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });

  // Gewünschten Screen einblenden
  if (screens[screenId]) {
    screens[screenId].classList.add('active');
  }
}

function updatePlayerList(players) {
  const playerListElement = document.getElementById('playerList');
  const maxPlayerCount = document.getElementById('maxPlayerCount');
  const currentPlayerCount = document.getElementById('playerCount');

  playerListElement.innerHTML = '';

  players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    playerItem.textContent = player.name + (player.isCreator ? ' (Host)' : '');

    if (!player.isAlive) {
      playerItem.style.opacity = '0.5';
      playerItem.textContent += ' (tot)';
    }

    playerListElement.appendChild(playerItem);
  });

  currentPlayerCount.textContent = players.length;
}

function startCountdown() {
  const countdownElement = document.getElementById('countdown');
  let count = 5;

  countdownElement.textContent = count;

  const interval = setInterval(() => {
    count--;
    countdownElement.textContent = count;

    if (count <= 0) {
      clearInterval(interval);
      countdownElement.textContent = 'Spiel startet...';
    }
  }, 1000);
}

function displayRole(role) {
  const roleIcon = document.getElementById('roleIcon');
  const roleName = document.getElementById('roleName');
  const roleDescription = document.getElementById('roleDescription');

  roleIcon.className = 'role-icon';

  if (role === 'werewolf') {
    roleIcon.classList.add('werewolf-icon');
    roleName.textContent = 'Werwolf';
    roleDescription.textContent = 'Du bist ein Werwolf! Dein Ziel ist es, alle Dorfbewohner zu eliminieren. Nachts wählst du mit den anderen Werwölfen ein Opfer.';
  } else {
    roleIcon.classList.add('villager-icon');
    roleName.textContent = 'Dorfbewohner';
    roleDescription.textContent = 'Du bist ein Dorfbewohner! Dein Ziel ist es, alle Werwölfe zu finden und zu eliminieren, bevor sie dich und die anderen Dorfbewohner töten.';
  }
}

function renderWerewolfTargets(targets) {
  const targetListElement = document.getElementById('werewolfTargets');
  targetListElement.innerHTML = '';

  targets.forEach(target => {
    const targetItem = document.createElement('div');
    targetItem.className = 'player-item';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = target.name;

    const voteButton = document.createElement('button');
    voteButton.className = 'vote-button';
    voteButton.textContent = 'Töten';
    voteButton.addEventListener('click', () => {
      if (!gameState.hasVoted) {
        socket.emit('werewolfVote', {
          roomId: gameState.roomId,
          targetId: target.id
        });

        gameState.hasVoted = true;
        voteButton.disabled = true;
        voteButton.textContent = 'Abgestimmt';

        document.querySelectorAll('.vote-button').forEach(btn => {
          if (btn !== voteButton) {
            btn.disabled = true;
          }
        });
      }
    });

    targetItem.appendChild(nameSpan);
    targetItem.appendChild(voteButton);
    targetListElement.appendChild(targetItem);
  });
}

function renderVillagerTargets(targets) {
  const targetListElement = document.getElementById('villagerTargets');
  targetListElement.innerHTML = '';

  targets.forEach(target => {
    const targetItem = document.createElement('div');
    targetItem.className = 'player-item';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = target.name;

    const voteButton = document.createElement('button');
    voteButton.className = 'vote-button';
    voteButton.textContent = 'Wählen';
    voteButton.addEventListener('click', () => {
      if (!gameState.hasVoted) {
        socket.emit('villagerVote', {
          roomId: gameState.roomId,
          targetId: target.id
        });

        gameState.hasVoted = true;
        voteButton.disabled = true;
        voteButton.textContent = 'Abgestimmt';

        document.querySelectorAll('.vote-button').forEach(btn => {
          if (btn !== voteButton) {
            btn.disabled = true;
          }
        });
      }
    });

    targetItem.appendChild(nameSpan);
    targetItem.appendChild(voteButton);
    targetListElement.appendChild(targetItem);
  });
}

function updateVoteResults(voteCounts) {
  const voteResultsElement = document.getElementById('voteResults');
  voteResultsElement.innerHTML = '';

  // Maximale Stimmzahl finden
  const maxVotes = Math.max(...Object.values(voteCounts));

  // Für jeden Spieler ein Balken anzeigen
  Object.entries(voteCounts).forEach(([playerId, voteCount]) => {
    // Spielername finden
    const playerName = document.querySelector(`#villagerTargets .player-item:has(button[data-id="${playerId}"]) span`).textContent;

    const voteBar = document.createElement('div');
    voteBar.className = 'vote-bar';

    const voteBarFill = document.createElement('div');
    voteBarFill.className = 'vote-bar-fill';
    voteBarFill.style.width = `${(voteCount / maxVotes) * 100}%`;

    const voteBarLabel = document.createElement('div');
    voteBarLabel.className = 'vote-bar-label';
    voteBarLabel.textContent = `${playerName}: ${voteCount} Stimme${voteCount !== 1 ? 'n' : ''}`;

    voteBar.appendChild(voteBarFill);
    voteBar.appendChild(voteBarLabel);
    voteResultsElement.appendChild(voteBar);
  });
}

function showGameResult(winner, werewolves) {
  const winnerElement = document.getElementById('winnerAnnouncement');
  const werewolfListElement = document.getElementById('werewolfReveal');

  if (winner === 'villagers') {
    winnerElement.textContent = 'Die Dorfbewohner haben gewonnen! Alle Werwölfe wurden eliminiert.';
    winnerElement.style.color = 'green';
  } else {
    winnerElement.textContent = 'Die Werwölfe haben gewonnen! Sie haben die Dorfbewohner überwältigt.';
    winnerElement.style.color = '#b30000';
  }

  werewolfListElement.innerHTML = '<h3>Die Werwölfe waren:</h3>';

  werewolves.forEach(werewolf => {
    const werewolfItem = document.createElement('div');
    werewolfItem.className = 'werewolf-player';
    werewolfItem.textContent = werewolf.name;
    werewolfListElement.appendChild(werewolfItem);
  });
}

function showError(message) {
  const errorMessageElement = document.getElementById('errorMessage');
  errorMessageElement.textContent = message;
  screens.error.classList.add('active');
}

function resetGame() {
  gameState = {
    playerName: '',
    roomId: '',
    playerId: '',
    role: '',
    isCreator: false,
    currentPhase: 'lobby',
    hasVoted: false
  };

  // Formulare zurücksetzen
  document.getElementById('createRoomForm').reset();
  document.getElementById('joinRoomForm').reset();
}

// Service Worker für bessere Offline-Funktionalität registrieren
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('ServiceWorker registriert mit Scope:', registration.scope);
    }).catch(error => {
      console.log('ServiceWorker Registrierung fehlgeschlagen:', error);
    });
  });
}
