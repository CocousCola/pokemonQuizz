const socket = io();

// Liste des Avatars Pokémon HD (Official Artwork)
const avatars = [
    { id: 'pikachu', name: 'Pikachu', dexId: 25 },
    { id: 'bulbasaur', name: 'Bulbizarre', dexId: 1 },
    { id: 'charmander', name: 'Salamèche', dexId: 4 },
    { id: 'squirtle', name: 'Carapuce', dexId: 7 },
    { id: 'gengar', name: 'Ectoplasma', dexId: 94 },
    { id: 'eevee', name: 'Évoli', dexId: 133 },
    { id: 'snorlax', name: 'Ronflex', dexId: 143 },
    { id: 'jigglypuff', name: 'Rondoudou', dexId: 39 },
    { id: 'meowth', name: 'Miaouss', dexId: 52 },
    { id: 'psyduck', name: 'Psykokwak', dexId: 54 },
    { id: 'mewtwo', name: 'Mewtwo', dexId: 150 },
    { id: 'mew', name: 'Mew', dexId: 151 }
];

let selectedAvatar = avatars[0];
let myPlayerInfo = null;
let currentGameCode = null;

const getAvatarUrl = (dexId) => {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
};

const screens = {
    join: document.getElementById('join-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen'),
    feedback: document.getElementById('feedback-screen'),
    final: document.getElementById('final-screen')
};

// SVG Icons
const shapeIcons = [
    `<svg viewBox="0 0 60 60" width="40" height="40"><circle cx="30" cy="30" r="25" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" width="40" height="40"><rect x="10" y="10" width="40" height="40" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" width="40" height="40"><rect x="5" y="15" width="50" height="30" fill="white"/></svg>`,
    `<svg viewBox="0 0 60 60" width="40" height="40"><polygon points="30,5 35,20 50,23 40,35 43,50 30,42 17,50 20,35 10,23 25,20" fill="white"/></svg>`
];

const colors = ['red', 'blue', 'green', 'yellow'];

// Initialisation de la grille d'avatars
const trainerGrid = document.getElementById('trainer-grid');
if (trainerGrid) {
    trainerGrid.innerHTML = '';
    avatars.forEach(av => {
        const div = document.createElement('div');
        div.className = 'trainer-option';
        if (av.id === selectedAvatar.id) div.classList.add('selected');
        
        div.innerHTML = `<img src="${getAvatarUrl(av.dexId)}" alt="${av.name}">`;
        div.onclick = () => selectAvatar(av, div);
        trainerGrid.appendChild(div);
    });
}

function selectAvatar(avatar, element) {
    selectedAvatar = avatar;
    document.querySelectorAll('.trainer-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('selected-trainer-name').textContent = avatar.name;
    checkForm();
}

// Validation du formulaire
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

// Actions Socket
joinBtn.onclick = () => {
    const pseudo = pseudoInput.value.trim();
    const code = codeInput.value.trim();
    socket.emit('join-game', { 
        code, 
        pseudo, 
        trainer: { 
            id: selectedAvatar.id, 
            name: selectedAvatar.name, 
            spriteId: selectedAvatar.dexId 
        } 
    });
};

socket.on('joined-successfully', (data) => {
    myPlayerInfo = data.player;
    currentGameCode = data.gameCode;
    showScreen('waiting');
    
    document.getElementById('my-trainer-img').src = getAvatarUrl(selectedAvatar.dexId);
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
            div.innerHTML = `<span>${p.pseudo} a rejoint !</span>`;
            othersList.appendChild(div);
        }
    });
});

socket.on('game-started', () => {
    showScreen('game');
    document.getElementById('stats-trainer').src = getAvatarUrl(selectedAvatar.dexId);
});

socket.on('question', (data) => {
    showScreen('game');
    document.getElementById('lock-in-msg').classList.add('hidden');
    
    const inputType = data.question.inputType || 'QCM';
    
    const qcmContainer = document.getElementById('answer-buttons');
    const textContainer = document.getElementById('text-input-container');
    const inputField = document.getElementById('answer-input');

    if (inputType === 'TEXT') {
        qcmContainer.classList.add('hidden');
        textContainer.classList.remove('hidden');
        inputField.value = '';
        inputField.disabled = false;
        document.getElementById('validate-btn').disabled = false;
        inputField.focus();
    } else {
        qcmContainer.classList.remove('hidden');
        textContainer.classList.add('hidden');
        
        // Generate Buttons Dynamically
        qcmContainer.innerHTML = '';
        const optionsCount = data.question.options.length;
        
        for (let i = 0; i < optionsCount; i++) {
            const btn = document.createElement('button');
            btn.className = `answer-btn btn-${colors[i]}`;
            btn.setAttribute('data-index', i);
            
            // Special case for Yellow (Index 3)
            let icon = shapeIcons[i];
            if (i === 3) {
                icon = icon.replace('fill="white"', 'fill="black"');
            }
            
            btn.innerHTML = icon;
            
            btn.onclick = () => {
                socket.emit('answer-question', { 
                    code: currentGameCode, 
                    answer: i 
                });
                Array.from(qcmContainer.children).forEach(b => b.disabled = true);
            };
            
            qcmContainer.appendChild(btn);
        }
    }
});

socket.on('player-answered', (data) => {
    if (data.playerId === socket.id) {
        document.getElementById('answer-buttons').classList.add('hidden');
        document.getElementById('text-input-container').classList.add('hidden');
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
    
    // Survival Mode Logic
    if (data.mode === 'SURVIVAL') {
        if (myResult.isCorrect) {
            box.className = 'feedback-box correct';
            title.textContent = 'BIEN JOUÉ !';
            points.textContent = 'Vie intacte ❤️';
        } else {
            box.className = 'feedback-box wrong';
            if (myResult.isEliminated) {
                title.textContent = 'ÉLIMINÉ 💀';
                points.textContent = 'Game Over';
            } else {
                title.textContent = 'TOUCHÉ !';
                points.textContent = '-1 ❤️';
            }
        }
        
        const lives = myResult.lives !== undefined ? myResult.lives : 0;
        document.getElementById('stats-score').textContent = myResult.isEliminated ? 'K.O.' : `${lives} ❤️`;

    } else {
        // Classic Logic
        if (myResult.isCorrect) {
            box.className = 'feedback-box correct';
            title.textContent = 'EXCELLENT !';
            points.textContent = `+${myResult.pointsGained} pts`;
        } else {
            box.className = 'feedback-box wrong';
            title.textContent = 'DOMMAGE...';
            points.textContent = '0 pt';
        }
        
        document.getElementById('stats-score').textContent = `${myResult.score} pts`;
    }
});

socket.on('game-over', (data) => {
    showScreen('final');
    const myFinal = data.finalLeaderboard.find(r => r.id === socket.id);
    document.getElementById('final-rank').textContent = `${myFinal.position}${myFinal.position === 1 ? 'er' : 'ème'}`;
    document.getElementById('final-score').textContent = myFinal.score;
});

// Text Input Handling
const validateBtn = document.getElementById('validate-btn');
const inputField = document.getElementById('answer-input');

if (validateBtn && inputField) {
    validateBtn.onclick = () => {
        const answer = inputField.value.trim();
        if (answer) {
            socket.emit('answer-question', { 
                code: currentGameCode, 
                answer: answer 
            });
            inputField.disabled = true;
            validateBtn.disabled = true;
        }
    };

    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            validateBtn.click();
        }
    });
}

function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}