const socket = io();

// State
let gameCode = null;
let currentQuestion = null;
let timerInterval = null;
let timeLeft = 15;
let nextQuestionTimeout = null;
let config = {
    mode: 'CLASSIC',
    limit: 12
};

const screens = {
    config: document.getElementById('config-screen'),
    lobby: document.getElementById('lobby-screen'),
    question: document.getElementById('question-screen'),
    leaderboard: document.getElementById('leaderboard-screen'),
    gameOver: document.getElementById('game-over-screen')
};

const popups = {
    result: document.getElementById('result-popup')
};

// SVG Icons for Options
const shapeIcons = [
    `<svg viewBox="0 0 60 60" class="option-icon"><circle cx="30" cy="30" r="25" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><rect x="10" y="10" width="40" height="40" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><rect x="5" y="15" width="50" height="30" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><polygon points="30,5 35,20 50,23 40,35 43,50 30,42 17,50 20,35 10,23 25,20" fill="white"/></svg>`
];

// --- Helpers ---

// Helper pour les images HD
function getAvatarUrl(dexId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
}

function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    if (screens[id]) screens[id].classList.remove('hidden');
}

function startTimer() {
    timeLeft = 15;
    if (config.mode === 'SURVIVAL') timeLeft = 10;
    
    const bar = document.getElementById('timer-bar-fill');
    if (!bar) return;

    bar.style.width = '100%';
    bar.style.backgroundColor = 'var(--poke-green)';
    
    if (timerInterval) clearInterval(timerInterval);
    
    const totalTime = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        const pct = (timeLeft / totalTime) * 100;
        bar.style.width = `${pct}%`;
        
        if (timeLeft < 5) {
            bar.style.backgroundColor = 'var(--poke-red)';
        } else if (timeLeft < 10) {
            bar.style.backgroundColor = 'var(--poke-yellow)';
        }
        
        if (timeLeft <= 0) stopTimer();
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateLeaderboard(players) {
    console.log("Updating Leaderboard with", players.length, "players");
    const list = document.getElementById('leaderboard-list');
    
    if (list) {
        list.innerHTML = '';
        
        // Find max score for bar calculation
        const maxScore = Math.max(...players.map(p => p.score), 1);

        players.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-item slide-in';
            div.style.animationDelay = `${i * 0.1}s`;
            const imgUrl = getAvatarUrl(p.trainerSpriteId);
            const barWidth = Math.max((p.score / maxScore) * 100, 5); // Min 5% width
            
            div.innerHTML = `
                <img src="${imgUrl}" class="leaderboard-avatar">
                <div class="leaderboard-info">
                    <span class="leaderboard-pseudo">#${i+1} ${p.pseudo}</span>
                    <span class="leaderboard-score-text">${p.score}</span>
                </div>
                <div class="leaderboard-bar-container">
                    <div class="leaderboard-bar" style="width: ${barWidth}%; background-color: ${p.color}"></div>
                </div>
            `;
            list.appendChild(div);
        });
    }
}

// --- Socket Events ---

// Socket Connection
socket.on('connect', () => {
    console.log('Connecté au serveur');
});

socket.on('server-info', (data) => {
    const playerURL = data.url;
    const qrEl = document.getElementById("qrcode");
    if (qrEl) {
        qrEl.innerHTML = "";
        new QRCode(qrEl, {
            text: playerURL,
            width: 150,
            height: 150,
            colorDark: "#0f380f",
            colorLight: "#9bbc0f",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
    const urlEl = document.getElementById("player-url");
    if (urlEl) urlEl.textContent = playerURL;
});

// UI Handlers (Global)
window.selectMode = function(mode) {
    config.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
    if(btn) btn.classList.add('selected');
    
    const questionsConfig = document.getElementById('questions-config');
    const questionsRange = document.getElementById('questions-range');
    const questionsVal = document.getElementById('questions-val');
    
    if (mode === 'MARATHON') {
        questionsConfig.style.opacity = '0.5';
        questionsConfig.style.pointerEvents = 'none';
        questionsRange.disabled = true;
        config.limit = 151;
        questionsVal.textContent = "151 POKÉMON (FIXE)";
    } else {
        questionsConfig.style.opacity = '1';
        questionsConfig.style.pointerEvents = 'auto';
        questionsRange.disabled = false;
        config.limit = parseInt(questionsRange.value);
        questionsVal.textContent = `${config.limit} QUESTIONS`;
    }
};

window.updateRangeVal = function(val) {
    if (config.mode === 'MARATHON') return;
    config.limit = parseInt(val);
    document.getElementById('questions-val').textContent = `${val} QUESTIONS`;
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Hide popup on load
    if(popups.result) popups.result.classList.add('hidden');

    document.getElementById('create-lobby-btn').addEventListener('click', () => {
        socket.emit('create-game');
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
        socket.emit('start-game', { code: gameCode, settings: config });
    });
});

socket.on('game-created', (data) => {
    gameCode = data.code;
    document.getElementById('display-game-code').textContent = gameCode;
    document.getElementById('mode-display').textContent = `MODE: ${config.mode}`;
    showScreen('lobby');
});

socket.on('lobby-update', (data) => {
    const list = document.getElementById('players-list');
    const countEl = document.getElementById('player-count');
    const startBtn = document.getElementById('start-game-btn');
    
    if (list) {
        list.innerHTML = '';
        data.players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'player-card fade-in';
            const imgUrl = getAvatarUrl(p.trainerSpriteId);
            div.innerHTML = `
                <img src="${imgUrl}" alt="${p.pseudo}">
                <p>${p.pseudo}</p>
            `;
            list.appendChild(div);
        });
    }
    
    if (countEl) countEl.textContent = data.players.length;
    if (startBtn && data.players.length >= 1) {
        startBtn.classList.remove('hidden');
    }
});

