document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loadingScreen = document.getElementById('loading-screen');
    const loadingStatus = document.getElementById('loading-status');
    const loadingMessage = document.getElementById('loading-message');
    const gameInterface = document.getElementById('game-interface');
    
    const guessInput = document.getElementById('guess-input');
    const guessBtn = document.getElementById('guess-btn');
    const messageEl = document.getElementById('message');
    
    const lastGuessCard = document.getElementById('last-guess-card');
    const noLastGuess = document.getElementById('no-last-guess');
    const lastGuessWord = document.getElementById('last-guess-word');
    const lastGuessSimilarity = document.getElementById('last-guess-similarity');
    const lastGuessRank = document.getElementById('last-guess-rank');
    const lastGuessPercentile = document.getElementById('last-guess-percentile');
    
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    
    const guessesList = document.getElementById('guesses-list');
    const noGuessesMessage = document.getElementById('no-guesses-message');
    
    const newGameBtn = document.getElementById('new-game-btn');
    const hintBtn = document.getElementById('hint-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const helpBtn = document.getElementById('help-btn');
    
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const activeWordsInput = document.getElementById('active-words-input');
    const activeWordsRange = document.getElementById('active-words-range');
    const precomputeInput = document.getElementById('precompute-input');
    const precomputeRange = document.getElementById('precompute-range');
    const minLengthInput = document.getElementById('min-length-input');
    const minLengthRange = document.getElementById('min-length-range');
    const applySettings = document.getElementById('apply-settings');
    
    const lightThemeBtn = document.getElementById('light-theme-btn');
    const darkThemeBtn = document.getElementById('dark-theme-btn');
    const autoThemeBtn = document.getElementById('auto-theme-btn');
    
    const instructionsModal = document.getElementById('instructions-modal');
    const closeInstructions = document.getElementById('close-instructions');
    const startPlaying = document.getElementById('start-playing');
    
    const toastContainer = document.getElementById('toast-container');
    
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Game state
    const guesses = [];
    let gameInitialized = false;
    let bestPercentile = 0;
    let gameWon = false;
    
    // API URL - Change this to match your backend
    const API_URL = '/api';  // Use relative path for deployment flexibility
    
    // Initialize
    initTheme();
    checkStatus();
    
    // Event Listeners
    guessBtn.addEventListener('click', submitGuess);
    guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitGuess();
    });
    newGameBtn.addEventListener('click', startNewGame);
    hintBtn.addEventListener('click', getHint);
    helpBtn.addEventListener('click', () => instructionsModal.classList.add('show'));
    darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Settings Modal
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
    closeSettings.addEventListener('click', () => settingsModal.classList.remove('show'));
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('show');
        if (e.target === instructionsModal) instructionsModal.classList.remove('show');
    });
    applySettings.addEventListener('click', updateSettings);
    
    // Theme buttons
    lightThemeBtn.addEventListener('click', () => setTheme('light'));
    darkThemeBtn.addEventListener('click', () => setTheme('dark'));
    autoThemeBtn.addEventListener('click', () => setTheme('auto'));
    
    // Sync range sliders with input fields
    activeWordsRange.addEventListener('input', () => activeWordsInput.value = activeWordsRange.value);
    activeWordsInput.addEventListener('input', () => activeWordsRange.value = activeWordsInput.value);
    precomputeRange.addEventListener('input', () => precomputeInput.value = precomputeRange.value);
    precomputeInput.addEventListener('input', () => precomputeRange.value = precomputeInput.value);
    minLengthRange.addEventListener('input', () => minLengthInput.value = minLengthRange.value);
    minLengthInput.addEventListener('input', () => minLengthRange.value = minLengthInput.value);
    
    // Instructions Modal
    closeInstructions.addEventListener('click', () => instructionsModal.classList.remove('show'));
    startPlaying.addEventListener('click', () => instructionsModal.classList.remove('show'));
    
    /**
     * Initialize theme based on user preference or system preference
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            updateThemeButtons('dark');
        } else if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            updateThemeButtons('light');
        } else {
            // Auto theme based on system preference
            updateThemeButtons('auto');
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
                darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.body.classList.remove('dark-mode');
                darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
            
            // Listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === 'auto') {
                    if (e.matches) {
                        document.body.classList.add('dark-mode');
                        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                    } else {
                        document.body.classList.remove('dark-mode');
                        darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                    }
                }
            });
        }
    }
    
    /**
     * Toggle between light and dark mode
     */
    function toggleDarkMode() {
        if (document.body.classList.contains('dark-mode')) {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    }
    
    /**
     * Set theme (light, dark, or auto)
     */
    function setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        } else if (theme === 'light') {
            document.body.classList.remove('dark-mode');
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else if (theme === 'auto') {
            localStorage.setItem('theme', 'auto');
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
                darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.body.classList.remove('dark-mode');
                darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        }
        
        updateThemeButtons(theme);
    }
    
    /**
     * Update theme buttons UI
     */
    function updateThemeButtons(activeTheme) {
        [lightThemeBtn, darkThemeBtn, autoThemeBtn].forEach(btn => btn.classList.remove('active'));
        
        if (activeTheme === 'light') {
            lightThemeBtn.classList.add('active');
        } else if (activeTheme === 'dark') {
            darkThemeBtn.classList.add('active');
        } else if (activeTheme === 'auto') {
            autoThemeBtn.classList.add('active');
        }
    }
    
    /**
     * Periodically check the server initialization status
     */
    async function checkStatus() {
        try {
            const response = await fetch(`${API_URL}/status`);
            const data = await response.json();
            
            if (data.initialized) {
                gameInitialized = true;
                hideLoading();
                loadConfig();
                startNewGame();
                
                // Show instructions on first load if it's the first time
                if (!localStorage.getItem('instructionsShown')) {
                    setTimeout(() => {
                        instructionsModal.classList.add('show');
                        localStorage.setItem('instructionsShown', 'true');
                    }, 500);
                }
            } else {
                // Update loading message
                loadingStatus.textContent = data.message || 'טוען את המשחק...';
                loadingMessage.textContent = `שלב: ${data.stage || 'אתחול'}`;
                
                // Check again in 2 seconds
                setTimeout(checkStatus, 2000);
            }
        } catch (err) {
            console.error('Error checking status:', err);
            loadingStatus.textContent = 'שגיאה בטעינת המשחק';
            loadingMessage.textContent = 'מנסה שוב בעוד רגע...';
            setTimeout(checkStatus, 5000);
        }
    }
    
    /**
     * Hide loading screen and show game interface
     */
    function hideLoading() {
        loadingScreen.classList.add('hidden');
        gameInterface.classList.remove('hidden');
    }
    
    /**
     * Load configuration from server
     */
    async function loadConfig() {
        try {
            const response = await fetch(`${API_URL}/config`);
            const data = await response.json();
            
            // Update input fields and range sliders
            activeWordsInput.value = data.max_active_words;
            activeWordsRange.value = data.max_active_words;
            
            precomputeInput.value = data.precompute_nearest;
            precomputeRange.value = data.precompute_nearest;
            
            minLengthInput.value = data.min_word_length;
            minLengthRange.value = data.min_word_length;
        } catch (err) {
            console.error('Error loading configuration:', err);
            showToast('שגיאה', 'שגיאה בטעינת הגדרות המשחק', 'error');
        }
    }
    
    /**
     * Update game settings
     */
    async function updateSettings() {
        const activeWords = parseInt(activeWordsInput.value);
        const precompute = parseInt(precomputeInput.value);
        const minLength = parseInt(minLengthInput.value);
        
        // Validate inputs
        if (isNaN(activeWords) || isNaN(precompute) || isNaN(minLength)) {
            showToast('שגיאה', 'נא להזין מספרים תקינים', 'error');
            return;
        }
        
        if (activeWords < 100 || precompute < 100 || minLength < 2) {
            showToast('שגיאה', 'הערכים נמוכים מדי', 'error');
            return;
        }
        
        // Show loading screen while updating
        settingsModal.classList.remove('show');
        gameInterface.classList.add('hidden');
        loadingScreen.classList.remove('hidden');
        loadingStatus.textContent = 'מעדכן הגדרות...';
        loadingMessage.textContent = 'אנא המתן';
        
        try {
            const response = await fetch(`${API_URL}/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    max_active_words: activeWords,
                    precompute_nearest: precompute,
                    min_word_length: minLength
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                gameInitialized = false;
                setTimeout(checkStatus, 2000);
            } else {
                showToast('שגיאה', 'שגיאה בעדכון ההגדרות', 'error');
                hideLoading();
            }
        } catch (err) {
            console.error('Error updating settings:', err);
            showToast('שגיאה', 'שגיאה בעדכון ההגדרות', 'error');
            hideLoading();
        }
    }
    
    /**
     * Submit a guess word
     */
    async function submitGuess() {
        if (!gameInitialized) {
            showToast('המתן', 'המשחק עדיין בטעינה, אנא המתן', 'info');
            return;
        }
        
        const guess = guessInput.value.trim();
        
        if (!guess) {
            showMessage('אנא הכניסו מילה', 'error');
            return;
        }
        
        // Check if already guessed
        if (guesses.some(g => g.word === guess)) {
            showMessage('כבר ניחשת את המילה הזו', 'error');
            showToast('שים לב', 'כבר ניחשת את המילה הזו', 'warning');
            return;
        }
        
        try {
            showMessage('בודק...', 'info');
            
            const response = await fetch(`${API_URL}/guess`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ guess })
            });
            
            const data = await response.json();
            
            // Clear message
            showMessage('');
            
            // Handle errors
            if (data.similarity === -100) {
                showMessage('המילה אינה במילון המשחק', 'error');
                showToast('שגיאה', 'המילה אינה במילון המשחק', 'error');
                return;
            }
            
            // Process the guess data
            const guessData = {
                word: guess,
                similarity: data.similarity,
                percentile: data.percentile,
                rank: data.rank,
                totalWords: data.total_words,
                correct: data.correct
            };
            
            // Add to guesses and update UI
            addGuess(guessData);
            
            // Update last guess display
            updateLastGuess(guessData);
            
            // Update best percentile and progress bar
            if (data.percentile > bestPercentile) {
                bestPercentile = data.percentile;
                updateProgressBar();
                
                // Show encouragement based on progress
                if (bestPercentile >= 95 && !gameWon) {
                    showToast('כמעט שם!', 'אתה קרוב מאוד למילה!', 'success');
                } else if (bestPercentile >= 80 && bestPercentile < 95) {
                    showToast('התקדמות טובה!', 'אתה בכיוון הנכון!', 'success');
                } else if (bestPercentile >= 60 && bestPercentile < 80) {
                    showToast('התקדמות יפה', 'ממשיך להתקדם לקראת המילה', 'info');
                }
            }
            
            // Check if won
            if (data.correct) {
                gameWon = true;
                showMessage('כל הכבוד! מצאת את המילה!', 'success');
                showToast('ניצחון!', 'מצאת את המילה הנכונה!', 'success');
                guessInput.disabled = true;
                guessBtn.disabled = true;
                
            }
            
            // Clear input
            guessInput.value = '';
            guessInput.focus();
            
        } catch (err) {
            console.error('Error submitting guess:', err);
            showMessage('שגיאה בשליחת הניחוש', 'error');
            showToast('שגיאה', 'שגיאה בשליחת הניחוש', 'error');
        }
    }
    
    /**
     * Add a guess to the list and update UI
     */
    function addGuess(guessData) {
        // Add to array
        guesses.push(guessData);
        
        // Sort guesses by similarity (highest first)
        guesses.sort((a, b) => b.similarity - a.similarity);
        
        // Update UI
        updateGuessesList();
    }
    
    /**
     * Update the guesses list display
     */
    function updateGuessesList() {
        // Hide "no guesses" message if we have guesses
        if (guesses.length > 0) {
            noGuessesMessage.classList.add('hidden');
        }
        
        // Clear list
        guessesList.innerHTML = '';
        
        // Add each guess
        guesses.forEach(guess => {
            const row = document.createElement('tr');
            
            // Determine temperature class
            let tempClass = '';
            if (guess.correct) {
                tempClass = 'correct';
            } else if (guess.percentile >= 75) {
                tempClass = 'hot';
            } else if (guess.percentile >= 50) {
                tempClass = 'warm';
            } else if (guess.percentile >= 25) {
                tempClass = 'cold';
            } else {
                tempClass = 'very-cold';
            }
            
            row.innerHTML = `
                <td class="${tempClass}">${guess.word}</td>
                <td class="${tempClass}">${guess.similarity.toFixed(2)}</td>
                <td class="${tempClass}">${formatRank(guess.rank, guess.totalWords)}</td>
                <td class="${tempClass}">${guess.percentile.toFixed(2)}%</td>
            `;
            
            guessesList.appendChild(row);
        });
    }
    
    /**
     * Format the rank display
     */
    function formatRank(rank, totalWords) {
        // If the rank is far (in the bottom 25%), just say "רחוק מאוד"
        if (rank > totalWords * 0.75) {
            return "רחוק מאוד";
        }
        // If the rank is in the bottom half, just say "רחוק"
        else if (rank > totalWords * 0.5) {
            return "רחוק";
        }
        // Otherwise show the actual ranking
        return `${rank}/${totalWords}`;
    }
    
    /**
     * Update the last guess display
     */
    function updateLastGuess(guessData) {
        lastGuessCard.classList.remove('hidden');
        noLastGuess.classList.add('hidden');
        
        lastGuessWord.textContent = guessData.word;
        lastGuessSimilarity.textContent = guessData.similarity.toFixed(2);
        lastGuessRank.textContent = formatRank(guessData.rank, guessData.totalWords);
        lastGuessPercentile.textContent = guessData.percentile.toFixed(2) + '%';
        
        // Add color class based on percentile
        const colorClasses = ['very-cold', 'cold', 'warm', 'hot', 'correct'];
        colorClasses.forEach(cls => {
            lastGuessSimilarity.classList.remove(cls);
            lastGuessRank.classList.remove(cls);
            lastGuessPercentile.classList.remove(cls);
        });
        
        let colorClass;
        if (guessData.correct) {
            colorClass = 'correct';
        } else if (guessData.percentile >= 75) {
            colorClass = 'hot';
        } else if (guessData.percentile >= 50) {
            colorClass = 'warm';
        } else if (guessData.percentile >= 25) {
            colorClass = 'cold';
        } else {
            colorClass = 'very-cold';
        }
        
        lastGuessSimilarity.classList.add(colorClass);
        lastGuessRank.classList.add(colorClass);
        lastGuessPercentile.classList.add(colorClass);
    }
    
    /**
     * Update the progress bar
     */
    function updateProgressBar() {
        progressBar.style.width = `${bestPercentile}%`;
        progressLabel.textContent = `${bestPercentile.toFixed(0)}%`;
        
        // Update color based on progress
        if (bestPercentile >= 90) {
            progressBar.style.background = 'linear-gradient(to left, var(--success), var(--success-light, var(--success)))';
        } else if (bestPercentile >= 70) {
            progressBar.style.background = 'linear-gradient(to left, var(--warning), var(--warning-light, var(--warning)))';
        } else {
            progressBar.style.background = 'linear-gradient(to left, var(--accent-primary), var(--accent-secondary))';
        }
    }
    
    /**
     * Show a message in the message area
     */
    function showMessage(text, type = '') {
        messageEl.textContent = text;
        messageEl.className = 'message';
        
        if (type) {
            messageEl.classList.add(type);
        }
        
        // Auto-clear info messages after 5 seconds
        if (type === 'info' && text) {
            setTimeout(() => {
                if (messageEl.textContent === text) {
                    messageEl.textContent = '';
                }
            }, 5000);
        }
    }
    
    /**
     * Show a toast notification
     */
    function showToast(title, message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'times-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <p class="toast-message">${message}</p>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Remove toast after animation completes (5 seconds)
        setTimeout(() => {
            if (toast && toast.parentNode === toastContainer) {
                toastContainer.removeChild(toast);
            }
        }, 5000);
    }
    
    /**
     * Start a new game
     */
    async function startNewGame() {
        if (!gameInitialized) {
            showToast('המתן', 'המשחק עדיין בטעינה, אנא המתן', 'info');
            return;
        }
        
        try {
            // Reset game state
            guesses.length = 0;
            gameWon = false;
            bestPercentile = 0;
            
            // Reset UI
            guessesList.innerHTML = '';
            noGuessesMessage.classList.remove('hidden');
            lastGuessCard.classList.add('hidden');
            noLastGuess.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressLabel.textContent = '0%';
            showMessage('');
            guessInput.value = '';
            guessInput.disabled = false;
            guessBtn.disabled = false;
            
            // Request new game from server
            showMessage('מתחיל משחק חדש...', 'info');
            
            const response = await fetch(`${API_URL}/new_game`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('משחק חדש התחיל! נסו לנחש את המילה', 'info');
                showToast('משחק חדש', 'משחק חדש התחיל! נסו לנחש את המילה', 'info');
            } else {
                showMessage('שגיאה בהתחלת משחק חדש', 'error');
                showToast('שגיאה', 'שגיאה בהתחלת משחק חדש', 'error');
            }
            
            guessInput.focus();
            
        } catch (err) {
            console.error('Error starting new game:', err);
            showMessage('שגיאה בהתחלת משחק חדש', 'error');
            showToast('שגיאה', 'שגיאה בהתחלת משחק חדש', 'error');
        }
    }
    
    /**
     * Get a hint for the current word
     */
    async function getHint() {
        if (!gameInitialized) {
            showToast('המתן', 'המשחק עדיין בטעינה, אנא המתן', 'info');
            return;
        }
        
        if (gameWon) {
            showToast('משחק הסתיים', 'כבר ניצחת את המשחק!', 'info');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/hint`);
            const data = await response.json();
            
            if (data.hint) {
                showMessage(`רמז: האות הראשונה היא "${data.hint}"`, 'info');
                showToast('רמז', `האות הראשונה היא "${data.hint}"`, 'info');
            } else {
                showMessage('לא ניתן לקבל רמז כרגע', 'error');
                showToast('שגיאה', 'לא ניתן לקבל רמז כרגע', 'error');
            }
        } catch (err) {
            console.error('Error getting hint:', err);
            showMessage('שגיאה בקבלת רמז', 'error');
            showToast('שגיאה', 'שגיאה בקבלת רמז', 'error');
        }
    }

    
});