const challenges = window.challenges;

// Game State
let gameState = {
    score: 0,
    streak: 0,
    currentChallenge: null,
    selectedCategories: new Set(),
    usedIndices: new Set(),
    isProcessing: false,
    currentMode: 'endless', // 'endless' | 'timed' | 'multiplayer'
    timeLeft: 60,
    timerInterval: null,
    opponentScore: 0,
    isMultiplayerHost: false
};

// Themes
const THEMES = ['default', 'cyberpunk', 'pastel'];
let currentThemeIndex = 0;

// DOM Elements
const elements = {
    // Screens
    titleScreen: document.getElementById('title-screen'),
    gameScreen: document.getElementById('game-screen'),
    categoryModal: document.getElementById('category-modal'),
    gameOverModal: document.getElementById('game-over-modal'),

    // Title Screen
    modeEndless: document.getElementById('mode-endless'),
    modeTimed: document.getElementById('mode-timed'),
    modeEndless: document.getElementById('mode-endless'),
    modeTimed: document.getElementById('mode-timed'),
    modeMultiplayer: document.getElementById('mode-multiplayer'),
    themeToggle: document.getElementById('theme-toggle'),

    // Modal
    modalCategoryContainer: document.getElementById('modal-category-container'),
    startGameBtn: document.getElementById('start-game-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),

    // Game Screen
    emojiDisplay: document.getElementById('emoji-display'),
    hintArea: document.getElementById('hint-area'),
    input: document.getElementById('guess-input'),
    submitBtn: document.getElementById('submit-btn'),
    hintBtn: document.getElementById('hint-btn'),
    revealBtn: document.getElementById('reveal-btn'),
    skipBtn: document.getElementById('skip-btn'),
    feedback: document.getElementById('feedback'),
    scoreDisplay: document.getElementById('score'),
    streakDisplay: document.getElementById('streak'),
    backToMenuBtn: document.getElementById('back-to-menu-btn'),
    timerDisplay: document.getElementById('timer-display'),

    // Game Over
    finalScoreVal: document.getElementById('final-score-val'),
    leaderboardTable: document.getElementById('leaderboard-table'),
    playerNameInput: document.getElementById('player-name'),
    saveScoreBtn: document.getElementById('save-score-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),

    // Multiplayer Lobby
    lobbyModal: document.getElementById('lobby-modal'),
    lobbyTabs: document.querySelectorAll('.tab-btn'),
    lobbyTabContents: document.querySelectorAll('.tab-content'),
    myPeerIdDisplay: document.getElementById('my-peer-id'),
    copyIdBtn: document.getElementById('copy-id-btn'),
    hostIdInput: document.getElementById('host-id-input'),
    connectBtn: document.getElementById('connect-btn'),
    cancelLobbyBtn: document.getElementById('cancel-lobby-btn'),
    lobbyStatus: document.querySelector('.lobby-status p'),
    joinStatusMsg: document.getElementById('join-status-msg'),
    opponentStats: document.getElementById('opponent-stats'),
    oppScoreDisplay: document.getElementById('opp-score'),
    statusIndicator: document.querySelector('.status-indicator'),
    lobbyDuration: document.getElementById('lobby-duration')
};

// Initialization
function initApp() {
    generateCategoryChips();
    setupEventListeners();
    loadLeaderboard();
}

function setupEventListeners() {
    // Mode Selection
    elements.modeEndless.addEventListener('click', () => {
        gameState.currentMode = 'endless';
        showModal(true);
    });

    elements.modeTimed.addEventListener('click', () => {
        gameState.currentMode = 'timed';
        showModal(true);
        showModal(true);
    });

    elements.modeMultiplayer.addEventListener('click', () => {
        gameState.currentMode = 'multiplayer';
        showLobby(true);
        initMultiplayer();
    });

    // Theme Toggle
    elements.themeToggle.addEventListener('click', cycleTheme);

    // Modal Controls
    elements.cancelModalBtn.addEventListener('click', () => showModal(false));
    elements.startGameBtn.addEventListener('click', startGame);

    // Navigation
    elements.backToMenuBtn.addEventListener('click', () => {
        stopTimer();
        showScreen('title-screen');
    });

    // Category Selection
    elements.modalCategoryContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const category = e.target.value;
            if (e.target.checked) {
                gameState.selectedCategories.add(category);
            } else {
                gameState.selectedCategories.delete(category);
            }
        }
    });

    // Game Controls
    elements.submitBtn.addEventListener('click', handleGuess);
    elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleGuess();
    });

    elements.hintBtn.addEventListener('click', showHint);
    elements.revealBtn.addEventListener('click', revealAnswer);
    elements.skipBtn.addEventListener('click', skipChallenge);

    // Game Over Controls
    elements.saveScoreBtn.addEventListener('click', saveScore);
    elements.playAgainBtn.addEventListener('click', () => {
        elements.gameOverModal.classList.remove('active');
        showScreen('title-screen');
    });


    // Lobby Controls
    elements.cancelLobbyBtn.addEventListener('click', () => {
        showLobby(false);
        Multiplayer.cleanup();
    });

    elements.lobbyTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.lobbyTabs.forEach(b => b.classList.remove('active'));
            elements.lobbyTabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    elements.copyIdBtn.addEventListener('click', () => {
        const id = elements.myPeerIdDisplay.textContent;
        navigator.clipboard.writeText(id).then(() => {
            const original = elements.copyIdBtn.innerHTML;
            elements.copyIdBtn.innerHTML = "✅";
            setTimeout(() => elements.copyIdBtn.innerHTML = original, 1000);
        });
    });

    elements.connectBtn.addEventListener('click', () => {
        const hostId = elements.hostIdInput.value.trim();
        if (hostId) {
            elements.connectBtn.disabled = true;
            elements.connectBtn.textContent = "Connecting...";
            Multiplayer.connectTo(hostId);
        }
    });
}

