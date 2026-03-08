async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() {
    const users = localStorage.getItem('flagGameUsers');
    return users ? JSON.parse(users) : [];
}

function normalizeText(text) {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

if (document.getElementById('login-btn')) {
    const regBtn = document.getElementById('reg-btn');
    const loginBtn = document.getElementById('login-btn');
    const toggleSwitch = document.getElementById('flip-toggle');

    regBtn.addEventListener('click', async () => {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();

        if (!username || !email || !password) return alert("Lütfen tüm alanları doldurun!");

        const users = getUsers();
        if (users.some(u => u.username === username)) return alert("Bu kullanıcı adı zaten alınmış!");

        const hashedPassword = await hashPassword(password);
        users.push({ username, email, password: hashedPassword });
        localStorage.setItem('flagGameUsers', JSON.stringify(users));
        
        alert("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        document.getElementById('register-form').reset();
        if (toggleSwitch) toggleSwitch.checked = false; 
    });

    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!username || !password) return alert("Kullanıcı adı ve şifre giriniz!");

        const users = getUsers();
        const hashedPassword = await hashPassword(password);
        const user = users.find(u => u.username === username && u.password === hashedPassword);

        if (user) {
            localStorage.setItem('activeUser', user.username);
            window.location.href = "game.html"; 
        } else {
            alert("Kullanıcı adı veya şifre hatalı!");
        }
    });
}

