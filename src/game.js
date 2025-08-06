class Game {
  constructor(roomId, players, werewolfCount) {
    this.roomId = roomId;
    this.players = players;
    this.werewolfCount = werewolfCount;
    this.phase = null; // 'night' oder 'day'
    this.round = 0;
  }

  distributeRoles() {
    // Zufällige Spieler zu Werwölfen machen
    const playerIds = this.players.map(p => p.id);
    const shuffled = [...playerIds].sort(() => 0.5 - Math.random());

    const werewolfIds = shuffled.slice(0, this.werewolfCount);
    const roles = {};

    playerIds.forEach(id => {
      roles[id] = werewolfIds.includes(id) ? 'werewolf' : 'villager';
    });

    return roles;
  }

  checkEndGame(alivePlayers) {
    const wolves = alivePlayers.filter(p => p.role === 'werewolf').length;
    const villagers = alivePlayers.filter(p => p.role === 'villager').length;

    if (wolves === 0) {
      return 'villagers'; // Dorfbewohner gewinnen
    }

    if (wolves >= villagers) {
      return 'werewolves'; // Werwölfe gewinnen
    }

    return null; // Spiel läuft weiter
  }
}

module.exports = { Game };

