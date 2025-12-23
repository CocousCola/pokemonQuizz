import pokemonService from './pokemonService.js';

class GameManager {
    constructor() {
        this.games = new Map();
        this.playerColors = ['#FF0000', '#3B4CCA', '#8BAC0F', '#FFDE00', '#CC0000', '#B3A125', '#306230', '#0F380F', '#FFFFFF', '#555555'];
    }

    createGame(hostSocketId) {
        let code;
        do {
            code = Math.floor(1000 + Math.random() * 9000).toString();
        } while (this.games.has(code));

        const game = {
            code,
            host: hostSocketId,
            players: new Map(),
            status: 'lobby',
            currentQuestionIndex: 0,
            questions: [],
            questionStartTime: null,
            timer: null,
            settings: { mode: 'CLASSIC', limit: 12 }
        };

        this.games.set(code, game);
        return game;
    }

    getGame(code) {
        return this.games.get(code);
    }

    joinGame(code, socketId, pseudo, trainer) {
        const game = this.games.get(code);
        if (!game) return { error: "Cette arène n'existe pas" };
        if (game.status !== 'lobby') return { error: "Le combat a déjà commencé !" };
        if (game.players.size >= 10) return { error: "Arène complète ! (10/10 dresseurs)" };
        
        for (const p of game.players.values()) {
            if (p.pseudo.toLowerCase() === pseudo.toLowerCase()) {
                return { error: "Ce nom de dresseur est déjà pris" };
            }
        }

        const player = {
            id: socketId,
            pseudo,
            trainer: trainer.id,
            trainerName: trainer.name,
            trainerSprite: `/trainers/${trainer.id}.png`,
            trainerSpriteId: trainer.spriteId,
            color: this.playerColors[game.players.size % this.playerColors.length],
            score: 0,
            hasAnswered: false,
            lastAnswerTime: null,
            isCorrect: false,
            currentStreak: 0,
            totalPointsGained: 0
        };

        game.players.set(socketId, player);
        return { game, player };
    }

    async startGame(code, settings) {
        const game = this.games.get(code);
        if (!game) return null;

        game.status = 'playing';
        game.settings = { ...game.settings, ...settings };
        
        // Handle Marathon Mode or Survival
        let count = game.settings.limit || 12;
        let timeLimit = 15; // Default Classic

        if (game.settings.mode === 'MARATHON') {
            count = 151;
            timeLimit = 30;
        } else if (game.settings.mode === 'SURVIVAL') {
            count = 100; // Large pool for survival
            timeLimit = 12; // Start faster
            
            // Initialize Lives (Default 4 if not set)
            const initialLives = game.settings.lives || 4;
            
            for (const player of game.players.values()) {
                player.lives = initialLives;
                player.isEliminated = false;
            }
        } else if (game.settings.mode === 'ORTHOGRAPH') {
            timeLimit = 20;
        }
        
        game.questions = await pokemonService.generateQuestions(count, game.settings.mode);
        game.currentQuestionIndex = -1;
        game.timeLimit = timeLimit;
        
        return game;
    }

    submitAnswer(code, socketId, answer) {
        const game = this.games.get(code);
        if (!game || game.status !== 'playing') return null;

        const player = game.players.get(socketId);
        if (!player || player.hasAnswered) return null;

        const currentQuestion = game.questions[game.currentQuestionIndex];
        const now = Date.now();
        const timeTaken = (now - game.questionStartTime) / 1000;
        
        player.hasAnswered = true;
        player.lastAnswerTime = timeTaken;
        
        let isCorrect = false;
        
        if (currentQuestion.inputType === 'TEXT') {
            isCorrect = pokemonService.isAnswerValid(answer, currentQuestion.answer, 2);
        } else {
            const selectedOption = currentQuestion.options[answer];
            isCorrect = (selectedOption === currentQuestion.answer);
        }

        player.isCorrect = isCorrect;
        
        if (isCorrect) {
            const bonus = Math.max(0, 500 - Math.floor(timeTaken * 33.3));
            const points = 1000 + bonus;
            
            player.totalPointsGained = points;
            player.score += points;
            player.currentStreak++;
        } else {
            player.totalPointsGained = 0;
            player.currentStreak = 0;
            
            // Survival Damage (Immediate)
            if (game.settings.mode === 'SURVIVAL' && !player.isEliminated) {
                player.lives -= 1;
                if (player.lives <= 0) {
                    player.lives = 0;
                    player.isEliminated = true;
                }
            }
        }

        // Check if all active players have answered
        let allAnswered = true;
        for (const p of game.players.values()) {
            if (!p.hasAnswered) {
                allAnswered = false;
                break;
            }
        }

        return {
            player,
            allAnswered
        };
    }

    nextQuestion(code) {
        const game = this.games.get(code);
        if (!game) return null;

        game.currentQuestionIndex++;
        
        // Speed Up Logic for Survival
        if (game.settings.mode === 'SURVIVAL' && game.currentQuestionIndex > 0 && game.currentQuestionIndex % 5 === 0) {
            game.timeLimit = Math.max(5, game.timeLimit - 2); // Reduce by 2s every 5 questions, min 5s
        }

        for (const player of game.players.values()) {
            player.hasAnswered = false;
            player.isCorrect = false;
            player.totalPointsGained = 0;
        }
        
        // Check Survival Win Condition (1 survivor)
        if (game.settings.mode === 'SURVIVAL') {
            const survivors = Array.from(game.players.values()).filter(p => !p.isEliminated);
            if (survivors.length <= 1 && game.players.size > 1) {
                 // Game Over if 1 or 0 survivors (unless playing alone)
                 game.status = 'finished';
                 return { status: 'finished' };
            }
        }

        if (game.currentQuestionIndex >= game.questions.length) {
            game.status = 'finished';
            return { status: 'finished' };
        }

        return {
            status: 'playing',
            question: game.questions[game.currentQuestionIndex],
            index: game.currentQuestionIndex
        };
    }

    getFastestPlayer(code) {
        const game = this.games.get(code);
        if (!game) return null;
        
        const correctPlayers = Array.from(game.players.values()).filter(p => p.isCorrect);
        if (correctPlayers.length === 0) return null;
        
        correctPlayers.sort((a, b) => a.lastAnswerTime - b.lastAnswerTime);
        return correctPlayers[0];
    }

    removePlayer(socketId) {
        for (const [code, game] of this.games.entries()) {
            if (game.players.has(socketId)) {
                const player = game.players.get(socketId);
                game.players.delete(socketId);
                return { code, player, hostLeft: false };
            }
            if (game.host === socketId) {
                this.games.delete(code);
                return { code, hostLeft: true };
            }
        }
        return null;
    }

    getLeaderboard(code) {
        const game = this.games.get(code);
        if (!game) return [];
        return Array.from(game.players.values())
            .sort((a, b) => b.score - a.score)
            .map((p, index) => ({ ...p, position: index + 1 }));
    }

    checkRoundEnd(code) {
        const game = this.games.get(code);
        if (!game || game.settings.mode !== 'SURVIVAL') return;

        for (const player of game.players.values()) {
            // If player hasn't answered and isn't eliminated yet -> lose a life
            if (!player.hasAnswered && !player.isEliminated) {
                player.lives -= 1;
                if (player.lives <= 0) {
                    player.lives = 0;
                    player.isEliminated = true;
                }
            }
        }
    }
}

export default new GameManager();