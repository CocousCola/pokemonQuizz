const socket = io();

// State
let gameCode = null;
let currentQuestion = null;
let timerInterval = null;
let timeLeft = 15;
let nextQuestionTimeout = null;
let allPlayers = []; 
let previousRanks = {}; // { playerId: rankIndex }
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
    if (config.mode === 'MARATHON' || config.mode === 'ORTHOGRAPH') timeLeft = 20;
    
    const bar = document.getElementById('timer-bar-fill');
    const sprite = document.getElementById('pokemon-sprite');
    
    if (!bar) return;

    bar.style.width = '100%';
    bar.style.backgroundColor = 'var(--poke-green)';
    
    if (timerInterval) clearInterval(timerInterval);
    
    const totalTime = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        const pct = (timeLeft / totalTime) * 100;
        bar.style.width = `${pct}%`;
        
        // Progressive Reveal Logic for MARATHON - REMOVED per request
        /*
        if (config.mode === 'MARATHON') {
             // Logic removed to keep image hidden/placeholder
        }
        */
        
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
    allPlayers = players;
    const list = document.getElementById('leaderboard-list');
    
    if (list) {
        list.innerHTML = '';
        const maxScore = Math.max(...players.map(p => p.score), 1);

        players.forEach((p, i) => {
            // Rank Logic
            let rankIcon = '<span class="rank-change rank-same">➖</span>';
            const currentRank = i;
            
            if (previousRanks[p.id] !== undefined) {
                const prev = previousRanks[p.id];
                if (currentRank < prev) { // Improved (lower index is better)
                    rankIcon = '<span class="rank-change rank-up">⬆️</span>';
                } else if (currentRank > prev) {
                    rankIcon = '<span class="rank-change rank-down">⬇️</span>';
                }
            }

            const div = document.createElement('div');
            div.className = 'leaderboard-item slide-in';
            div.style.animationDelay = `${i * 0.1}s`;
            const imgUrl = getAvatarUrl(p.trainerSpriteId);
            const barWidth = Math.max((p.score / maxScore) * 100, 5);
            
            div.innerHTML = `
                <img src="${imgUrl}" class="leaderboard-avatar">
                <div class="leaderboard-info">
                    <span class="leaderboard-pseudo">${rankIcon} #${i+1} ${p.pseudo}</span>
                    <span class="leaderboard-score-text">${p.score}</span>
                </div>
                <div class="leaderboard-bar-container">
                    <div class="leaderboard-bar" style="width: ${barWidth}%; background-color: ${p.color}"></div>
                </div>
            `;
            list.appendChild(div);
        });
        
        // Update ranks
        const newRanks = {};
        players.forEach((p, i) => { newRanks[p.id] = i; });
        previousRanks = newRanks;
    }
}

function updateActivePlayers() {
    const container = document.getElementById('active-players');
    if (!container) return;
    
    container.innerHTML = '';
    allPlayers.forEach(p => {
        const div = document.createElement('div');
        div.className = 'mini-player-card';
        div.setAttribute('data-id', p.id);
        const imgUrl = getAvatarUrl(p.trainerSpriteId);
        
        div.innerHTML = `
            <img src="${imgUrl}">
            <div class="status-indicator"></div>
        `;
        container.appendChild(div);
    });
}

// --- Socket Events ---

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

// UI Handlers
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

