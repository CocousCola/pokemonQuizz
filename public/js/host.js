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

// Helper pour les images HD
const getAvatarUrl = (dexId) => {
    // Si c'est un spriteId qui ressemble à un dresseur (ex: 1, 2, 3), on garde l'ancien système ou on map
    // Mais ici le client envoie dexId dans spriteId
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
};

// Socket connection
socket.on('connect', () => {
    console.log('Connecté au serveur');
});

socket.on('server-info', (data) => {
    const playerURL = data.url;
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
        // player.trainerSpriteId contient le dexId maintenant
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
        const status = playerCard.querySelector('.status');
        status.textContent = 'A répondu !';
        status.style.color = 'green';
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
    
    // Trier par points gagnés pour l'animation
    const sortedResults = [...data.playerResults].sort((a, b) => b.pointsGained - a.pointsGained);

    sortedResults.forEach(res => {
        if (res.pointsGained > 0) {
            const div = document.createElement('div');
            div.className = 'result-point-item fade-in';
            div.innerHTML = `
                <span class="player-name">${res.pseudo}</span>
                <span class="points-plus">+${res.pointsGained}</span>
            `;
            summary.appendChild(div);
        }
    });
    
    // Afficher le classement intermédiaire après 5 secondes
    setTimeout(() => {
        socket.emit('request-leaderboard', { code: gameCode }); // On pourrait demander, mais le serveur l'envoie déjà
    }, 4000);
});

socket.on('leaderboard', (data) => {
    // Si on est à la fin du jeu, ne pas afficher l'écran intermédiaire
    if (screens.gameOver.classList.contains('hidden') === false) return;

    showScreen('leaderboard');
    updateLeaderboard(data.players);
    
    // Passer à la question suivante après 5 secondes de classement
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
    
    confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#FF0000', '#3B4CCA', '#FFDE00']
    });
});

// UI Helpers
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

function updateLeaderboard(players) {
    const list = document.getElementById('leaderboard-list');
    const activePlayers = document.getElementById('active-players');
    
    if (list) {
        list.innerHTML = '';
        players.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-item slide-in';
            div.style.animationDelay = `${i * 0.1}s`;
            const imgUrl = getAvatarUrl(p.trainerSpriteId);
            
            div.innerHTML = `
                <span class="rank">${i+1}</span>
                <img src="${imgUrl}">
                <span class="name">${p.pseudo}</span>
                <span class="score">${p.score} pts</span>
            `;
            list.appendChild(div);
        });
    }
    
    // Update mini cards
    if (activePlayers) {
        activePlayers.innerHTML = '';
        players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'mini-player-card';
            div.setAttribute('data-id', p.id);
            const imgUrl = getAvatarUrl(p.trainerSpriteId);
            
            div.innerHTML = `
                <img src="${imgUrl}">
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
        
        if (timeLeft < 5) {
            bar.style.backgroundColor = 'var(--poke-red)';
            bar.parentElement.classList.add('shake'); // Shake timer
        } else if (timeLeft < 10) {
            bar.style.backgroundColor = 'var(--poke-yellow)';
        }
        
        if (timeLeft <= 0) {
            stopTimer();
            bar.parentElement.classList.remove('shake');
        }
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    const bar = document.getElementById('timer-bar');
    if(bar) bar.parentElement.classList.remove('shake');
}

document.getElementById('start-btn').addEventListener('click', () => {
    socket.emit('start-game', { code: gameCode });
});

document.getElementById('restart-btn').addEventListener('click', () => {
    location.reload();
});
