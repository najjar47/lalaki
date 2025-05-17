// إعداد المتغيرات العامة
let localStream = null;
let peerConnections = {};
let roomCode = null;
let isMuted = false;
let isRoomOwner = false;
let currentUser = null;
let participants = new Map();

// تهيئة عناصر الواجهة
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const scanQRBtn = document.getElementById('scanQRBtn');
const roomCodeInput = document.getElementById('roomCode');
const userNameInput = document.getElementById('userName');
const userName2Input = document.getElementById('userName2');
const activeRoom = document.getElementById('activeRoom');
const roomNumber = document.getElementById('roomNumber');
const participantsContainer = document.getElementById('participants');
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
const notifications = document.getElementById('notifications');

// إضافة مستمعي الأحداث
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
scanQRBtn.addEventListener('click', initQRScanner);
muteBtn.addEventListener('click', toggleMute);
leaveBtn.addEventListener('click', leaveRoom);
closeTutorial.addEventListener('click', () => tutorial.classList.add('hidden'));
copyCodeBtn.addEventListener('click', copyRoomCode);

// دالة إنشاء غرفة جديدة
async function createRoom() {
    const userName = userNameInput.value.trim();
    if (!userName) {
        showNotification('الرجاء إدخال اسمك أولاً', 'error');
        return;
    }

    try {
        roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        currentUser = {
            id: generateUserId(),
            name: userName,
            isOwner: true
        };
        isRoomOwner = true;
        
        await initializeMediaStream();
        showActiveRoom();
        displayRoomCode(roomCode);
        roomNumber.textContent = roomCode;
        
        // إظهار قسم طلبات الانضمام
        joinRequests.classList.remove('hidden');
        
        // إضافة المستخدم الحالي كمشارك
        addParticipant(currentUser);
        showNotification('تم إنشاء الغرفة بنجاح', 'success');
    } catch (error) {
        showNotification('حدث خطأ أثناء إنشاء الغرفة: ' + error.message, 'error');
    }
}

// دالة الانضمام إلى غرفة
async function joinRoom() {
    const userName = userName2Input.value.trim();
    const code = roomCodeInput.value.trim();
    
    if (!userName) {
        showNotification('الرجاء إدخال اسمك أولاً', 'error');
        return;
    }
    
    if (code.length !== 6 || isNaN(code)) {
        showNotification('الرجاء إدخال رمز صحيح مكون من 6 أرقام', 'error');
        return;
    }

    try {
        currentUser = {
            id: generateUserId(),
            name: userName,
            isOwner: false
        };
        
        roomCode = code;
        await initializeMediaStream();
        
        // إرسال طلب انضمام
        sendJoinRequest(currentUser);
        showNotification('تم إرسال طلب الانضمام، في انتظار موافقة مدير الغرفة', 'warning');
    } catch (error) {
        showNotification('حدث خطأ أثناء الانضمام إلى الغرفة: ' + error.message, 'error');
    }
}

// دالة إرسال طلب انضمام
function sendJoinRequest(user) {
    // محاكاة إرسال الطلب (في التطبيق الحقيقي سيتم إرسال الطلب للخادم)
    if (isRoomOwner) {
        showJoinRequest(user);
    }
}

// دالة عرض طلب انضمام
function showJoinRequest(user) {
    const requestElement = document.createElement('div');
    requestElement.className = 'join-request';
    requestElement.innerHTML = `
        <div class="request-info">
            <p>طلب انضمام من: ${user.name}</p>
        </div>
        <div class="request-buttons">
            <button class="btn accept" onclick="acceptJoinRequest('${user.id}')">قبول</button>
            <button class="btn reject" onclick="rejectJoinRequest('${user.id}')">رفض</button>
        </div>
    `;
    requestsList.appendChild(requestElement);
}

// دالة قبول طلب الانضمام
function acceptJoinRequest(userId) {
    // محاكاة قبول الطلب
    const requestElement = document.querySelector(`[data-user-id="${userId}"]`);
    if (requestElement) {
        requestElement.remove();
    }
    
    // إضافة المستخدم كمشارك
    const user = {
        id: userId,
        name: `مستخدم ${participants.size + 1}`,
        isOwner: false
    };
    addParticipant(user);
    showNotification(`تم قبول طلب انضمام ${user.name}`, 'success');
}

// دالة رفض طلب الانضمام
function rejectJoinRequest(userId) {
    const requestElement = document.querySelector(`[data-user-id="${userId}"]`);
    if (requestElement) {
        requestElement.remove();
    }
    showNotification('تم رفض طلب الانضمام', 'warning');
}

// دالة إضافة مشارك جديد
function addParticipant(user) {
    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant';
    participantDiv.dataset.userId = user.id;
    participantDiv.innerHTML = `
        <div class="participant-name">${user.name} ${user.isOwner ? '(المدير)' : ''}</div>
        <div class="audio-indicator ${isMuted ? 'muted' : ''}">🎤</div>
    `;
    participantsContainer.appendChild(participantDiv);
    participants.set(user.id, user);
}

// دالة عرض الإشعارات
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notifications.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// دالة توليد معرف فريد للمستخدم
function generateUserId() {
    return Math.random().toString(36).substr(2, 9);
}

// دالة تهيئة الوسائط
async function initializeMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
    } catch (error) {
        throw new Error('لم نتمكن من الوصول إلى الميكروفون');
    }
}

// دالة كتم/تشغيل الصوت
function toggleMute() {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteBtn.textContent = isMuted ? 'تشغيل الصوت' : 'كتم الصوت';
        
        // تحديث مؤشر الصوت للمستخدم الحالي
        const audioIndicator = document.querySelector(`[data-user-id="${currentUser.id}"] .audio-indicator`);
        if (audioIndicator) {
            audioIndicator.classList.toggle('muted', isMuted);
        }
    }
}

// دالة مغادرة الغرفة
function leaveRoom() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // إغلاق جميع اتصالات النظراء
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    
    roomCode = null;
    currentUser = null;
    isRoomOwner = false;
    participants.clear();
    participantsContainer.innerHTML = '';
    activeRoom.classList.add('hidden');
    roomCodeDisplay.classList.add('hidden');
    joinRequests.classList.add('hidden');
    document.querySelector('.room-section').classList.remove('hidden');
    
    showNotification('تم مغادرة الغرفة', 'info');
}

// دالة عرض رمز الغرفة
function displayRoomCode(code) {
    roomCodeDisplay.classList.remove('hidden');
    displayedRoomCode.textContent = code;
}

// دالة نسخ رمز الغرفة
async function copyRoomCode() {
    try {
        await navigator.clipboard.writeText(roomCode);
        copyMessage.classList.add('show');
        setTimeout(() => {
            copyMessage.classList.remove('show');
        }, 2000);
        showNotification('تم نسخ رمز الغرفة', 'success');
    } catch (error) {
        showNotification('حدث خطأ أثناء نسخ الرمز', 'error');
    }
}

// دالة إظهار الغرفة النشطة
function showActiveRoom() {
    document.querySelector('.room-section').classList.add('hidden');
    activeRoom.classList.remove('hidden');
}

// دالة تهيئة مسح رمز QR
function initQRScanner() {
    // هنا يمكن إضافة مكتبة لمسح رموز QR
    alert('سيتم إضافة ميزة مسح رمز QR قريباً');
}

// التحقق من دعم المتصفح للوظائف المطلوبة
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showNotification('متصفحك لا يدعم المكالمات الصوتية. الرجاء استخدام متصفح حديث.', 'error');
} 