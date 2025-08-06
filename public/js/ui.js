// UI-Hilfsfunktionen

// Bildschirm wechseln
function switchScreen(from, to) {
  const fromScreen = document.getElementById(`${from}Screen`);
  const toScreen = document.getElementById(`${to}Screen`);

  if (fromScreen && toScreen) {
    fromScreen.classList.remove('active');
    toScreen.classList.add('active');
  }
}

// HTML-Element erstellen
function createElement(type, className, text = '') {
  const element = document.createElement(type);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

// Spieler-Item erstellen
function createPlayerItem(player, options = {}) {
  const playerItem = createElement('div', 'player-item');

  const nameSpan = createElement('span', '', player.name);
  if (player.isCreator) {
    nameSpan.textContent += ' (Host)';
  }

  playerItem.appendChild(nameSpan);

  if (options.withVoteButton) {
    const voteButton = createElement('button', 'vote-button', options.buttonText || 'Wählen');
    voteButton.dataset.id = player.id;

    if (options.onClick) {
      voteButton.addEventListener('click', () => options.onClick(player.id));
    }

    playerItem.appendChild(voteButton);
  }

  return playerItem;
}

// Animation während des Übergangs zwischen Phasen
function phaseTransition(message, duration = 2000) {
  const overlay = createElement('div', 'transition-overlay');
  const text = createElement('div', 'transition-text', message);

  overlay.appendChild(text);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 500);
  }, duration);
}

// Zeigt eine Toast-Benachrichtigung an
function showToast(message, type = 'info') {
  const toast = createElement('div', `toast toast-${type}`, message);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

