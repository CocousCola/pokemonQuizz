import pokemonService from './pokemonService.js';

class GameManager {
    constructor() {
        this.games = new Map();
        this.playerColors = ['#FF0000', '#3B4CCA', '#8BAC0F', '#FFDE00']; // Rouge, Bleu, Vert, Jaune
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
            timer: null
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
        if (game.players.size >= 4) return { error: "Arène complète ! (4/4 dresseurs)" };
        
        // Check if pseudo exists
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
            color: this.playerColors[game.players.size],
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

    async startGame(code) {
        const game = this.games.get(code);
        if (!game) return null;

        game.status = 'playing';
        game.questions = await pokemonService.generateQuestions(12);
        game.currentQuestionIndex = 0;
        
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
        
        if (answer === currentQuestion.answer) {
            player.isCorrect = true;
            // Points calculation: 1000 base + (500 - (10 * sec))
            const bonus = Math.max(0, 500 - Math.floor(timeTaken * 33.3)); // 15 sec max -> 500 / 15 = 33.3 per sec
            const points = 1000 + bonus;
            player.totalPointsGained = points;
            player.score += points;
            player.currentStreak++;
        } else {
            player.isCorrect = false;
            player.totalPointsGained = 0;
            player.currentStreak = 0;
        }

        return {
            player,
            allAnswered: Array.from(game.players.values()).every(p => p.hasAnswered)
        };
    }

    nextQuestion(code) {
        const game = this.games.get(code);
        if (!game) return null;

        game.currentQuestionIndex++;
        
        // Reset player states for next question
        for (const player of game.players.values()) {
            player.hasAnswered = false;
            player.isCorrect = false;
            player.totalPointsGained = 0;
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
}

export default new GameManager();
