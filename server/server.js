import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLocalIP } from './utils/ipDetector.js';
import pokemonService from './pokemonService.js';
import gameManager from './gameManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const LOCAL_IP = getLocalIP();

// Middleware
app.use(express.static(path.join(rootDir, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'host.html'));
});

app.get('/player', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'player.html'));
});

// Socket.IO Logic
io.on('connection', (socket) => {
    // Determine the Player URL
    // If on Render, use the external URL provided by environment variable
    // Otherwise use the local IP
    let playerUrl;
    if (process.env.RENDER_EXTERNAL_URL) {
        playerUrl = `${process.env.RENDER_EXTERNAL_URL}/player.html`;
    } else {
        playerUrl = `http://${LOCAL_IP}:${PORT}/player.html`;
    }

    // Send server info to client for QR Code generation
    socket.emit('server-info', {
        url: playerUrl
    });

    socket.on('create-game', () => {
        const game = gameManager.createGame(socket.id);
        socket.join(game.code);
        socket.emit('game-created', { code: game.code });
        console.log(`Game created: ${game.code}`);
    });

    socket.on('join-game', ({ code, pseudo, trainer }) => {
        const result = gameManager.joinGame(code, socket.id, pseudo, trainer);
        
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        const { game, player } = result;
        socket.join(code);
        
        // Notify the player
        socket.emit('joined-successfully', { player, gameCode: code });
        
        // Notify the host and other players
        io.to(code).emit('player-joined', player);
        io.to(code).emit('lobby-update', { 
            players: Array.from(game.players.values()) 
        });
        
        console.log(`Player ${pseudo} joined game ${code}`);
    });

    socket.on('start-game', async ({ code, settings }) => {
        // settings default to CLASSIC if not provided
        const game = await gameManager.startGame(code, settings || { mode: 'CLASSIC' });
        if (game) {
            io.to(code).emit('game-started', {
                totalQuestions: game.questions.length,
                mode: game.settings.mode
            });
            sendNextQuestion(code);
        }
    });

    socket.on('answer-question', ({ code, answer }) => {
        const result = gameManager.submitAnswer(code, socket.id, answer);
        if (result) {
            const { player, allAnswered } = result;
            io.to(code).emit('player-answered', { 
                playerId: player.id, 
                pseudo: player.pseudo 
            });

            if (allAnswered) {
                revealResults(code);
            }
        }
    });

    socket.on('next-question', ({ code }) => {
        sendNextQuestion(code);
    });

    socket.on('request-leaderboard', ({ code }) => {
        const leaderboard = gameManager.getLeaderboard(code);
        io.to(code).emit('leaderboard', { players: leaderboard });
    });

    socket.on('disconnect', () => {
        const result = gameManager.removePlayer(socket.id);
        if (result) {
            const { code, player, hostLeft } = result;
            if (hostLeft) {
                io.to(code).emit('error', { message: "L'hôte a quitté la partie." });
            } else if (player) {
                io.to(code).emit('player-left', { 
                    playerId: player.id, 
                    pseudo: player.pseudo 
                });
                
                const game = gameManager.getGame(code);
                if (game) {
                    io.to(code).emit('lobby-update', { 
                        players: Array.from(game.players.values()) 
                    });
                }
            }
        }
    });
});

function sendNextQuestion(code) {
    const game = gameManager.getGame(code);
    if (!game) return;

    const result = gameManager.nextQuestion(code);
    if (result.status === 'finished') {
        const leaderboard = gameManager.getLeaderboard(code);
        io.to(code).emit('game-over', { 
            finalLeaderboard: leaderboard,
            winner: leaderboard[0]
        });
    } else {
        game.questionStartTime = Date.now();
        io.to(code).emit('question', {
            question: result.question,
            questionNumber: result.index + 1,
            totalQuestions: game.questions.length
        });

        // Set server-side timeout
        if (game.timer) clearTimeout(game.timer);
        game.timer = setTimeout(() => {
            revealResults(code);
        }, 15500); // 15s + buffer
    }
}

function revealResults(code) {
    const game = gameManager.getGame(code);
    if (!game) return;
    
    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }

    const currentQuestion = game.questions[game.currentQuestionIndex];
    const playerResults = Array.from(game.players.values()).map(p => ({
        id: p.id,
        pseudo: p.pseudo,
        isCorrect: p.isCorrect,
        pointsGained: p.totalPointsGained,
        score: p.score,
        trainerSpriteId: p.trainerSpriteId
    }));

    const fastest = gameManager.getFastestPlayer(code);
    
    io.to(code).emit('question-results', {
        correctAnswer: currentQuestion.answer,
        extra: currentQuestion.extra || '',
        playerResults,
        fastest: fastest ? { pseudo: fastest.pseudo, time: fastest.lastAnswerTime.toFixed(2) } : null
    });

    // Removed automatic leaderboard emission to let client control flow via request-leaderboard
}

// Start Server
async function start() {
    await pokemonService.init();
    
    // Get all IPs for debugging
    const os = await import('os');
    const interfaces = os.networkInterfaces();
    const allIps = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                allIps.push(`${name}: ${iface.address}`);
            }
        }
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log('\n' + '='.repeat(50));
        console.log('🎮  POKÉMON QUIZ BATTLE - GÉNÉRATION 1  🎮');
        console.log('='.repeat(50));
        console.log(`\n📡  SERVEUR DÉMARRÉ !`);
        console.log(`\n📍  ADRESSES DÉTECTÉES :`);
        allIps.forEach(ip => console.log(`   - ${ip}`));
        console.log(`\n📺  ÉCRAN TV (Principal): http://${LOCAL_IP}:${PORT}`);
        console.log(`📱  JOUEURS (Mobile):    http://${LOCAL_IP}:${PORT}/player.html`);
        console.log(`\n💡  SI LE MOBILE NE MARCHE PAS, ESSAYE UNE AUTRE IP DE LA LISTE`);
        console.log('='.repeat(50) + '\n');
    });
}

start();