// Multiplayer Logic
function initMultiplayer() {
    Multiplayer.onIdAssigned = (id) => {
        elements.myPeerIdDisplay.textContent = id;
    };

    Multiplayer.onConnect = (isHost) => {
        gameState.isMultiplayerHost = isHost;
        elements.statusIndicator.className = 'status-indicator online';

        if (isHost) {
            elements.lobbyStatus.textContent = "Friend Connected! Starting game...";
            setTimeout(() => startMultiplayerGame(), 1000);
        } else {
            elements.joinStatusMsg.textContent = "Connected! Waiting for host to start...";
            elements.joinStatusMsg.style.color = "var(--accent-success)";
        }
    };

    Multiplayer.onData = (data) => {
        if (data.type === 'START') {
            handleMultiplayerStart(data);
        } else if (data.type === 'SCORE') {
            elements.oppScoreDisplay.textContent = `Opp: ${data.score}`;
            gameState.opponentScore = data.score;
        } else if (data.type === 'ROUND_WON') {
            handleOpponentWonRound(data);
        } else if (data.type === 'GAME_OVER') {
            // Handled locally by timer usually
        }
    };

    Multiplayer.init();
}

function startMultiplayerGame() {
    // 1. Get Settings
    const duration = parseInt(elements.lobbyDuration.value) || 60;
    const cats = Array.from(gameState.selectedCategories);

    // 2. Generate Sequence based on Host Categories
    // Temporarily replace challenge source for generation
    const hostAvailable = challenges.filter(c => gameState.selectedCategories.has(c.category));

    const sequence = [];
    const available = hostAvailable.length > 0 ? hostAvailable.slice() : challenges.slice();

    for (let i = 0; i < 50; i++) {
        if (available.length === 0) break;
        const idx = Math.floor(Math.random() * available.length);
        sequence.push(available[idx]);
    }

    const payload = {
        type: 'START',
        sequence: sequence,
        settings: {
            duration: duration,
            categories: cats
        }
    };

    Multiplayer.send(payload);
    handleMultiplayerStart(payload); // Start for self
}

function handleMultiplayerStart(data) {
    showLobby(false);
    showScreen('game-screen');

    // Setup Multiplayer State
    gameState.score = 0;
    gameState.opponentScore = 0;
    gameState.streak = 0;
    gameState.mpSequence = data.sequence;
    gameState.mpIndex = 0;

    // Apply Host Settings
    if (data.settings) {
        // Timer
        gameState.timeLeft = data.settings.duration;
        // Categories (Visual only, sequence determines questions)
        gameState.selectedCategories = new Set(data.settings.categories);
        // Force refresh UI chips to match? Optional, but good practice
        // generateCategoryChips(); // We won't force-redraw chips for simplicity
    }

    elements.opponentStats.classList.remove('hidden');
    elements.oppScoreDisplay.textContent = "Opp: 0";

    // Start Game
    updateStats();
    loadNextMpChallenge();

    // Start synced timer
    elements.timerDisplay.classList.remove('hidden');
    updateTimerDisplay();
    startTimer();
}

