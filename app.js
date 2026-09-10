const STORAGE_KEY = 'pomodoro_balanceado_data';
const TIME_30_MIN = 30 * 60;

const SUPABASE_URL = 'https://vutatahxfszwfnbjpaqe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sW5zcadmG7yWcInb9SCm4g_ltBAIqRn';
const PROFILE_EMAILS = {
    Kah: 'kah@mimifoco.app',
    Mimi: 'mimi@mimifoco.app'
};

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
let remoteDataLoaded = false;
let authenticatedUser = null;
let backgroundStartedAt = null;

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

async function loadRemoteRecords() {
    const { data, error } = await supabaseClient
        .from('focus_records')
        .select('person, minutes, entry_type, registered_at')
        .order('registered_at', { ascending: false });

    if (error) {
        console.warn('Não foi possível carregar os registros do Supabase:', error.message);
        return;
    }

    const remoteParticipants = {};
    const remoteRegistrationTimes = {};

    data.forEach((record) => {
        const multiplier = record.entry_type === 'leisure' ? -1 : 1;
        remoteParticipants[record.person] = (remoteParticipants[record.person] || 0) + (record.minutes * 60 * multiplier);
        if (record.entry_type !== 'leisure' && !remoteRegistrationTimes[record.person]) {
            remoteRegistrationTimes[record.person] = record.registered_at;
        }
    });

    participants = remoteParticipants;
    registrationTimes = remoteRegistrationTimes;
    remoteDataLoaded = true;
    saveToLocalStorage();
    updateParticipantsList();
    updateBancoDisplay();
}

async function saveRemoteRecord(timestamp) {
    const { error } = await supabaseClient
        .from('focus_records')
        .insert({
            person: currentPerson,
            user_id: authenticatedUser.id,
            minutes: 30,
            entry_type: 'focus',
            registered_at: timestamp
        });

    if (error) {
        console.warn('Não foi possível salvar no Supabase:', error.message);
        alert('O ciclo foi registrado neste aparelho, mas não foi possível sincronizar com a nuvem.');
        return false;
    }

    return true;
}

async function completeLeisure() {
    if (!currentPerson || getCurrentBalance() < TIME_30_MIN) {
        return;
    }

    const timestamp = new Date().toISOString();
    const { error } = await supabaseClient
        .from('focus_records')
        .insert({
            person: currentPerson,
            user_id: authenticatedUser.id,
            minutes: 30,
            entry_type: 'leisure',
            registered_at: timestamp
        });

    if (error) {
        alert('Não foi possível marcar o lazer como cumprido.\n\n' + error.message);
        console.warn('Não foi possível registrar o lazer:', error.message);
        return;
    }

    participants[currentPerson] -= TIME_30_MIN;
    updateBancoDisplay();
    updateParticipantsList();
    saveToLocalStorage();
}

async function resetCurrentPerson() {
    if (!currentPerson) {
        alert('Selecione uma pessoa antes de zerar o saldo.');
        return;
    }

    const confirmed = confirm(`Tem certeza que deseja apagar todos os registros de ${currentPerson}?`);
    if (!confirmed) return;

    const { error } = await supabaseClient
        .from('focus_records')
        .delete()
        .eq('person', currentPerson)
        .eq('user_id', authenticatedUser.id);

    if (error) {
        alert('Não foi possível apagar os registros na nuvem.\n\n' + error.message);
        console.warn('Não foi possível zerar o saldo:', error.message);
        return;
    }

    participants[currentPerson] = 0;
    delete registrationTimes[currentPerson];
    saveToLocalStorage();
    updateParticipantsList();
    updateBancoDisplay();
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

async function loginProfile(event) {
    event.preventDefault();
    const person = document.getElementById('loginPerson').value;
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');

    errorElement.textContent = '';
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: PROFILE_EMAILS[person],
        password
    });

    if (error) {
        errorElement.textContent = 'Perfil ou senha incorretos.';
        return;
    }

    authenticatedUser = data.user;
    currentPerson = person;
    document.getElementById('loginPassword').value = '';
    saveToLocalStorage();
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('ready');
    updateCurrentPersonUI();
    await loadRemoteRecords();
}

function openPasswordDialog() {
    document.getElementById('passwordMessage').textContent = '';
    document.getElementById('passwordDialog').showModal();
}

function closePasswordDialog() {
    document.getElementById('passwordDialog').close();
}

async function changePassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('confirmPassword').value;
    const message = document.getElementById('passwordMessage');

    if (newPassword !== confirmation) {
        message.textContent = 'As senhas não são iguais.';
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) {
        message.textContent = error.message;
        return;
    }

    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    closePasswordDialog();
    alert('Senha alterada com sucesso.');
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

function stopTimerUI() {
    clearInterval(timer);
    isRunning = false;
    document.getElementById('startBtn').textContent = 'Iniciar foco';
    document.getElementById('startBtn').classList.remove('running');
}

function finishFocusCycle() {
    stopTimerUI();
    addFocusCycle(false);
}

function syncTimerAfterBackground() {
    if (!isRunning || !backgroundStartedAt) {
        return;
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - backgroundStartedAt) / 1000));
    if (elapsedSeconds <= 0) {
        backgroundStartedAt = null;
        return;
    }

    timeLeft -= elapsedSeconds;
    backgroundStartedAt = null;

    if (timeLeft <= 0) {
        timeLeft = 0;
        updateDisplay();
        finishFocusCycle();
        return;
    }

    updateDisplay();
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
    document.getElementById('currentGreeting').innerHTML = currentPerson
        ? `Oi <strong>${currentPerson}</strong>, vamos ser produtiva hoje?`
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
            timeLeft = 0;
            updateDisplay();
            finishFocusCycle();
            return;
        }

        updateDisplay();
    }, 1000);
}

async function addFocusCycle(isManual = false) {
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

    const timestamp = new Date().toISOString();
    participants[currentPerson] = (participants[currentPerson] || 0) + TIME_30_MIN;
    registrationTimes[currentPerson] = timestamp;
    timeLeft = TIME_30_MIN;
    updateDisplay();
    updateBancoDisplay();
    updateParticipantsList();
    saveToLocalStorage();
    await saveRemoteRecord(timestamp);

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

    authenticatedUser = null;
    currentPerson = '';
    supabaseClient.auth.signOut();
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

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isRunning) {
        backgroundStartedAt = Date.now();
        return;
    }

    if (document.visibilityState === 'visible' && backgroundStartedAt) {
        syncTimerAfterBackground();
    }
});

window.addEventListener('blur', () => { 
    if (isRunning) {
        backgroundStartedAt = Date.now();
    }
});

window.addEventListener('focus', () => {
    if (isRunning && backgroundStartedAt) {
        syncTimerAfterBackground();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    readStoredData();
    applyTheme();
    supabaseClient.auth.getSession().then(({ data }) => {
        authenticatedUser = data.session?.user || null;
        if (authenticatedUser) {
            const profile = Object.entries(PROFILE_EMAILS).find(([, email]) => email === authenticatedUser.email)?.[0];
            currentPerson = profile || '';
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('appContainer').classList.add('ready');
            updateCurrentPersonUI();
            updateParticipantsList();
            updateDisplay();
            updateBancoDisplay();
            loadRemoteRecords();
        }
    });
});
