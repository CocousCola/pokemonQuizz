const socket = io();

const screens = {
    lobby: document.getElementById('lobby-screen'),
    question: document.getElementById('question-screen'),
    results: document.getElementById('results-screen'),
    leaderboard: document.getElementById('leaderboard-screen'),
    gameOver: document.getElementById('game-over-screen')
};

let gameCode = null;
let currentQuestion = null;
let timerInterval = null;
let timeLeft = 15;

// Socket connection
socket.on('connect', () => {
    console.log('Connected to server');
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
        card.className = 'player-card';
        card.style.borderColor = player.color;
        const remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/${player.trainerSpriteId}.png`;
        card.innerHTML = `
            <img src="${player.trainerSprite}" onerror="this.src='${remoteUrl}'" alt="${player.trainerName}">
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

socket.on('game-started', (data) => {
    showScreen('question');
});

socket.on('question', (data) => {
    currentQuestion = data.question;
    showScreen('question');
    
    document.getElementById('current-q').textContent = data.questionNumber;
    document.getElementById('question-text').textContent = currentQuestion.text;
    
    const sprite = document.getElementById('pokemon-sprite');
    sprite.src = currentQuestion.pokemon.sprite;
    
    if (currentQuestion.type === 'WHO_IS_THIS') {
        sprite.classList.add('silhouette');
    } else {
        sprite.classList.remove('silhouette');
    }
    
    const optionsGrid = document.getElementById('options-grid');
    optionsGrid.innerHTML = '';
    currentQuestion.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = `option-item option-${i}`;
        div.textContent = opt;
        optionsGrid.appendChild(div);
    });
    
    startTimer();
});

socket.on('player-answered', (data) => {
    const playerCard = document.querySelector(`.mini-player-card[data-id="${data.playerId}"]`);
    if (playerCard) {
        playerCard.classList.add('answered');
        playerCard.querySelector('.status').textContent = 'Prêt !';
    }
});

socket.on('question-results', (data) => {
    stopTimer();
    showScreen('results');
    
    document.getElementById('correct-answer-text').textContent = `C'est ${data.correctAnswer} !`;
    document.getElementById('reveal-sprite').src = currentQuestion.pokemon.sprite;
    document.getElementById('extra-info').textContent = data.extra || '';
    
    const summary = document.getElementById('points-summary');
    summary.innerHTML = '';
    data.playerResults.forEach(res => {
        const div = document.createElement('div');
        div.className = 'result-point-item';
        div.innerHTML = `<strong>${res.pseudo}</strong>: +${res.pointsGained} pts`;
        summary.appendChild(div);
    });
    
    setTimeout(() => {
        socket.emit('next-question', { code: gameCode });
    }, 5000);
});

socket.on('leaderboard', (data) => {
    // We show leaderboard briefly or update background
    updateLeaderboard(data.players);
});

socket.on('game-over', (data) => {
    showScreen('gameOver');
    const podium = document.getElementById('final-podium');
    podium.innerHTML = '';
    
    data.finalLeaderboard.slice(0, 3).forEach((player, i) => {
        const div = document.createElement('div');
        div.className = `podium-place place-${i+1}`;
        const remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/${player.trainerSpriteId}.png`;
        div.innerHTML = `
            <div class="rank retro-font">${i+1}</div>
            <img src="${player.trainerSprite}" onerror="this.src='${remoteUrl}'" alt="">
            <div class="name retro-font">${player.pseudo}</div>
            <div class="score">${player.score} pts</div>
        `;
        podium.appendChild(div);
    });
    
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });
});

// UI Helpers
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
    
    if (screenId === 'question') {
        updateActivePlayers();
    }
}

function updateActivePlayers() {
    const container = document.getElementById('active-players');
    container.innerHTML = '';
    
    // This is a bit tricky as we don't have the full player list here
    // Let's ask server or use the last lobby update
    // For now, let's assume we get it from leaderboard updates
}

function updateLeaderboard(players) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';
    players.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-item';
        const remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/${p.trainerSpriteId}.png`;
        div.innerHTML = `
            <span class="rank">${i+1}</span>
            <img src="${p.trainerSprite}" onerror="this.src='${remoteUrl}'">
            <span class="name">${p.pseudo}</span>
            <span class="score">${p.score} pts</span>
        `;
        list.appendChild(div);
    });
    
    // Also update mini cards in question screen
    const activePlayers = document.getElementById('active-players');
    if (activePlayers) {
        activePlayers.innerHTML = '';
        players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'mini-player-card';
            div.setAttribute('data-id', p.id);
            const remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/${p.trainerSpriteId}.png`;
            div.innerHTML = `
                <img src="${p.trainerSprite}" onerror="this.src='${remoteUrl}'">
                <span class="pseudo">${p.pseudo}</span>
                <span class="status">Réfléchit...</span>
            `;
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
        
        if (timeLeft < 5) bar.style.backgroundColor = 'var(--poke-red)';
        else if (timeLeft < 10) bar.style.backgroundColor = 'var(--poke-yellow)';
        
        if (timeLeft <= 0) {
            stopTimer();
        }
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// Event Listeners
document.getElementById('start-btn').addEventListener('click', () => {
    socket.emit('start-game', { code: gameCode });
});

document.getElementById('restart-btn').addEventListener('click', () => {
    location.reload();
});
