const STORAGE_KEY = 'pomodoro_balanceado_data';
const TIME_30_MIN = 30 * 60;

const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anon';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let timer;
let isRunning = false;
let timeLeft = TIME_30_MIN;
let participants = {};
let currentPerson = '';
let registrationTimes = {};
let darkMode = false;

const motivationalMessages = [
    'Parabens meu Amorzin! Você é foda',
    'Você arrasou, meu amor! Agora pode vir buscar seus 30 minutinhos de prazer.',
    'Mandou muito bem! Te busco no metrô.',
    'Orgulho de você, amoR! Estudou bonito, agora merece um beijinho.',
    'Você conseguiu! Desbloqueou um tapa na cara sua safada',
    'Mais uma vitória sua! Continue assim que eu vou caprichar depois.',
    'Parabés sua puta goxtosa! Agora pode vir me dar um beijo.'
];

function readStoredData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
            participants = parsed.participants || {};
            currentPerson = parsed.currentPerson || '';
            registrationTimes = parsed.registrationTimes || {};
            darkMode = Boolean(parsed.darkMode);
        }
    } catch (error) {
        console.warn('Erro ao carregar dados salvos:', error);
    }
}

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        participants,
        currentPerson,
        registrationTimes,
        darkMode
    }));
}

function formatRegistrationTime(timestamp) {
    if (!timestamp) return '';

    return 'Último registro: ' + new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(timestamp));
}

function toggleDarkMode() {
    darkMode = !darkMode;
    applyTheme();
    saveToLocalStorage();
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', darkMode);
    const themeToggle = document.getElementById('themeToggle');
    const label = darkMode ? 'Ativar modo claro' : 'Ativar modo noturno';

    themeToggle.textContent = darkMode ? '☀' : '☾';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function getMotivationalMessage() {
    const randomIndex = Math.floor(Math.random() * motivationalMessages.length);
    return motivationalMessages[randomIndex];
}

function notifyFocusComplete(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(message);
        return;
    }

    alert(message);
}

function formatTime(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCurrentBalance() {
    return participants[currentPerson] || 0;
}

function enterApp(nome) {
    if (!participants[nome]) {
        participants[nome] = 0;
    }

    currentPerson = nome;
    saveToLocalStorage();
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('ready');
    updateCurrentPersonUI();
    updateParticipantsList();
    updateBancoDisplay();
}

function setCurrentPerson() {
    const nome = document.getElementById('personName').value.trim();

    if (!nome) {
        alert('Selecione quem está registrando.');
        return;
    }

    enterApp(nome);
}

function selectPerson(nome) {
    currentPerson = nome;
    document.getElementById('personName').value = nome;
    saveToLocalStorage();
    updateCurrentPersonUI();
    updateParticipantsList();
    updateBancoDisplay();
}

function updateCurrentPersonUI() {
    document.getElementById('currentPersonLabelText').textContent = currentPerson || 'Ninguém';
    document.getElementById('currentGreeting').textContent = currentPerson
        ? `Oi ${currentPerson}, vamos ser produtiva hoje?`
        : '';
}

function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    const entries = Object.entries(participants).sort((a, b) => b[1] - a[1]);

    if (!entries.length) {
        list.innerHTML = '<li>Nenhuma pessoa cadastrada.</li>';
        return;
    }

    list.innerHTML = entries.map(([nome, saldo]) => {
        const selectedClass = nome === currentPerson ? 'selected' : '';
        return `
            <li class="person-row ${selectedClass}">
                <button class="person-select" type="button" data-name="${nome}">${nome}</button>
                <span class="person-time">
                    <strong>${formatTime(saldo)}</strong>
                    ${formatRegistrationTime(registrationTimes[nome])}
                </span>
            </li>
        `;
    }).join('');

    list.querySelectorAll('.person-select').forEach((button) => {
        button.addEventListener('click', () => selectPerson(button.dataset.name));
    });
}

function toggleTimer() {
    const startBtn = document.getElementById('startBtn');

    if (!currentPerson) {
        alert('Primeiro informe quem está registrando para começar.');
        return;
    }

    if (isRunning) {
        clearInterval(timer);
        isRunning = false;
        startBtn.textContent = 'Iniciar foco';
        startBtn.classList.remove('running');
        return;
    }

    isRunning = true;
    requestNotificationPermission();
    startBtn.textContent = 'Pausar foco';
    startBtn.classList.add('running');

    timer = setInterval(() => {
        timeLeft--;

        if (timeLeft <= 0) {
            clearInterval(timer);
            isRunning = false;
            startBtn.textContent = 'Iniciar foco';
            startBtn.classList.remove('running');
            addFocusCycle(false);
            return;
        }

        updateDisplay();
    }, 1000);
}

function addFocusCycle(isManual = false) {
    if (!currentPerson) {
        alert('Selecione uma pessoa antes de registrar o foco.');
        return;
    }

    if (isRunning) {
        clearInterval(timer);
        isRunning = false;
        document.getElementById('startBtn').textContent = 'Iniciar foco';
        document.getElementById('startBtn').classList.remove('running');
    }

    participants[currentPerson] = (participants[currentPerson] || 0) + TIME_30_MIN;
    registrationTimes[currentPerson] = new Date().toISOString();
    timeLeft = TIME_30_MIN;
    updateDisplay();
    updateBancoDisplay();
    updateParticipantsList();
    saveToLocalStorage();

    const message = getMotivationalMessage();

    if (isManual) {
        alert(message);
    } else {
        notifyFocusComplete(message);
    }
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timerDisplay').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateBancoDisplay() {
    const bloco = document.querySelector('.banco-horas');
    const nome = currentPerson || 'Ninguém';
    const saldo = getCurrentBalance();
    const timestamp = registrationTimes[currentPerson];

    if (!currentPerson || saldo <= 0) {
        bloco.classList.remove('visible');
        document.getElementById('currentPersonLabelText').textContent = 'Ninguém';
        document.getElementById('bancoDisplay').textContent = '00:00';
        document.getElementById('lastRegistration').textContent = '';
        return;
    }

    bloco.classList.add('visible');
    document.getElementById('currentPersonLabelText').textContent = nome;
    document.getElementById('bancoDisplay').textContent = formatTime(saldo);
    document.getElementById('lastRegistration').textContent = formatRegistrationTime(timestamp);
}

function showWelcomeScreen() {
    if (isRunning) {
        clearInterval(timer);
        isRunning = false;
        document.getElementById('startBtn').textContent = 'Iniciar foco';
        document.getElementById('startBtn').classList.remove('running');
    }

    currentPerson = '';
    saveToLocalStorage();
    document.getElementById('appContainer').classList.remove('ready');
    document.getElementById('welcomeScreen').style.display = 'flex';
}

function returnToWelcome() {
    showWelcomeScreen();
}

function resetAll() {
    if (!confirm('Tem certeza que deseja zerar tudo?')) {
        return;
    }

    if (isRunning) {
        clearInterval(timer);
        isRunning = false;
    }

    participants = {};
    currentPerson = '';
    registrationTimes = {};
    timeLeft = TIME_30_MIN;
    document.getElementById('startBtn').textContent = 'Iniciar foco';
    document.getElementById('startBtn').classList.remove('running');
    saveToLocalStorage();
    updateCurrentPersonUI();
    updateParticipantsList();
    updateBancoDisplay();
    updateDisplay();
    showWelcomeScreen();
}

document.addEventListener('DOMContentLoaded', () => {
    readStoredData();
    applyTheme();
    updateCurrentPersonUI();
    updateParticipantsList();
    updateDisplay();
    updateBancoDisplay();
});
