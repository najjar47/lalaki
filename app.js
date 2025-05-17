// المتغيرات العامة
let localStream = null;
let peerConnection = null;
let roomCode = null;
let isMuted = false;
let userName = '';
let socket = null;
let isRoomOwner = false;

// تهيئة عناصر الواجهة
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCode');
const userNameInput = document.getElementById('userName');
const userName2Input = document.getElementById('userName2');
const activeRoom = document.getElementById('activeRoom');
const roomNumber = document.getElementById('roomNumber');
const participants = document.getElementById('participants');
const muteBtn = document.getElementById('muteBtn');
const leaveBtn = document.getElementById('leaveBtn');
const tutorial = document.getElementById('tutorial');
const closeTutorial = document.getElementById('closeTutorial');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const displayedRoomCode = document.getElementById('displayedRoomCode');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const copyMessage = document.getElementById('copyMessage');
const joinRequests = document.getElementById('joinRequests');
const requestsList = document.getElementById('requestsList');
const connectionStatus = document.getElementById('connectionStatus');
const notifications = document.getElementById('notifications');

// إضافة مستمعي الأحداث
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
muteBtn.addEventListener('click', toggleMute);
leaveBtn.addEventListener('click', leaveRoom);
closeTutorial.addEventListener('click', () => tutorial.classList.add('hidden'));
copyCodeBtn.addEventListener('click', copyRoomCode);

// دالة إنشاء اتصال WebSocket
function initializeWebSocket() {
    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        updateConnectionStatus(true);
    };

    socket.onclose = () => {
        updateConnectionStatus(false);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
}

// دالة تحديث حالة الاتصال
function updateConnectionStatus(connected) {
    connectionStatus.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
    connectionStatus.innerHTML = `<i class="fas fa-circle"></i> ${connected ? 'متصل' : 'غير متصل'}`;
}

// دالة معالجة رسائل WebSocket
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'JOIN_REQUEST':
            if (isRoomOwner) {
                showJoinRequest(data.userName);
            }
            break;
        case 'JOIN_ACCEPTED':
            handleJoinAccepted(data);
            break;
        case 'JOIN_REJECTED':
            handleJoinRejected();
            break;
        case 'PARTICIPANT_LEFT':
            removeParticipant(data.userName);
            break;
        case 'ROOM_CLOSED':
            handleRoomClosed();
            break;
    }
}

// دوال إدارة الغرف
async function createRoom() {
    const name = userNameInput.value.trim();
    if (!name) {
        showNotification('الرجاء إدخال اسمك أولاً', 'error');
        return;
    }

    try {
        userName = name;
        isRoomOwner = true;
        roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        await initializeMediaStream();
        initializeWebSocket();
        showActiveRoom();
        displayRoomCode(roomCode);
        roomNumber.textContent = roomCode;
        joinRequests.classList.remove('hidden');
        
        socket.send(JSON.stringify({
            type: 'CREATE_ROOM',
            roomCode,
            userName
        }));
    } catch (error) {
        showNotification('حدث خطأ أثناء إنشاء الغرفة: ' + error.message, 'error');
    }
}

async function joinRoom() {
    const name = userName2Input.value.trim();
    const code = roomCodeInput.value.trim();
    
    if (!name) {
        showNotification('الرجاء إدخال اسمك أولاً', 'error');
        return;
    }
    
    if (code.length !== 6 || isNaN(code)) {
        showNotification('الرجاء إدخال رمز صحيح مكون من 6 أرقام', 'error');
        return;
    }

    try {
        userName = name;
        roomCode = code;
        await initializeMediaStream();
        initializeWebSocket();
        
        socket.send(JSON.stringify({
            type: 'JOIN_REQUEST',
            roomCode,
            userName
        }));
        
        showNotification('تم إرسال طلب الانضمام، في انتظار موافقة مدير الغرفة', 'info');
    } catch (error) {
        showNotification('حدث خطأ أثناء الانضمام إلى الغرفة: ' + error.message, 'error');
    }
}

// دوال إدارة المشاركين
function addParticipant(name) {
    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant';
    participantDiv.setAttribute('data-name', name);
    participantDiv.innerHTML = `
        <div class="participant-info">
            <i class="fas fa-user"></i>
            <span class="participant-name">${name}</span>
        </div>
        <div class="audio-indicator">
            <i class="fas fa-microphone"></i>
        </div>
    `;
    participants.appendChild(participantDiv);
}