document.addEventListener('DOMContentLoaded', () => {
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
    allPlayers = data.players;
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
    showScreen('question');
    popups.result.classList.add('hidden');
    
    currentQuestion = data.question;
    document.getElementById('current-q').textContent = data.questionNumber;
    
    updateActivePlayers();
    startTimer();
    
    document.getElementById('question-text').textContent = currentQuestion.text;
    const sprite = document.getElementById('pokemon-sprite');
    
    // Reset filters
    sprite.className = 'pixel-art'; // Base class
    sprite.style.filter = 'none';

    if (currentQuestion.hideSprite) {
        sprite.classList.add('hidden');
    } else {
        sprite.classList.remove('hidden');
        
        if (config.mode === 'MARATHON') {
             sprite.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
             sprite.style.filter = 'none';
        } else {
             sprite.src = currentQuestion.pokemon.sprite;
             
            // Apply Visual Effects
            if (currentQuestion.forceShadow || config.mode === 'SHADOW') {
                sprite.classList.add('shadow');
            } 
            if (currentQuestion.forceBlur) {
                sprite.classList.add('blur');
            }
            if (currentQuestion.type.includes('WHO_IS') && currentQuestion.inputType !== 'TEXT') {
                sprite.classList.add('shadow'); // Classic WHO IS gets shadow
            }
        }
    }

    const optionsGrid = document.getElementById('options-grid');
    const textIndicator = document.getElementById('text-mode-indicator');
    const textPlayers = document.getElementById('text-input-players');
    
    optionsGrid.innerHTML = '';
    
    if (currentQuestion.inputType === 'TEXT') {
        if(textIndicator) {
            textIndicator.classList.remove('hidden');
            if (textPlayers) {
                 textPlayers.innerHTML = '';
                 allPlayers.forEach(p => {
                     const div = document.createElement('div');
                     div.className = 'mini-player-pill';
                     div.setAttribute('data-id', p.id);
                     const imgUrl = getAvatarUrl(p.trainerSpriteId);
                     div.innerHTML = `<img src="${imgUrl}"> <span>${p.pseudo}</span>`;
                     textPlayers.appendChild(div);
                 });
             }
        }
        optionsGrid.classList.add('hidden');
    } else {
        if(textIndicator) textIndicator.classList.add('hidden');
        optionsGrid.classList.remove('hidden');
        
        currentQuestion.options.forEach((opt, i) => {
            const div = document.createElement('div');
            div.className = `option-item option-${i}`;
            div.innerHTML = `${shapeIcons[i]} <span>${opt}</span>`;
            optionsGrid.appendChild(div);
        });
    }
});

socket.on('player-answered', (data) => {
    const playerCard = document.querySelector(`.mini-player-card[data-id="${data.playerId}"]`);
    if (playerCard) {
        playerCard.classList.add('answered');
        const img = playerCard.querySelector('img');
        if(img) img.style.opacity = '0.5';
    }
    
    // New logic for text mode players
    const textPlayerPill = document.querySelector(`.mini-player-pill[data-id="${data.playerId}"]`);
    if (textPlayerPill) {
        textPlayerPill.classList.add('answered-green');
    }
});

socket.on('question-results', (data) => {
    // Show results immediately (server controls timing)
    stopTimer();
    
    // Ensure bar goes to 0 visually
    const bar = document.getElementById('timer-bar-fill');
    if(bar) bar.style.width = '0%';

    showResultPopup(data);
});

function showResultPopup(data) {
    const popup = popups.result;
    const sprite = document.getElementById('result-sprite');
    
    // IMAGE RESTAURÉE (Visible during reveal)
    if (currentQuestion.pokemon.sprite) {
        sprite.src = currentQuestion.pokemon.sprite;
        sprite.classList.remove('hidden', 'blur', 'shadow', 'silhouette');
        sprite.style.filter = 'none'; // Clear all filters for reveal
    } else {
        sprite.classList.add('hidden');
    }
    
    document.getElementById('correct-answer').textContent = data.correctAnswer;
    
    const winnerEl = document.getElementById('round-winner');
    const timeEl = document.getElementById('round-time');
    const winnerBox = document.querySelector('.winner-box');
    
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
        socket.emit('request-leaderboard', { code: gameCode });
    }, 6000);
}

socket.on('leaderboard', (data) => {
    popups.result.classList.add('hidden');
    
    if (!screens.gameOver.classList.contains('hidden')) return;
    
    showScreen('leaderboard');
    updateLeaderboard(data.players);
    
    if (nextQuestionTimeout) clearTimeout(nextQuestionTimeout);
    
    nextQuestionTimeout = setTimeout(() => {
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