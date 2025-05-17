// إعداد المتغيرات العامة
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
const scanQRBtn = document.getElementById('scanQRBtn');
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
scanQRBtn.addEventListener('click', initQRScanner);
muteBtn.addEventListener('click', toggleMute);
leaveBtn.addEventListener('click', leaveRoom);
closeTutorial.addEventListener('click', () => tutorial.classList.add('hidden'));
copyCodeBtn.addEventListener('click', copyRoomCode);

// دالة إنشاء اتصال WebSocket
function initializeWebSocket() {
    socket = new WebSocket('wss://your-websocket-server.com'); // قم بتغيير هذا الرابط إلى خادم WebSocket الخاص بك

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
    }
}

// دالة إنشاء غرفة جديدة
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
        
        // إرسال معلومات الغرفة للخادم
        socket.send(JSON.stringify({
            type: 'CREATE_ROOM',
            roomCode,
            userName
        }));
    } catch (error) {
        showNotification('حدث خطأ أثناء إنشاء الغرفة: ' + error.message, 'error');
    }
}

// دالة الانضمام إلى غرفة
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
        
        // إرسال طلب انضمام
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

// دالة عرض طلب انضمام
function showJoinRequest(requesterName) {
    const requestDiv = document.createElement('div');
    requestDiv.className = 'join-request';
    requestDiv.innerHTML = `
        <span class="requester-name">${requesterName}</span>
        <div class="request-actions">
            <button class="btn accept" onclick="acceptJoinRequest('${requesterName}')">
                <i class="fas fa-check"></i> قبول
            </button>
            <button class="btn reject" onclick="rejectJoinRequest('${requesterName}')">
                <i class="fas fa-times"></i> رفض
            </button>
        </div>
    `;
    requestsList.appendChild(requestDiv);
}

// دالة قبول طلب الانضمام
function acceptJoinRequest(requesterName) {
    socket.send(JSON.stringify({
        type: 'JOIN_ACCEPTED',
        roomCode,
        userName: requesterName
    }));
    removeJoinRequest(requesterName);
    addParticipant(requesterName);
}

// دالة رفض طلب الانضمام
function rejectJoinRequest(requesterName) {
    socket.send(JSON.stringify({
        type: 'JOIN_REJECTED',
        roomCode,
        userName: requesterName
    }));
    removeJoinRequest(requesterName);
}

// دالة إزالة طلب الانضمام
function removeJoinRequest(requesterName) {
    const request = requestsList.querySelector(`[data-name="${requesterName}"]`);
    if (request) {
        request.remove();
    }
}

// دالة معالجة قبول الانضمام
function handleJoinAccepted(data) {
    showActiveRoom();
    displayRoomCode(roomCode);
    roomNumber.textContent = roomCode;
    showNotification('تم قبول طلب انضمامك للغرفة', 'success');
}

// دالة معالجة رفض الانضمام
function handleJoinRejected() {
    leaveRoom();
    showNotification('تم رفض طلب انضمامك للغرفة', 'error');
}

// دالة إضافة مشارك جديد
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

// دالة إزالة مشارك
function removeParticipant(name) {
    const participant = participants.querySelector(`[data-name="${name}"]`);
    if (participant) {
        participant.remove();
    }
}

// دالة عرض الإشعارات
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    notifications.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ... باقي الدوال الموجودة مسبقاً ...