function handleOpponentWonRound(data) {
    if (gameState.isProcessing) return; // Already moving

    gameState.isProcessing = true;
    gameState.streak = 0; // Reset streak on loss? Maybe too harsh. Let's keep it.
    updateStats();

    // Feedback
    elements.feedback.textContent = `Opponent got it! It was "${gameState.currentChallenge.answer}"`;
    elements.feedback.className = "feedback-message error";
    elements.input.disabled = true;

    // Flash Effect
    document.body.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; // Flash Red
    setTimeout(() => document.body.style.backgroundColor = '', 300);

    setTimeout(() => {
        elements.input.disabled = false;
        gameState.isProcessing = false;
        loadNextMpChallenge();
    }, 1500);
}

function loadNextMpChallenge() {
    if (gameState.mpIndex >= gameState.mpSequence.length) {
        endGame(); // Ran out of questions
        return;
    }

    gameState.currentChallenge = gameState.mpSequence[gameState.mpIndex];
    gameState.mpIndex++;
    updateUI();
}


// Logic
function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
    const theme = THEMES[currentThemeIndex];
    if (theme === 'default') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelector('.modal-overlay.active')?.classList.remove('active');
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'title-screen') {
        showModal(false);
    }
}

function showModal(show) {
    if (show) {
        elements.categoryModal.classList.add('active');
    } else {
        elements.categoryModal.classList.remove('active');
    }
}

function showLobby(show) {
    if (show) {
        elements.lobbyModal.classList.add('active');
    } else {
        elements.lobbyModal.classList.remove('active');
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = "Connect";
        elements.joinStatusMsg.textContent = "";
    }
}

function generateCategoryChips() {
    const categories = [...new Set(challenges.map(c => c.category))].sort();
    elements.modalCategoryContainer.innerHTML = '';
    categories.forEach(cat => {
        const label = document.createElement('label');
        label.className = 'category-chip';
        label.innerHTML = `<input type="checkbox" value="${cat}" checked><span>${cat}</span>`;
        elements.modalCategoryContainer.appendChild(label);
        gameState.selectedCategories.add(cat);
    });
}

function startGame() {
    if (gameState.selectedCategories.size === 0) {
        alert("Please select at least one category!");
        return;
    }

    showModal(false);
    showScreen('game-screen');

    // Reset State
    gameState.score = 0;
    gameState.streak = 0;
    gameState.usedIndices.clear();
    updateStats();

    // Timer Setup
    if (gameState.currentMode === 'timed') {
        elements.timerDisplay.classList.remove('hidden');
        gameState.timeLeft = 60;
        updateTimerDisplay();
        startTimer();
    } else {
        elements.timerDisplay.classList.add('hidden');
    }

    loadNewChallenge();
}

