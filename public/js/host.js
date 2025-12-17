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

// Safety: Ensure popup is hidden on load
popups.result.classList.add('hidden');

// SVG Icons for Options
const shapeIcons = [
    `<svg viewBox="0 0 60 60" class="option-icon"><circle cx="30" cy="30" r="25" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><rect x="10" y="10" width="40" height="40" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><rect x="5" y="15" width="50" height="30" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><polygon points="30,5 35,20 50,23 40,35 43,50 30,42 17,50 20,35 10,23 25,20" fill="white"/></svg>`
];

// Socket Connection
socket.on('connect', () => {
    console.log('Connecté au serveur');
});

socket.on('server-info', (data) => {
    const playerURL = data.url;
    document.getElementById("qrcode").innerHTML = "";
    new QRCode(document.getElementById("qrcode"), {
        text: playerURL,
        width: 150,
        height: 150,
        colorDark: "#0f380f",
        colorLight: "#9bbc0f",
        correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById("player-url").textContent = playerURL;
});

// UI Handlers
window.selectMode = function(mode) {
    config.mode = mode;
    
    // Update visual selection
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
    if(btn) btn.classList.add('selected');
    
    // Handle Marathon Mode (Fixed 151 questions)
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
        // Restore slider value
        config.limit = parseInt(questionsRange.value);
        questionsVal.textContent = `${config.limit} QUESTIONS`;
    }
};

window.updateRangeVal = function(val) {
    if (config.mode === 'MARATHON') return; // Prevent changes
    config.limit = parseInt(val);
    document.getElementById('questions-val').textContent = `${val} QUESTIONS`;
};

document.getElementById('create-lobby-btn').addEventListener('click', () => {
    socket.emit('create-game');
});

socket.on('game-created', (data) => {
    gameCode = data.code;
    document.getElementById('display-game-code').textContent = gameCode;
    document.getElementById('mode-display').textContent = `MODE: ${config.mode}`;
    showScreen('lobby');
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    socket.emit('start-game', { code: gameCode, settings: config });
});

// Lobby Updates
socket.on('lobby-update', (data) => {
    const list = document.getElementById('players-list');
    const countEl = document.getElementById('player-count');
    const startBtn = document.getElementById('start-game-btn');
    
    list.innerHTML = '';
    data.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-card';
        div.innerHTML = `
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.trainerSpriteId}.png">
            <p>${p.pseudo}</p>
        `;
        list.appendChild(div);
    });
    
    countEl.textContent = data.players.length;
    if (data.players.length >= 1) { // Dev mode: 1 player allowed
        startBtn.classList.remove('hidden');
    }
});

// Game Logic
socket.on('game-started', (data) => {
    document.getElementById('total-q').textContent = data.totalQuestions;
    showScreen('question');
});

socket.on('question', (data) => {
    // Hide popup if open
    popups.result.classList.add('hidden');
    
    currentQuestion = data.question;
    document.getElementById('current-q').textContent = data.questionNumber;
    
    // Timer Reset
    startTimer();
    
    // Display Content
    document.getElementById('question-text').textContent = currentQuestion.text;
    const sprite = document.getElementById('pokemon-sprite');
    sprite.src = currentQuestion.pokemon.sprite;
    sprite.style.filter = 'none'; // Reset filters
    
    // Mode specific handling
    if (config.mode === 'SHADOW') {
        sprite.style.filter = 'brightness(0)';
    }
    
    // Options
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    if (currentQuestion.inputType === 'QCM') {
        currentQuestion.options.forEach((opt, i) => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = `${shapeIcons[i]} <span>${opt}</span>`;
            grid.appendChild(div);
        });
    } else {
        grid.innerHTML = '<div class="retro-box blink" style="width:100%; text-align:center;">EN ATTENTE DE SAISIE...</div>';
    }
});

socket.on('player-answered', (data) => {
    // Show visual feedback on player card in lobby list style? 
    // Or maybe just a sound? For now, console log.
    // In V2 design, we don't have permanent player list on question screen (too crowded).
});

socket.on('question-results', (data) => {
    stopTimer();
    
    // Show Popup
    const popup = popups.result;
    const sprite = document.getElementById('result-sprite');
    
    // Show correct sprite
    const questionSprite = currentQuestion.pokemon.sprite;
    if (questionSprite) {
        sprite.src = questionSprite;
        sprite.classList.remove('hidden');
    } else {
        sprite.classList.add('hidden');
    }
    
    // Show correct answer text
    document.getElementById('correct-answer').textContent = data.correctAnswer;
    
    // Show Winner / Fastest Player
    const winnerEl = document.getElementById('round-winner');
    const timeEl = document.getElementById('round-time');
    const winnerBox = document.querySelector('.winner-box');
    
    if (data.fastest) {
        winnerEl.textContent = data.fastest.pseudo;
        timeEl.textContent = `${data.fastest.time}s`;
        winnerBox.classList.remove('hidden'); // Ensure visible
        winnerBox.style.backgroundColor = 'var(--gb-dark)'; // Green bg
    } else {
        winnerEl.textContent = "Personne...";
        timeEl.textContent = "--";
        winnerBox.style.backgroundColor = 'var(--gb-darkest)'; // Darker bg for fail
    }
    
    // Display extra info if any
    // document.getElementById('extra-info').textContent = data.extra || ''; // Not present in new popup design yet, let's skip or add later
    
    popup.classList.remove('hidden');
    
    // Wait longer (6s) to let people read
    setTimeout(() => {
        socket.emit('request-leaderboard', { code: gameCode });
    }, 6000);
});

socket.on('leaderboard', (data) => {
    // Hide previous screens overlay
    popups.result.classList.add('hidden');
    
    // Check if game is actually over
    if (!screens.gameOver.classList.contains('hidden')) return;
    
    showScreen('leaderboard');
    updateLeaderboard(data.players);
    
    // Auto-advance logic
    if (nextQuestionTimeout) clearTimeout(nextQuestionTimeout);
    
    // Force next question after 5 seconds
    nextQuestionTimeout = setTimeout(() => {
        socket.emit('next-question', { code: gameCode });
    }, 5000);
});

// Removed manual forceNext functions as requested

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


// Helpers
function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[id].classList.remove('hidden');
}

function startTimer() {
    timeLeft = 15;
    if (config.mode === 'SURVIVAL') timeLeft = 10;
    
    const bar = document.getElementById('timer-bar-fill');
    // Ensure bar exists before accessing style
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
