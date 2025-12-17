const socket = io();

const screens = {
    lobby: document.getElementById('lobby-screen'),
    modeSelection: document.getElementById('mode-selection-screen'),
    question: document.getElementById('question-screen'),
    results: document.getElementById('results-screen'),
    leaderboard: document.getElementById('leaderboard-screen'),
    gameOver: document.getElementById('game-over-screen')
};

let gameCode = null;
let currentQuestion = null;
let timerInterval = null;
let timeLeft = 15;

// Helper pour les images HD
const getAvatarUrl = (dexId) => {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
};

// SVG Icons for Options
const shapeIcons = [
    `<svg viewBox="0 0 60 60" class="option-icon"><circle cx="30" cy="30" r="25" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><rect x="10" y="10" width="40" height="40" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><rect x="5" y="15" width="50" height="30" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" class="option-icon"><polygon points="30,5 35,20 50,23 40,35 43,50 30,42 17,50 20,35 10,23 25,20" fill="white"/></svg>`
];

// Socket connection
socket.on('connect', () => {
    console.log('Connecté au serveur');
});

socket.on('server-info', (data) => {
    const playerURL = data.url;
    
    // Clear previous QR code if any
    document.getElementById("qrcode").innerHTML = "";
    
    new QRCode(document.getElementById("qrcode"), {
        text: playerURL,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    document.getElementById("player-url").textContent = playerURL;
    
    // Auto-create game on load
    socket.emit('create-game');
});

socket.on('game-created', (data) => {
    gameCode = data.code;
    document.getElementById('display-game-code').textContent = gameCode;
});

socket.on('lobby-update', (data) => {
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');
    const startBtn = document.getElementById('start-btn');
    
    playersList.innerHTML = '';
    data.players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card fade-in';
        card.style.borderColor = player.color;
        const imgUrl = getAvatarUrl(player.trainerSpriteId);
        
        card.innerHTML = `
            <img src="${imgUrl}" alt="${player.trainerName}">
            <span>${player.pseudo}</span>
        `;
        playersList.appendChild(card);
    });
    
    playerCount.textContent = data.players.length;
    
    if (data.players.length >= 2) {
        startBtn.classList.remove('hidden');
    } else {
        startBtn.classList.add('hidden');
    }
});

// Mode Selection Logic
function selectMode(mode) {
    socket.emit('start-game', { code: gameCode, settings: { mode: mode } });
}

window.selectMode = selectMode;

document.getElementById('start-btn').addEventListener('click', () => {
    showScreen('modeSelection');
});

socket.on('game-started', (data) => {
    showScreen('question');
});

socket.on('question', (data) => {
    currentQuestion = data.question;
    showScreen('question');
    
    document.getElementById('current-q').textContent = data.questionNumber;
    document.getElementById('question-text').textContent = currentQuestion.text;
    
    const sprite = document.getElementById('pokemon-sprite');
    if (currentQuestion.hideSprite) {
        sprite.classList.add('hidden');
    } else {
        sprite.classList.remove('hidden');
        sprite.src = currentQuestion.pokemon.sprite;
        if (currentQuestion.type.includes('WHO_IS') && currentQuestion.inputType !== 'TEXT') {
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
        
        currentQuestion.options.forEach((opt, i) => {
            const div = document.createElement('div');
            div.className = `option-item option-${i}`;
            div.innerHTML = `${shapeIcons[i]} <span>${opt}</span>`;
            optionsGrid.appendChild(div);
        });
    }
    
    startTimer();
});

socket.on('player-answered', (data) => {
    const playerCard = document.querySelector(`.mini-player-card[data-id="${data.playerId}"]`);
    if (playerCard) {
        playerCard.classList.add('answered');
        const status = playerCard.querySelector('.status');
        status.textContent = 'A répondu !';
        status.style.color = 'green';
    }
});

socket.on('question-results', (data) => {
    stopTimer();
    showScreen('results');
    
    document.getElementById('correct-answer-text').textContent = `C'est ${data.correctAnswer} !`;
    const sprite = document.getElementById('reveal-sprite');
    if (currentQuestion.pokemon.sprite) {
        sprite.src = currentQuestion.pokemon.sprite;
        sprite.classList.remove('hidden');
    } else {
        sprite.classList.add('hidden');
    }
    document.getElementById('extra-info').textContent = data.extra || '';

    const fastestEl = document.getElementById('fastest-player-display');
    if (data.fastest) {
        fastestEl.classList.remove('hidden');
        document.getElementById('fastest-name').textContent = data.fastest.pseudo;
        document.getElementById('fastest-time').textContent = `${data.fastest.time}s`;
    } else {
        fastestEl.classList.add('hidden');
    }
    
    const summary = document.getElementById('points-summary');
    summary.innerHTML = '';
    const sortedResults = [...data.playerResults].sort((a, b) => b.pointsGained - a.pointsGained);
    sortedResults.forEach(res => {
        if (res.pointsGained > 0) {
            const div = document.createElement('div');
            div.className = 'result-point-item fade-in';
            div.innerHTML = `<span class="player-name">${res.pseudo}</span> <span class="points-plus">+${res.pointsGained}</span>`;
            summary.appendChild(div);
        }
    });
    
    setTimeout(() => {
        socket.emit('request-leaderboard', { code: gameCode });
    }, 4000);
});

socket.on('leaderboard', (data) => {
    if (screens.gameOver.classList.contains('hidden') === false) return;
    showScreen('leaderboard');
    updateLeaderboard(data.players);
    setTimeout(() => {
        socket.emit('next-question', { code: gameCode });
    }, 5000);
});

socket.on('game-over', (data) => {
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

function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

function updateLeaderboard(players) {
    const list = document.getElementById('leaderboard-list');
    const activePlayers = document.getElementById('active-players');
    if (list) {
        list.innerHTML = '';
        const maxScore = Math.max(...players.map(p => p.score), 1);
        players.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-item slide-in';
            div.style.animationDelay = `${i * 0.1}s`;
            const imgUrl = getAvatarUrl(p.trainerSpriteId);
            const barWidth = Math.max((p.score / maxScore) * 100, 5);
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
    if (activePlayers) {
        activePlayers.innerHTML = '';
        players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'mini-player-card';
            div.setAttribute('data-id', p.id);
            const imgUrl = getAvatarUrl(p.trainerSpriteId);
            div.innerHTML = `<img src="${imgUrl}"> <span class="pseudo">${p.pseudo}</span> <span class="status">Réfléchit...</span>`;
            activePlayers.appendChild(div);
        });
    }
}

function startTimer() {
    timeLeft = 15;
    const bar = document.getElementById('timer-bar');
    bar.style.width = '100%';
    bar.style.backgroundColor = 'var(--poke-green)';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        const percentage = (timeLeft / 15) * 100;
        bar.style.width = `${percentage}%`;
        if (timeLeft < 5) {
            bar.style.backgroundColor = 'var(--poke-red)';
            bar.parentElement.classList.add('shake');
        } else if (timeLeft < 10) {
            bar.style.backgroundColor = 'var(--poke-yellow)';
        }
        if (timeLeft <= 0) stopTimer();
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    const bar = document.getElementById('timer-bar');
    if(bar) bar.parentElement.classList.remove('shake');
}

document.getElementById('restart-btn').addEventListener('click', () => { location.reload(); });