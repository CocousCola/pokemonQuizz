const socket = io();

const trainers = [
    { id: 'red', name: 'Red', spriteId: 1 },
    { id: 'blue', name: 'Blue', spriteId: 2 },
    { id: 'oak', name: 'Prof. Oak', spriteId: 123 },
    { id: 'ash', name: 'Ash', spriteId: 104 },
    { id: 'misty', name: 'Misty', spriteId: 17 },
    { id: 'brock', name: 'Brock', spriteId: 16 },
    { id: 'erika', name: 'Erika', spriteId: 19 },
    { id: 'koga', name: 'Koga', spriteId: 20 },
    { id: 'giovanni', name: 'Giovanni', spriteId: 23 },
    { id: 'jessie', name: 'Jessie', spriteId: 105 },
    { id: 'james', name: 'James', spriteId: 106 },
    { id: 'lorelei', name: 'Lorelei', spriteId: 54 }
];

let selectedTrainer = trainers[0];
let myPlayerInfo = null;
let currentGameCode = null;

const getTrainerSprite = (t) => {
    // Try local first, then remote
    return `/trainers/${t.id}.png`;
};

const screens = {
    join: document.getElementById('join-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen'),
    feedback: document.getElementById('feedback-screen'),
    final: document.getElementById('final-screen')
};

// Initialize Trainer Grid
const trainerGrid = document.getElementById('trainer-grid');
trainers.forEach(t => {
    const div = document.createElement('div');
    div.className = 'trainer-option';
    if (t.id === selectedTrainer.id) div.classList.add('selected');
    
    // Fallback to remote if local fails
    const imgUrl = getTrainerSprite(t);
    const remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/${t.spriteId}.png`;
    
    div.innerHTML = `<img src="${imgUrl}" onerror="this.src='${remoteUrl}'" alt="${t.name}">`;
    div.onclick = () => selectTrainer(t, div);
    trainerGrid.appendChild(div);
});

function selectTrainer(trainer, element) {
    selectedTrainer = trainer;
    document.querySelectorAll('.trainer-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('selected-trainer-name').textContent = trainer.name;
    checkForm();
}

// Form Validation
const pseudoInput = document.getElementById('pseudo-input');
const codeInput = document.getElementById('code-input');
const joinBtn = document.getElementById('join-btn');

[pseudoInput, codeInput].forEach(input => {
    input.addEventListener('input', checkForm);
});

function checkForm() {
    const isPseudoValid = pseudoInput.value.trim().length >= 2;
    const isCodeValid = codeInput.value.trim().length === 4;
    joinBtn.disabled = !(isPseudoValid && isCodeValid);
}

// Socket Actions
joinBtn.onclick = () => {
    const pseudo = pseudoInput.value.trim();
    const code = codeInput.value.trim();
    socket.emit('join-game', { code, pseudo, trainer: selectedTrainer });
};

socket.on('joined-successfully', (data) => {
    myPlayerInfo = data.player;
    currentGameCode = data.gameCode;
    showScreen('waiting');
    
    document.getElementById('my-trainer-img').src = myPlayerInfo.trainerSprite;
    document.getElementById('my-pseudo').textContent = myPlayerInfo.pseudo;
});

socket.on('error', (data) => {
    alert(data.message);
});

socket.on('lobby-update', (data) => {
    const othersList = document.getElementById('others-list');
    othersList.innerHTML = '';
    data.players.forEach(p => {
        if (p.id !== socket.id) {
            const div = document.createElement('div');
            div.className = 'other-player';
            div.innerHTML = `<span>${p.pseudo} est là !</span>`;
            othersList.appendChild(div);
        }
    });
});

socket.on('game-started', () => {
    showScreen('game');
    document.getElementById('stats-trainer').src = myPlayerInfo.trainerSprite;
});

socket.on('question', (data) => {
    showScreen('game');
    document.getElementById('lock-in-msg').classList.add('hidden');
    document.getElementById('answer-buttons').classList.remove('hidden');
    
    const btns = document.querySelectorAll('.answer-btn');
    btns.forEach((btn, i) => {
        btn.disabled = false;
        // Update text if needed, kahoot style uses A, B, C, D
        // But we could put the text directly
        btn.textContent = data.question.options[i] || '';
    });
});

socket.on('player-answered', (data) => {
    if (data.playerId === socket.id) {
        document.getElementById('answer-buttons').classList.add('hidden');
        document.getElementById('lock-in-msg').classList.remove('hidden');
    }
});

socket.on('question-results', (data) => {
    const myResult = data.playerResults.find(r => r.id === socket.id);
    if (!myResult) return;

    showScreen('feedback');
    const box = document.getElementById('feedback-content');
    const title = document.getElementById('feedback-title');
    const points = document.getElementById('feedback-points');
    
    if (myResult.isCorrect) {
        box.className = 'feedback-box correct';
        title.textContent = 'GOTCHA !';
        points.textContent = `+${myResult.pointsGained} pts`;
    } else {
        box.className = 'feedback-box wrong';
        title.textContent = 'RATÉ...';
        points.textContent = '0 pt';
    }
    
    document.getElementById('stats-score').textContent = `${myResult.score} pts`;
});

socket.on('game-over', (data) => {
    showScreen('final');
    const myFinal = data.finalLeaderboard.find(r => r.id === socket.id);
    document.getElementById('final-rank').textContent = `#${myFinal.position}`;
    document.getElementById('final-score').textContent = myFinal.score;
});

// UI Helpers
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

// Answer Handling
document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.onclick = () => {
        const answer = btn.textContent;
        socket.emit('answer-question', { 
            code: currentGameCode, 
            answer: answer 
        });
        
        // Disable all buttons
        document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);
    };
});
