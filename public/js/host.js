const socket = io();

// State
let gameCode = null;
let currentQuestion = null;
let timerInterval = null;
let timeLeft = 15;
let nextQuestionTimeout = null;
let cryCountdownInterval = null; // New
let allPlayers = []; 
let previousRanks = {}; // { playerId: rankIndex }

// ... (keep existing code) ...

function playCryWithCountdown(url) {
    const overlay = document.getElementById('countdown-overlay');
    const cryPlayer = document.getElementById('cry-player');
    let count = 3;

    if (!overlay || !cryPlayer) return;

    // Reset previous
    if (cryCountdownInterval) clearInterval(cryCountdownInterval);
    cryPlayer.pause();
    
    overlay.textContent = count;
    overlay.classList.remove('hidden');

    cryCountdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            overlay.textContent = count;
        } else {
            clearInterval(cryCountdownInterval);
            overlay.classList.add('hidden');
            cryPlayer.src = url;
            cryPlayer.volume = 1.0;
            cryPlayer.play().catch(e => console.log("Audio play failed:", e));
        }
    }, 1000);
}
let config = {
    mode: 'CLASSIC',
    limit: 12,
    lives: 4,
    generations: [1]
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
    if (config.mode === 'MARATHON') timeLeft = 30;
    if (config.mode === 'ORTHOGRAPH') timeLeft = 20;
    
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
            
            let barContent = '';
            let scoreDisplay = p.score;
            
            if (config.mode === 'SURVIVAL') {
                // Show Hearts
                let hearts = '';
                const lives = p.lives !== undefined ? p.lives : 0;
                for(let h=0; h < lives; h++) hearts += '❤️';
                
                if (p.isEliminated) {
                    hearts = '💀 K.O.';
                    div.style.opacity = '0.6';
                    div.style.filter = 'grayscale(100%)';
                }
                
                scoreDisplay = hearts;
                const lifePct = (lives / 4) * 100; 
                const barColor = p.isEliminated ? '#555' : '#ff0000';
                barContent = `<div class="leaderboard-bar" style="width: ${lifePct}%; background-color: ${barColor}"></div>`;
            } else {
                const barWidth = Math.max((p.score / maxScore) * 100, 5);
                barContent = `<div class="leaderboard-bar" style="width: ${barWidth}%; background-color: ${p.color}"></div>`;
            }
            
            div.innerHTML = `
                <img src="${imgUrl}" class="leaderboard-avatar">
                <div class="leaderboard-info">
                    <span class="leaderboard-pseudo">${rankIcon} #${i+1} ${p.pseudo}</span>
                    <span class="leaderboard-score-text">${scoreDisplay}</span>
                </div>
                <div class="leaderboard-bar-container">
                    ${barContent}
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
        if (config.mode === 'SURVIVAL' && p.isEliminated) {
            div.classList.add('eliminated-mini');
        }
        
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
    const standardConfig = document.getElementById('standard-config');
    const survivalConfig = document.getElementById('survival-config');
    const configTitle = document.getElementById('config-title');
    
    // Reset visibility
    questionsConfig.style.opacity = '1';
    questionsConfig.style.pointerEvents = 'auto';
    if(standardConfig) standardConfig.classList.remove('hidden');
    if(survivalConfig) survivalConfig.classList.add('hidden');
    if(configTitle) configTitle.textContent = "2. LONGUEUR DU QUIZ";
    
    const questionsVal = document.getElementById('questions-val');
    const questionsRange = document.getElementById('questions-range');

    if (mode === 'MARATHON') {
        questionsConfig.style.opacity = '0.5';
        questionsConfig.style.pointerEvents = 'none';
        if(questionsRange) questionsRange.disabled = true;
        config.limit = 151;
        if(questionsVal) questionsVal.textContent = "151 POKÉMON (FIXE)";

        // Force single generation for Marathon
        if (config.generations.length > 1) {
            config.generations = [config.generations[0]];
            updateGenUI();
        }
    } 
    else if (mode === 'SURVIVAL') {
        if(standardConfig) standardConfig.classList.add('hidden');
        if(survivalConfig) survivalConfig.classList.remove('hidden');
        if(configTitle) configTitle.textContent = "2. NOMBRE DE VIES";
        if(document.getElementById('lives-range')) config.lives = parseInt(document.getElementById('lives-range').value);
    } 
    else {
        questionsConfig.style.opacity = '1';
        questionsConfig.style.pointerEvents = 'auto';
        if(questionsRange) questionsRange.disabled = false;
        config.limit = parseInt(questionsRange.value);
        if(questionsVal) questionsVal.textContent = `${config.limit} QUESTIONS`;
    }
};

window.updateRangeVal = function(val) {
    if (config.mode === 'MARATHON') return;
    config.limit = parseInt(val);
    document.getElementById('questions-val').textContent = `${val} QUESTIONS`;
};

window.updateLivesVal = function(val) {
    config.lives = parseInt(val);
    document.getElementById('lives-val').textContent = `❤️ ${val} VIES`;
};

function updateGenUI() {
    document.querySelectorAll('.gen-btn').forEach(btn => {
        const g = parseInt(btn.getAttribute('data-gen'));
        if (config.generations.includes(g)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

window.toggleGen = function(gen) {
    gen = parseInt(gen);
    
    if (config.mode === 'MARATHON') {
        // Exclusive selection for Marathon
        config.generations = [gen];
    } else {
        const index = config.generations.indexOf(gen);
        if (index > -1) {
            // Can't remove if it's the only one
            if (config.generations.length > 1) {
                config.generations.splice(index, 1);
            }
        } else {
            config.generations.push(gen);
        }
    }
    
    updateGenUI();
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
    const warningEl = document.getElementById('min-player-warning');
    
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
    
    // Minimum Player Logic for Survival
    if (config.mode === 'SURVIVAL') {
        if (data.players.length < 2) {
            if(startBtn) startBtn.classList.add('hidden');
            if(warningEl) warningEl.classList.remove('hidden');
        } else {
            if(startBtn) startBtn.classList.remove('hidden');
            if(warningEl) warningEl.classList.add('hidden');
        }
    } else {
        if(warningEl) warningEl.classList.add('hidden');
        if (startBtn && data.players.length >= 1) {
            startBtn.classList.remove('hidden');
        }
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
    
    // Audio Handling (Cries)
    const cryPlayer = document.getElementById('cry-player');
    const countdownOverlay = document.getElementById('countdown-overlay');

    // Reset overlay
    if (countdownOverlay) countdownOverlay.classList.add('hidden');
    if (cryCountdownInterval) clearInterval(cryCountdownInterval);

    if (cryPlayer) {
        cryPlayer.pause();
        if (currentQuestion.audio) {
            playCryWithCountdown(currentQuestion.audio);
        }
    }

    // Reset filters
    sprite.className = 'pixel-art'; // Base class
    sprite.style.filter = '';

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
    
    // Stop Cry Audio if playing
    const cryPlayer = document.getElementById('cry-player');
    if (cryPlayer) cryPlayer.pause();
    if (cryCountdownInterval) clearInterval(cryCountdownInterval);
    const overlay = document.getElementById('countdown-overlay');
    if (overlay) overlay.classList.add('hidden');
    
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