if (document.getElementById('game-container')) {
    let allCountries = [];
    let gameCountries = [];
    let currentQuestionIndex = 0;
    let totalScore = 0;
    
    let currentDifficulty = 'medium';
    let baseTimeLimit = 25; 
    let currentRoundTime = 25; 
    let animationFrameId = null; 

    const activeUser = localStorage.getItem('activeUser');
    if (!activeUser) {
        window.location.href = "index.html";
    } else {
        document.getElementById('player-name').innerText = `Oyuncu: ${activeUser}`;
        fetchCountries();
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('activeUser');
        window.location.href = "index.html";
    });

    document.getElementById('go-home').addEventListener('click', () => {
        window.location.href = "index.html";
    });

    const btnPersonal = document.getElementById('btn-personal');
    const contentPersonal = document.getElementById('content-personal');
    const btnGlobal = document.getElementById('btn-global');
    const contentGlobal = document.getElementById('content-global');

    btnPersonal.addEventListener('click', () => {
        btnPersonal.classList.toggle('active');
        contentPersonal.classList.toggle('show');
    });

    btnGlobal.addEventListener('click', () => {
        btnGlobal.classList.toggle('active');
        contentGlobal.classList.toggle('show');
    });

    async function fetchCountries() {
        try {
            const res = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name,capital,population,flags');
            const data = await res.json();
            allCountries = data.filter(c => c.population && c.population > 0);
            
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('difficulty-screen').classList.remove('hidden');
            }, 1000); 
            
        } catch (error) {
            alert("Veriler çekilemedi. İnternet bağlantınızı kontrol edin.");
        }
    }

    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentDifficulty = e.target.getAttribute('data-diff');
            
            let filteredPool = [];
            if (currentDifficulty === 'easy') {
                filteredPool = allCountries.filter(c => c.population >= 20000000); 
                baseTimeLimit = 30;
            } else if (currentDifficulty === 'medium') {
                filteredPool = allCountries.filter(c => c.population >= 2000000 && c.population < 20000000); 
                baseTimeLimit = 25;
            } else if (currentDifficulty === 'hard') {
                filteredPool = allCountries.filter(c => c.population < 2000000); 
                baseTimeLimit = 20;
            }

            currentRoundTime = baseTimeLimit; 
            let shuffled = filteredPool.sort(() => 0.5 - Math.random());
            gameCountries = shuffled.slice(0, 10);
            
            startGame();
        });
    });

    function startGame() {
        currentQuestionIndex = 0;
        totalScore = 0;
        
        document.getElementById('difficulty-screen').classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        loadQuestion();
    }

    function startTimer() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        
        const fillEl = document.getElementById('timer-fill');
        const textEl = document.getElementById('time-text');
        
        fillEl.style.width = '100%';
        fillEl.style.background = 'linear-gradient(120deg, #ff758c 0%, #ff7eb3 100%)';
        textEl.style.color = '#ff758c';
        textEl.innerText = currentRoundTime;

        let duration = currentRoundTime * 1000;
        let startTime = performance.now();

        function updateAnimation(currentTime) {
            let elapsed = currentTime - startTime;
            let progress = elapsed / duration;

            if (progress >= 1) {
                fillEl.style.width = '0%';
                textEl.innerText = '0';
                evaluateGuess(true); 
                return; 
            }

            fillEl.style.width = (100 - (progress * 100)) + '%';
            let remaining = Math.ceil(currentRoundTime - (elapsed / 1000));
            textEl.innerText = remaining;

            if (remaining <= 5) {
                fillEl.style.background = '#ff4757';
                textEl.style.color = '#ff4757';
            }

            animationFrameId = requestAnimationFrame(updateAnimation);
        }

        animationFrameId = requestAnimationFrame(updateAnimation);
    }

    function validateInputs() {
        const n = document.getElementById('guess-name').value.trim();
        const c = document.getElementById('guess-capital').value.trim();
        const p = document.getElementById('guess-population').value.trim();
        const btn = document.getElementById('submit-guess');

        if (n !== '' || c !== '' || p !== '') {
            btn.disabled = false;
            btn.classList.remove('disabled-btn');
        } else {
            btn.disabled = true;
            btn.classList.add('disabled-btn');
        }
    }

    document.getElementById('guess-name').addEventListener('input', validateInputs);
    document.getElementById('guess-capital').addEventListener('input', validateInputs);
    document.getElementById('guess-population').addEventListener('input', validateInputs);

    function loadQuestion() {
        const country = gameCountries[currentQuestionIndex];
        
        document.getElementById('question-counter').innerText = `Soru: ${currentQuestionIndex + 1}/10`;
        document.getElementById('score-display').innerText = `Puan: ${totalScore}`;
        document.getElementById('flag-img').src = country.flags.png;
        
        document.getElementById('guess-name').value = '';
        document.getElementById('guess-capital').value = '';
        document.getElementById('guess-population').value = '';
        
        validateInputs(); 

        document.getElementById('input-section').classList.remove('hidden');
        document.getElementById('feedback-section').classList.add('hidden');

        startTimer();
    }

    function evaluateGuess(isTimeOut = false) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        const country = gameCountries[currentQuestionIndex];
        const actualName = country.name.common;
        const actualCapital = country.capital ? country.capital[0] : "";
        const actualPop = country.population;

        let points = 0;
        let feedbackMsg = "";

        if (isTimeOut) {
            feedbackMsg = `⏰ <b>SÜRE DOLDU! Puan Alınamadı.</b><br><br>Ülke: ${actualName}<br>Başkent: ${actualCapital || "Yok"}<br>Nüfus: ${actualPop.toLocaleString('tr-TR')}`;
        } else {
            const guessNameRaw = document.getElementById('guess-name').value.trim();
            const guessCapitalRaw = document.getElementById('guess-capital').value.trim();
            const guessPopRaw = document.getElementById('guess-population').value.trim();

            if (guessNameRaw === "") {
                feedbackMsg += `❌ Ülke: <b>${actualName}</b> (Boş)<br>`;
            } else if (normalizeText(guessNameRaw) === normalizeText(actualName)) {
                points += 10;
            } else {
                points -= 1; 
                feedbackMsg += `❌ Ülke: <b>${actualName}</b> (Yanlış)<br>`;
            }

            if (guessCapitalRaw === "") {
                feedbackMsg += `❌ Başkent: <b>${actualCapital || "Yok"}</b> (Boş)<br>`;
            } else if (normalizeText(guessCapitalRaw) === normalizeText(actualCapital)) {
                points += 10;
            } else {
                points -= 1; 
                feedbackMsg += `❌ Başkent: <b>${actualCapital || "Yok"}</b> (Yanlış)<br>`;
            }

            if (guessPopRaw === "") {
                feedbackMsg += `❌ Nüfus: <b>${actualPop.toLocaleString('tr-TR')}</b> (Boş)<br>`;
            } else {
                const guessPop = parseInt(guessPopRaw) || 0;
                const tolerance = actualPop * 0.10; 
                if (Math.abs(actualPop - guessPop) <= tolerance) {
                    points += 10;
                } else {
                    points -= 1; 
                    feedbackMsg += `❌ Nüfus: <b>${actualPop.toLocaleString('tr-TR')}</b> (Yanlış)<br>`;
                }
            }

            if (points > 0) {
                currentRoundTime = baseTimeLimit; 
            }
        }

        totalScore += points;

        const feedbackDiv = document.getElementById('feedback-text');
        if (points === 30 && !isTimeOut) {
            feedbackDiv.innerHTML = "✨ Kusursuz! 30 Puan kazandın.";
            feedbackDiv.className = "feedback-text success";
        } else {
            let baslik = isTimeOut ? "0 Puan" : `Bu sorudan <b>${points}</b> puan aldın.`;
            feedbackDiv.innerHTML = `${baslik}<br><br><b>Yanlışlar (Olması Gerekenler):</b><br>${feedbackMsg}`;
            feedbackDiv.className = "feedback-text error";
        }

        document.getElementById('input-section').classList.add('hidden');
        document.getElementById('feedback-section').classList.remove('hidden');
        document.getElementById('score-display').innerText = `Puan: ${totalScore}`;
    }

    document.getElementById('submit-guess').addEventListener('click', () => evaluateGuess(false));

    document.getElementById('skip-question').addEventListener('click', () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        currentRoundTime = Math.max(5, currentRoundTime - 5);
        currentQuestionIndex++;
        if (currentQuestionIndex < 10) {
            loadQuestion();
        } else {
            endGame();
        }
    });

    document.getElementById('next-question').addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < 10) {
            loadQuestion();
        } else {
            endGame();
        }
    });

    function saveScore() {
        let scores = JSON.parse(localStorage.getItem('flagGameScores')) || [];
        scores.push({
            user: activeUser,
            score: totalScore,
            date: new Date().toLocaleDateString('tr-TR')
        });
        localStorage.setItem('flagGameScores', JSON.stringify(scores));
        updateScoreboards();
    }

    function updateScoreboards() {
        let scores = JSON.parse(localStorage.getItem('flagGameScores')) || [];
        
        let personalScores = scores.filter(s => s.user === activeUser).reverse().slice(0, 10);
        let personalHTML = `<tr><th>Tarih</th><th>Puan</th></tr>`;
        if(personalScores.length === 0) personalHTML += `<tr><td colspan="2" style="text-align:center;">Henüz oyun yok.</td></tr>`;
        personalScores.forEach(s => {
            personalHTML += `<tr><td>${s.date}</td><td>${s.score}</td></tr>`;
        });
        document.getElementById('personal-board').innerHTML = personalHTML;

        let globalScores = [...scores].sort((a, b) => b.score - a.score).slice(0, 10);
        let globalHTML = `<tr><th>Oyuncu</th><th>Puan</th></tr>`;
        if(globalScores.length === 0) globalHTML += `<tr><td colspan="2" style="text-align:center;">Henüz skor yok.</td></tr>`;
        globalScores.forEach(s => {
            globalHTML += `<tr><td>${s.user}</td><td>${s.score}</td></tr>`;
        });
        document.getElementById('global-board').innerHTML = globalHTML;
    }

    function endGame() {
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('end-screen').classList.remove('hidden');
        document.getElementById('final-score').innerText = totalScore;
        
        btnPersonal.classList.remove('active');
        contentPersonal.classList.remove('show');
        btnGlobal.classList.remove('active');
        contentGlobal.classList.remove('show');

        saveScore();
    }

    document.getElementById('play-again').addEventListener('click', () => {
        document.getElementById('end-screen').classList.add('hidden');
        document.getElementById('difficulty-screen').classList.remove('hidden');
    });
}