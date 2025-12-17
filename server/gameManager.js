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
            timer: null,
            settings: { mode: 'CLASSIC', limit: 12 } // Defaults
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
        if (game.players.size >= 10) return { error: "Arène complète ! (10/10 dresseurs)" }; // Max 10 players
        
        // ... (rest of checks)

        const player = {
            id: socketId,
            pseudo,
            trainer: trainer.id,
            trainerName: trainer.name,
            trainerSprite: `/trainers/${trainer.id}.png`,
            trainerSpriteId: trainer.spriteId,
            // Generate color based on index or random from a larger palette
            color: this.getPlayerColor(game.players.size),
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

    getPlayerColor(index) {
        const colors = [
            '#FF0000', '#3B4CCA', '#8BAC0F', '#FFDE00', 
            '#CC0000', '#B3A125', '#306230', '#0F380F',
            '#FFFFFF', '#555555'
        ];
        return colors[index % colors.length];
    }

    async startGame(code, settings) {
        const game = this.games.get(code);
        if (!game) return null;

        game.status = 'playing';
        game.settings = { ...game.settings, ...settings }; // Merge settings
        
        // Handle Marathon Mode or Survival
        let count = game.settings.limit || 12;
        if (game.settings.mode === 'MARATHON') count = 151;
        
        // Handle Marathon Mode or Survival
        let count = game.settings.limit || 12;
        let timeLimit = 15; // Default Classic

        if (game.settings.mode === 'MARATHON') {
            count = 151;
            timeLimit = 20;
        } else if (game.settings.mode === 'SURVIVAL') {
            timeLimit = 10;
        } else if (game.settings.mode === 'ORTHOGRAPH') {
            timeLimit = 20; // More time for typing
        }
        
        game.questions = await pokemonService.generateQuestions(count, game.settings.mode);
        game.currentQuestionIndex = -1;
        game.timeLimit = timeLimit; // Store for server.js
        
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
            // Answer is string, validate with Levenshtein
            isCorrect = pokemonService.isAnswerValid(answer, currentQuestion.answer, 2);
        } else {
            // Answer is index (0-3), check against options
            // currentQuestion.answer is the text value.
            // currentQuestion.options is array of text.
            // We need to check if options[answer] === currentQuestion.answer
            const selectedOption = currentQuestion.options[answer];
            isCorrect = (selectedOption === currentQuestion.answer);
        }

        player.isCorrect = isCorrect;
        
        if (isCorrect) {
            // Points calculation: 1000 base + (500 - (10 * sec))
            const bonus = Math.max(0, 500 - Math.floor(timeTaken * 33.3));
            const points = 1000 + bonus;
            
            player.totalPointsGained = points;
            player.score += points;
            player.currentStreak++;
        } else {
            player.totalPointsGained = 0;
            player.currentStreak = 0;
        }

        return {
            player,
            allAnswered: false // FORCE WAIT FOR TIMER (Suspense !)
        };
    }

    nextQuestion(code) {
        const game = this.games.get(code);
        if (!game) return null;

        // Determine fastest player for the PREVIOUS question before moving on
        // Actually, this is usually done in revealResults
        
        game.currentQuestionIndex++;
        
        // Reset player states for next question
        for (const player of game.players.values()) {
            player.hasAnswered = false;
            player.isCorrect = false;
            player.totalPointsGained = 0;
            // Keep score and streak
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
        
        // Filter correct answers
        const correctPlayers = Array.from(game.players.values()).filter(p => p.isCorrect);
        if (correctPlayers.length === 0) return null;
        
        // Sort by time
        correctPlayers.sort((a, b) => a.lastAnswerTime - b.lastAnswerTime);
        return correctPlayers[0];
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
