
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

        if (!username || !email || !password) return alert("Tüm alanları doldur!");

        const users = getUsers();
        if (users.some(u => u.username === username)) return alert("Bu kullanıcı adı alınmış!");

        const hashedPassword = await hashPassword(password);
        users.push({ username, email, password: hashedPassword });
        localStorage.setItem('flagGameUsers', JSON.stringify(users));
        
        alert("Kayıt başarılı! Giriş yapabilirsin.");
        document.getElementById('register-form').reset();
        
        
        if(toggleSwitch) toggleSwitch.checked = false; 
    });

    
    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!username || !password) return alert("Bilgileri girin!");

        const users = getUsers();
        const hashedPassword = await hashPassword(password);
        const user = users.find(u => u.username === username && u.password === hashedPassword);

        if (user) {
            localStorage.setItem('activeUser', user.username);
            window.location.href = "game.html"; 
        } else {
            alert("Hatalı bilgi!");
        }
    });
}

if (document.getElementById('game-container')) {
    let allCountries = [];
    let gameCountries = [];
    let currentQuestionIndex = 0;
    let totalScore = 0;

    
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

    
    async function fetchCountries() {
        try {
            const res = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name,capital,population,flags');
            allCountries = await res.json();
            
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            startGame();
        } catch (error) {
            alert("Veriler çekilemedi. İnternet bağlantınızı kontrol edin.");
        }
    }

    function startGame() {
        let shuffled = allCountries.sort(() => 0.5 - Math.random());
        gameCountries = shuffled.slice(0, 10);
        currentQuestionIndex = 0;
        totalScore = 0;
        
        document.getElementById('end-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        loadQuestion();
    }

    function loadQuestion() {
        const country = gameCountries[currentQuestionIndex];
        
        document.getElementById('question-counter').innerText = `Soru: ${currentQuestionIndex + 1}/10`;
        document.getElementById('score-display').innerText = `Puan: ${totalScore}`;
        document.getElementById('flag-img').src = country.flags.png;
        
        document.getElementById('guess-name').value = '';
        document.getElementById('guess-capital').value = '';
        document.getElementById('guess-population').value = '';
        document.getElementById('input-section').classList.remove('hidden');
        document.getElementById('feedback-section').classList.add('hidden');
    }

    document.getElementById('submit-guess').addEventListener('click', () => {
        const country = gameCountries[currentQuestionIndex];
        
        const actualName = country.name.common;
        const actualCapital = country.capital ? country.capital[0] : "";
        const actualPop = country.population;

        const guessName = document.getElementById('guess-name').value;
        const guessCapital = document.getElementById('guess-capital').value;
        const guessPop = parseInt(document.getElementById('guess-population').value) || 0;

        let points = 0;
        let feedbackMsg = "";

        
        if (normalizeText(guessName) === normalizeText(actualName)) points += 10;
        else feedbackMsg += `❌ Ülke: <b>${actualName}</b><br>`;

        if (normalizeText(guessCapital) === normalizeText(actualCapital)) points += 10;
        else feedbackMsg += `❌ Başkent: <b>${actualCapital || "Yok"}</b><br>`;

        const tolerance = actualPop * 0.10; 
        if (Math.abs(actualPop - guessPop) <= tolerance) points += 10;
        else feedbackMsg += `❌ Nüfus: <b>${actualPop.toLocaleString('tr-TR')}</b><br>`;

        totalScore += points;

       
        const feedbackDiv = document.getElementById('feedback-text');
        if (points === 30) {
            feedbackDiv.innerHTML = "✨ Kusursuz! 30 Puan kazandın.";
            feedbackDiv.className = "feedback-text success";
        } else {
            feedbackDiv.innerHTML = `Bu sorudan <b>${points}</b> puan aldın.<br><br><b>Doğrular:</b><br>${feedbackMsg}`;
            feedbackDiv.className = "feedback-text error";
        }

        document.getElementById('input-section').classList.add('hidden');
        document.getElementById('feedback-section').classList.remove('hidden');
        document.getElementById('score-display').innerText = `Puan: ${totalScore}`;
    });

    document.getElementById('next-question').addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < 10) {
            loadQuestion();
        } else {
           
            document.getElementById('game-container').classList.add('hidden');
            document.getElementById('end-screen').classList.remove('hidden');
            document.getElementById('final-score').innerText = totalScore;
            
            // SKORBOARD
        }
    });

    document.getElementById('play-again').addEventListener('click', startGame);
}