function removeParticipant(name) {
    const participant = participants.querySelector(`[data-name="${name}"]`);
    if (participant) {
        participant.remove();
    }
}

// دوال إدارة طلبات الانضمام
function showJoinRequest(requesterName) {
    const requestDiv = document.createElement('div');
    requestDiv.className = 'join-request';
    requestDiv.setAttribute('data-name', requesterName);
    
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn accept';
    acceptBtn.innerHTML = '<i class="fas fa-check"></i> قبول';
    
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn reject';
    rejectBtn.innerHTML = '<i class="fas fa-times"></i> رفض';
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'request-actions';
    actionsDiv.appendChild(acceptBtn);
    actionsDiv.appendChild(rejectBtn);
    
    requestDiv.innerHTML = `
        <span class="requester-name">${requesterName}</span>
    `;
    requestDiv.appendChild(actionsDiv);
    
    // إضافة event listeners
    acceptBtn.addEventListener('click', () => acceptJoinRequest(requesterName));
    rejectBtn.addEventListener('click', () => rejectJoinRequest(requesterName));
    
    requestsList.appendChild(requestDiv);
}

function acceptJoinRequest(requesterName) {
    socket.send(JSON.stringify({
        type: 'JOIN_ACCEPTED',
        roomCode,
        userName: requesterName
    }));
    removeJoinRequest(requesterName);
    addParticipant(requesterName);
}

function rejectJoinRequest(requesterName) {
    socket.send(JSON.stringify({
        type: 'JOIN_REJECTED',
        roomCode,
        userName: requesterName
    }));
    removeJoinRequest(requesterName);
}

function removeJoinRequest(requesterName) {
    const request = requestsList.querySelector(`[data-name="${requesterName}"]`);
    if (request) {
        request.remove();
    }
}

// دوال معالجة الأحداث
function handleJoinAccepted(data) {
    showActiveRoom();
    displayRoomCode(roomCode);
    roomNumber.textContent = roomCode;
    showNotification('تم قبول طلب انضمامك للغرفة', 'success');
}

function handleJoinRejected() {
    leaveRoom();
    showNotification('تم رفض طلب انضمامك للغرفة', 'error');
}

function handleRoomClosed() {
    leaveRoom();
    showNotification('تم إغلاق الغرفة من قبل المدير', 'info');
}

// دوال إدارة الوسائط
async function initializeMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
        addParticipant('أنت');
    } catch (error) {
        throw new Error('لم نتمكن من الوصول إلى الميكروفون');
    }
}

function toggleMute() {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteBtn.innerHTML = `
            <i class="fas fa-${isMuted ? 'microphone-slash' : 'microphone'}"></i>
            <span>${isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}</span>
        `;
    }
}

// دوال واجهة المستخدم
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                        type === 'success' ? 'check-circle' : 
                        'info-circle'}"></i>
        <span>${message}</span>
    `;
    notifications.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function displayRoomCode(code) {
    roomCodeDisplay.classList.remove('hidden');
    displayedRoomCode.textContent = code;
}

async function copyRoomCode() {
    try {
        await navigator.clipboard.writeText(roomCode);
        copyMessage.classList.add('show');
        setTimeout(() => copyMessage.classList.remove('show'), 2000);
    } catch (error) {
        showNotification('حدث خطأ أثناء نسخ الرمز', 'error');
    }
}

// دوال التنظيف والإغلاق
function leaveRoom() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (socket) {
        socket.send(JSON.stringify({
            type: 'LEAVE_ROOM',
            roomCode
        }));
        socket.close();
    }

    roomCode = null;
    isRoomOwner = false;
    participants.innerHTML = '';
    activeRoom.classList.add('hidden');
    roomCodeDisplay.classList.add('hidden');
    document.querySelector('.room-section').classList.remove('hidden');
}

function showActiveRoom() {
    document.querySelector('.room-section').classList.add('hidden');
    activeRoom.classList.remove('hidden');
}

// التحقق من دعم المتصفح
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showNotification('متصفحك لا يدعم المكالمات الصوتية. الرجاء استخدام متصفح حديث.', 'error');
}