function startTimer() {
    stopTimer();
    elements.timerDisplay.classList.remove('urgent');
    gameState.timerInterval = setInterval(() => {
        gameState.timeLeft--;
        updateTimerDisplay();

        if (gameState.timeLeft <= 10) {
            elements.timerDisplay.classList.add('urgent');
        }

        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function updateTimerDisplay() {
    elements.timerDisplay.textContent = gameState.timeLeft;
}

function endGame() {
    stopTimer();
    elements.finalScoreVal.textContent = gameState.score;
    elements.gameOverModal.classList.add('active');
    loadLeaderboard();
}

function getFilteredChallenges() {
    return challenges.filter(c => gameState.selectedCategories.has(c.category));
}

function loadNewChallenge() {
    const filtered = getFilteredChallenges();
    const available = filtered.filter(c => !gameState.usedIndices.has(c.answer));

    if (available.length === 0) {
        if (filtered.length === 0) {
            elements.emojiDisplay.textContent = "🤷‍♂️";
            return;
        }
        gameState.usedIndices.clear();
        loadNewChallenge(); // Recurse
        return;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    gameState.currentChallenge = available[randomIndex];
    gameState.usedIndices.add(gameState.currentChallenge.answer);

    updateUI();
}

function updateUI() {
    elements.emojiDisplay.textContent = gameState.currentChallenge.emojis;
    elements.hintArea.textContent = "";
    elements.input.value = "";
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback-message";

    elements.emojiDisplay.style.animation = 'none';
    elements.emojiDisplay.offsetHeight;
    elements.emojiDisplay.style.animation = 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    elements.hintBtn.disabled = false;
    elements.revealBtn.disabled = false;
    elements.input.focus();
}

function handleGuess() {
    if (gameState.isProcessing) return;

    const userGuess = elements.input.value.trim().toLowerCase().replace(/[^\w\s]/gi, '');
    const correctAnswers = gameState.currentChallenge.distinct.map(a => a.toLowerCase().replace(/[^\w\s]/gi, ''));

    if (userGuess.length === 0) return;

    if (correctAnswers.includes(userGuess)) {
        handleCorrect();
    } else {
        handleIncorrect();
    }
}

function handleCorrect() {
    gameState.isProcessing = true;
    gameState.score += 10 + (gameState.streak * 2);
    gameState.streak++;
    updateStats();

    if (gameState.currentMode === 'multiplayer') {
        Multiplayer.send({ type: 'SCORE', score: gameState.score });
        Multiplayer.send({ type: 'ROUND_WON', answer: gameState.currentChallenge.answer });
    }

    elements.feedback.textContent = `Correct! It was "${gameState.currentChallenge.answer}" 🎉`;
    elements.feedback.className = "feedback-message success";
    triggerConfetti();

    setTimeout(() => {
        gameState.isProcessing = false;
        if (gameState.currentMode === 'multiplayer') {
            loadNextMpChallenge();
        } else {
            loadNewChallenge();
        }
    }, 1500);
}

function handleIncorrect() {
    gameState.streak = 0;
    updateStats();
    elements.feedback.textContent = "Incorrect, try again! ❌";
    elements.feedback.className = "feedback-message error";
    elements.input.classList.add('shake-input');
    setTimeout(() => elements.input.classList.remove('shake-input'), 400);
}

function showHint() {
    elements.hintArea.textContent = `Hint: ${gameState.currentChallenge.hint}`;
    gameState.score = Math.max(0, gameState.score - 5);
    updateStats();
    elements.hintBtn.disabled = true;
}

function revealAnswer() {
    gameState.streak = 0;
    updateStats();
    elements.feedback.textContent = `The answer is: "${gameState.currentChallenge.answer}"`;
    elements.feedback.className = "feedback-message";
    elements.revealBtn.disabled = true;

    gameState.isProcessing = true;
    setTimeout(() => {
        gameState.isProcessing = false;
        if (gameState.currentMode === 'multiplayer') {
            loadNextMpChallenge();
        } else {
            loadNewChallenge();
        }
    }, 2000);
}

function skipChallenge() {
    gameState.streak = 0;
    updateStats();
    elements.feedback.textContent = `Skipped! It was "${gameState.currentChallenge.answer}"`;
    if (gameState.currentMode === 'multiplayer') {
        loadNextMpChallenge();
    } else {
        loadNewChallenge();
    }
}

function updateStats() {
    elements.scoreDisplay.textContent = gameState.score;
    elements.streakDisplay.textContent = gameState.streak;
}

function triggerConfetti() {
    const emojis = ['🎉', '✨', '⭐', '🎈'];
    for (let i = 0; i < 20; i++) {
        const el = document.createElement('div');
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.position = 'fixed';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.top = '-50px';
        el.style.fontSize = (Math.random() * 20 + 20) + 'px';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '1000';
        el.style.transition = `top 1s ease-in, transform 1s ease-out`;
        document.body.appendChild(el);

        requestAnimationFrame(() => {
            el.style.top = '110vh';
            el.style.transform = `rotate(${Math.random() * 360}deg)`;
        });
        setTimeout(() => el.remove(), 1000);
    }
}

// Leaderboard Logic
function saveScore() {
    const name = elements.playerNameInput.value.trim() || "Anonymous";
    const newScore = { name, score: gameState.score, date: new Date().toLocaleDateString() };

    let leaderboard = JSON.parse(localStorage.getItem('emoji_mind_leaderboard') || '[]');
    leaderboard.push(newScore);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5); // Keep top 5

    localStorage.setItem('emoji_mind_leaderboard', JSON.stringify(leaderboard));

    loadLeaderboard();
    elements.saveScoreBtn.disabled = true;
    elements.saveScoreBtn.textContent = "Saved!";
}

function loadLeaderboard() {
    const leaderboard = JSON.parse(localStorage.getItem('emoji_mind_leaderboard') || '[]');
    elements.leaderboardTable.innerHTML = leaderboard.map((entry, index) => `
        <div class="score-row">
            <span class="score-name">${index + 1}. ${entry.name}</span>
            <span class="score-val">${entry.score}</span>
        </div>
    `).join('') || '<p style="text-align:center; opacity:0.7">No scores yet!</p>';

    // Reset save button state
    elements.saveScoreBtn.disabled = false;
    elements.saveScoreBtn.textContent = "Save";
    elements.playerNameInput.value = "";
}

initApp();