socket.on('game-started', (data) => {
    document.getElementById('total-q').textContent = data.totalQuestions;
    showScreen('question');
});

socket.on('question', (data) => {
    console.log("New Question Received:", data);
    popups.result.classList.add('hidden');
    
    currentQuestion = data.question;
    document.getElementById('current-q').textContent = data.questionNumber;
    
    startTimer();
    
    document.getElementById('question-text').textContent = currentQuestion.text;
    const sprite = document.getElementById('pokemon-sprite');
    
    if (currentQuestion.hideSprite) {
        sprite.classList.add('hidden');
    } else {
        sprite.classList.remove('hidden');
        sprite.src = currentQuestion.pokemon.sprite;
        sprite.style.filter = 'none';
        
        if (config.mode === 'SHADOW') {
            sprite.style.filter = 'brightness(0)';
        } else if (currentQuestion.type.includes('WHO_IS') && currentQuestion.inputType !== 'TEXT') {
            sprite.classList.add('silhouette');
        } else {
            sprite.classList.remove('silhouette');
        }
    }

    const optionsGrid = document.getElementById('options-grid');
    optionsGrid.innerHTML = '';
    
    if (currentQuestion.inputType === 'TEXT') {
        document.getElementById('text-mode-indicator').classList.remove('hidden');
        optionsGrid.classList.add('hidden');
    } else {
        document.getElementById('text-mode-indicator').classList.add('hidden');
        optionsGrid.classList.remove('hidden');
        
        // Dynamic grid based on options length
        currentQuestion.options.forEach((opt, i) => {
            const div = document.createElement('div');
            // Add specific color class option-0, option-1 etc.
            div.className = `option-item option-${i}`;
            div.innerHTML = `${shapeIcons[i]} <span>${opt}</span>`;
            optionsGrid.appendChild(div);
        });
    }
});

socket.on('question-results', (data) => {
    console.log("Results Received:", data);
    stopTimer();
    
    const popup = popups.result;
    const sprite = document.getElementById('result-sprite');
    
    if (currentQuestion.pokemon.sprite) {
        sprite.src = currentQuestion.pokemon.sprite;
        sprite.classList.remove('hidden');
    } else {
        sprite.classList.add('hidden');
    }
    
    document.getElementById('correct-answer').textContent = data.correctAnswer;
    
    const winnerEl = document.getElementById('round-winner');
    const timeEl = document.getElementById('round-time');
    const winnerBox = document.querySelector('.winner-box');
    
    // Reset classes
    winnerBox.className = 'winner-box';
    
    if (data.fastest) {
        winnerEl.textContent = data.fastest.pseudo;
        timeEl.textContent = `${data.fastest.time}s`;
        winnerBox.classList.remove('hidden');
        winnerBox.style.backgroundColor = 'var(--poke-green)';
    } else {
        winnerEl.textContent = "Personne...";
        timeEl.textContent = "--";
        winnerBox.style.backgroundColor = 'var(--gb-darkest)';
    }
    
    popup.classList.remove('hidden');
    
    setTimeout(() => {
        console.log("Requesting Leaderboard...");
        socket.emit('request-leaderboard', { code: gameCode });
    }, 6000);
});

socket.on('leaderboard', (data) => {
    console.log("Leaderboard Received");
    popups.result.classList.add('hidden');
    
    if (!screens.gameOver.classList.contains('hidden')) return;
    
    showScreen('leaderboard');
    updateLeaderboard(data.players);
    
    if (nextQuestionTimeout) clearTimeout(nextQuestionTimeout);
    
    nextQuestionTimeout = setTimeout(() => {
        console.log("Triggering Next Question");
        socket.emit('next-question', { code: gameCode });
    }, 5000);
});

socket.on('game-over', (data) => {
    if (nextQuestionTimeout) clearTimeout(nextQuestionTimeout);
    showScreen('gameOver');
    const podium = document.getElementById('final-podium');
    podium.innerHTML = '';
    
    data.finalLeaderboard.slice(0, 3).forEach((player, i) => {
        const div = document.createElement('div');
        div.className = `podium-place place-${i+1}`;
        const imgUrl = getAvatarUrl(player.trainerSpriteId);
        
        div.innerHTML = `
            <div class="rank retro-font">${i+1}</div>
            <img src="${imgUrl}" alt="">
            <div class="name retro-font">${player.pseudo}</div>
            <div class="score text-pulse">${player.score} pts</div>
        `;
        podium.appendChild(div);
    });
    
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#FF0000', '#3B4CCA', '#FFDE00'] });
});