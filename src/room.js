const { Game } = require('./game');

class Room {
  constructor(id, maxPlayers, werewolfCount) {
    this.id = id;
    this.maxPlayers = maxPlayers;
    this.werewolfCount = werewolfCount;
    this.players = [];
    this.game = null;
    this.creator = null;
    this.phase = 'lobby'; // lobby, night, day
    this.werewolfVotes = {};
    this.villagerVotes = {};
  }

  addPlayer(socketId, name, isCreator) {
    const playerId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const player = {
      id: playerId,
      socketId,
      name,
      isCreator,
      role: null,
      isAlive: true,
      voted: false
    };

    this.players.push(player);

    if (isCreator) {
      this.creator = player;
    }

    return player;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(player => player.id !== playerId);
  }

  getPlayerBySocketId(socketId) {
    return this.players.find(player => player.socketId === socketId);
  }

  getPlayerById(playerId) {
    return this.players.find(player => player.id === playerId);
  }

  getPlayersInfo() {
    return this.players.map(player => ({
      id: player.id,
      name: player.name,
      isCreator: player.isCreator,
      isAlive: player.isAlive
    }));
  }

  getAlivePlayersInfo() {
    return this.players
      .filter(player => player.isAlive)
      .map(player => ({
        id: player.id,
        name: player.name
      }));
  }

  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  isEmpty() {
    return this.players.length === 0;
  }

  isGameStarted() {
    return this.phase !== 'lobby';
  }

  startGame() {
    // Rollen zufällig zuweisen
    const playerIds = this.players.map(player => player.id);
    const shuffled = [...playerIds].sort(() => 0.5 - Math.random());

    // Werwölfe zuweisen
    const werewolfIds = shuffled.slice(0, this.werewolfCount);

    this.players.forEach(player => {
      player.role = werewolfIds.includes(player.id) ? 'werewolf' : 'villager';
    });

    this.phase = 'night';
  }

  startNightPhase() {
    this.phase = 'night';
    this.werewolfVotes = {};
    this.players.forEach(player => {
      player.voted = false;
    });
  }

  startDayPhase() {
    this.phase = 'day';
    this.villagerVotes = {};
    this.players.forEach(player => {
      player.voted = false;
    });
  }

  werewolfVote(wolfId, targetId) {
    const wolf = this.getPlayerById(wolfId);
    if (wolf && wolf.role === 'werewolf' && wolf.isAlive) {
      this.werewolfVotes[wolfId] = targetId;
      wolf.voted = true;
    }
  }

  villagerVote(voterId, targetId) {
    const voter = this.getPlayerById(voterId);
    if (voter && voter.isAlive) {
      this.villagerVotes[voterId] = targetId;
      voter.voted = true;
    }
  }

  allWerewolvesVoted() {
    return this.getWerewolves()
      .filter(wolf => wolf.isAlive)
      .every(wolf => wolf.voted);
  }

  allPlayersVoted() {
    return this.players
      .filter(player => player.isAlive)
      .every(player => player.voted);
  }

  resolveWerewolfVotes() {
    const votes = {};

    Object.values(this.werewolfVotes).forEach(targetId => {
      votes[targetId] = (votes[targetId] || 0) + 1;
    });

    let maxVotes = 0;
    let victim = null;

    Object.entries(votes).forEach(([targetId, voteCount]) => {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        victim = this.getPlayerById(targetId);
      }
    });

    return victim;
  }

  resolveVillagerVotes() {
    const votes = {};

    Object.values(this.villagerVotes).forEach(targetId => {
      votes[targetId] = (votes[targetId] || 0) + 1;
    });

    let maxVotes = 0;
    let victim = null;

    Object.entries(votes).forEach(([targetId, voteCount]) => {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        victim = this.getPlayerById(targetId);
      }
    });

    return victim;
  }

  getVoteCounts() {
    const voteCounts = {};

    this.players
      .filter(player => player.isAlive)
      .forEach(player => {
        voteCounts[player.id] = 0;
      });

    Object.values(this.villagerVotes).forEach(targetId => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    return voteCounts;
  }

  eliminatePlayer(playerId) {
    const player = this.getPlayerById(playerId);
    if (player) {
      player.isAlive = false;
    }
  }

  getWerewolves() {
    return this.players.filter(player => player.role === 'werewolf');
  }

  getAliveWerewolves() {
    return this.players.filter(player => player.role === 'werewolf' && player.isAlive);
  }

  getAliveVillagers() {
    return this.players.filter(player => player.role === 'villager' && player.isAlive);
  }

  checkGameEnd() {
    const aliveWerewolves = this.getAliveWerewolves().length;
    const aliveVillagers = this.getAliveVillagers().length;

    return aliveWerewolves === 0 || aliveWerewolves >= aliveVillagers;
  }

  getWinner() {
    const aliveWerewolves = this.getAliveWerewolves().length;

    if (aliveWerewolves === 0) {
      return 'villagers';
    } else {
      return 'werewolves';
    }
  }
}

module.exports = { Room };

