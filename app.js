// ==========================================
// المتغيرات العامة
// ==========================================
let localStream = null;
let peerConnection = null;
let roomCode = null;
let isMuted = false;
let userName = '';
let socket = null;
let isRoomOwner = false;

// ==========================================
// عناصر واجهة المستخدم
// ==========================================
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

// ==========================================
// مستمعي الأحداث
// ==========================================
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
muteBtn.addEventListener('click', toggleMute);
leaveBtn.addEventListener('click', leaveRoom);
closeTutorial.addEventListener('click', () => tutorial.classList.add('hidden'));
copyCodeBtn.addEventListener('click', copyRoomCode);

// ==========================================
// وظائف إدارة الإشعارات
// ==========================================

// دالة عرض الإشعارات
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="close-notification" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    notifications.appendChild(notification);
    
    // إزالة الإشعار تلقائياً بعد 5 ثواني
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ==========================================
// وظائف إدارة الاتصال
// ==========================================

// دالة إنشاء اتصال WebSocket
function initializeWebSocket() {
    return new Promise((resolve, reject) => {
        try {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close();
            }

            socket = new WebSocket('ws://localhost:3000');
            console.log('جاري الاتصال بالخادم...');

            // تعيين timeout للاتصال
            const connectionTimeout = setTimeout(() => {
                if (socket.readyState !== WebSocket.OPEN) {
                    socket.close();
                    reject(new Error('انتهت مهلة الاتصال بالخادم. تأكد من تشغيل الخادم على المنفذ 3000'));
                }
            }, 5000);

            socket.onopen = () => {
                clearTimeout(connectionTimeout);
                updateConnectionStatus(true);
                console.log('تم فتح اتصال WebSocket بنجاح');
                resolve();
            };

            socket.onerror = (error) => {
                clearTimeout(connectionTimeout);
                updateConnectionStatus(false);
                console.error('خطأ في اتصال WebSocket:', error);
                reject(new Error('فشل الاتصال بالخادم. تأكد من تشغيل الخادم وأنه متاح.'));
            };

            socket.onclose = () => {
                clearTimeout(connectionTimeout);
                updateConnectionStatus(false);
                console.log('تم إغلاق اتصال WebSocket');
                showNotification('تم قطع الاتصال بالخادم', 'error');
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('رسالة واردة:', data);
                    handleWebSocketMessage(data);
                } catch (error) {
                    console.error('خطأ في معالجة الرسالة:', error);
                    showNotification('خطأ في معالجة الرسالة من الخادم', 'error');
                }
            };
        } catch (error) {
            console.error('خطأ في إنشاء WebSocket:', error);
            reject(new Error('فشل في إنشاء اتصال WebSocket. حاول مرة أخرى.'));
        }
    });
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
        case 'PARTICIPANT_JOINED':
            addParticipant(data.userName);
            showNotification(`انضم ${data.userName} إلى الغرفة`, 'info');
            break;
    }
}

// ==========================================
// وظائف إدارة الغرف
// ==========================================

// دالة إنشاء غرفة جديدة
async function createRoom() {
    const name = userNameInput.value.trim();
    if (!name) {
        showNotification('الرجاء إدخال اسمك أولاً', 'error');
        return;
    }

    try {
        // تنظيف الحالة السابقة
        await leaveRoom();
        
        // تعيين المتغيرات
        userName = name;
        isRoomOwner = true;
        roomCode = Math.floor(100000 + Math.random() * 900000).toString();

        console.log('بدء إنشاء الغرفة:', { userName, roomCode });
        
        // تهيئة الوسائط أولاً
        try {
            await initializeMediaStream();
            console.log('تم تهيئة الوسائط بنجاح');
        } catch (mediaError) {
            console.error('خطأ في تهيئة الوسائط:', mediaError);
            throw new Error('فشل في الوصول إلى الميكروفون. الرجاء التأكد من السماح بالوصول إلى الميكروفون وأنه متصل بشكل صحيح.');
        }
        
        // إنشاء اتصال WebSocket جديد
        try {
            await initializeWebSocket();
            console.log('تم إنشاء اتصال WebSocket بنجاح');
        } catch (wsError) {
            console.error('خطأ في اتصال WebSocket:', wsError);
            throw new Error('فشل الاتصال بالخادم. الرجاء التأكد من تشغيل الخادم على المنفذ 3000.');
        }
        
        // انتظار لحظة للتأكد من استقرار الاتصال
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            throw new Error('فشل الاتصال بالخادم. حاول مرة أخرى.');
        }

        // إرسال طلب إنشاء الغرفة
        const createRoomMessage = {
            type: 'CREATE_ROOM',
            roomCode,
            userName
        };
        
        console.log('إرسال طلب إنشاء الغرفة:', createRoomMessage);
        socket.send(JSON.stringify(createRoomMessage));
        
        // تحديث واجهة المستخدم
        showActiveRoom();
        displayRoomCode(roomCode);
        roomNumber.textContent = roomCode;
        joinRequests.classList.remove('hidden');
        addParticipant(userName); // إضافة المالك كمشارك
        
        // إظهار رسالة نجاح
        showNotification('تم إنشاء الغرفة بنجاح', 'success');
        console.log('تم إنشاء الغرفة بنجاح:', { roomCode });
    } catch (error) {
        console.error('خطأ في إنشاء الغرفة:', error);
        showNotification('حدث خطأ أثناء إنشاء الغرفة: ' + error.message, 'error');
        await leaveRoom();
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
        // تنظيف الحالة السابقة
        await leaveRoom();
        
        userName = name;
        roomCode = code;
        
        // تهيئة الوسائط أولاً
        await initializeMediaStream();
        
        // إنشاء اتصال WebSocket جديد
        await initializeWebSocket();
        
        // انتظار لحظة للتأكد من استقرار الاتصال
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            throw new Error('لم يتم إنشاء اتصال مع الخادم');
        }

        socket.send(JSON.stringify({
            type: 'JOIN_REQUEST',
            roomCode,
            userName
        }));
        
        showNotification('تم إرسال طلب الانضمام، في انتظار موافقة مدير الغرفة', 'info');
    } catch (error) {
        console.error('خطأ في الانضمام:', error);
        showNotification('حدث خطأ أثناء الانضمام إلى الغرفة: ' + error.message, 'error');
        await leaveRoom();
    }
}

// دالة تنظيف الموارد
async function leaveRoom() {
    try {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'LEAVE_ROOM',
                roomCode,
                userName
            }));
            socket.close();
        }
        
        localStream = null;
        peerConnection = null;
        roomCode = null;
        isMuted = false;
        userName = '';
        socket = null;
        isRoomOwner = false;
        
        hideActiveRoom();
        joinRequests.classList.add('hidden');
        participants.innerHTML = '';
        requestsList.innerHTML = '';
        
        userNameInput.value = '';
        userName2Input.value = '';
        roomCodeInput.value = '';
        
        updateMuteButton();
    } catch (error) {
        console.error('خطأ في مغادرة الغرفة:', error);
    }
}

// ==========================================
// وظائف إدارة المشاركين
// ==========================================

// دالة عرض طلب انضمام
function showJoinRequest(requesterName) {
    const requestDiv = document.createElement('div');
    requestDiv.className = 'join-request';
    requestDiv.setAttribute('data-name', requesterName);
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
    showNotification(`طلب انضمام جديد من ${requesterName}`, 'info');
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
    showNotification(`تم قبول ${requesterName} في الغرفة`, 'success');
}

// دالة رفض طلب الانضمام
function rejectJoinRequest(requesterName) {
    socket.send(JSON.stringify({
        type: 'JOIN_REJECTED',
        roomCode,
        userName: requesterName
    }));
    removeJoinRequest(requesterName);
    showNotification(`تم رفض ${requesterName} من الغرفة`, 'info');
}

// دالة إزالة طلب الانضمام
function removeJoinRequest(requesterName) {
    const request = requestsList.querySelector(`[data-name="${requesterName}"]`);
    if (request) {
        request.remove();
    }
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
        showNotification(`غادر ${name} الغرفة`, 'info');
    }
}

// ==========================================
// وظائف إدارة الوسائط
// ==========================================

// دالة تهيئة الوسائط
async function initializeMediaStream() {
    try {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        updateMuteButton();
        return localStream;
    } catch (error) {
        console.error('خطأ في الوصول إلى الميكروفون:', error);
        throw new Error('فشل في الوصول إلى الميكروفون. الرجاء التأكد من السماح بالوصول إلى الميكروفون.');
    }
}

// دالة التحكم في كتم الصوت
function toggleMute() {
    if (!localStream) {
        showNotification('لا يوجد اتصال صوتي نشط', 'error');
        return;
    }

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isMuted = !isMuted;
        updateMuteButton();
        showNotification(`تم ${isMuted ? 'كتم' : 'تشغيل'} الميكروفون`, 'info');
    }
}

// دالة تحديث حالة زر كتم الصوت
function updateMuteButton() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            muteBtn.innerHTML = `<i class="fas fa-${isMuted ? 'microphone-slash' : 'microphone'}"></i>`;
            audioTrack.enabled = !isMuted;
        }
    }
}

// ==========================================
// وظائف واجهة المستخدم
// ==========================================

// دالة عرض الغرفة
function showActiveRoom() {
    activeRoom.classList.remove('hidden');
}

// دالة إخفاء الغرفة
function hideActiveRoom() {
    activeRoom.classList.add('hidden');
}

// دالة عرض رمز الغرفة
function displayRoomCode(code) {
    roomCodeDisplay.textContent = code;
    displayedRoomCode.textContent = code;
}

// دالة نسخ رمز الغرفة
function copyRoomCode() {
    const code = displayedRoomCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
        copyMessage.textContent = 'تم النسخ!';
        copyMessage.classList.add('show');
        setTimeout(() => {
            copyMessage.classList.remove('show');
        }, 2000);
    }).catch(() => {
        showNotification('فشل نسخ الرمز', 'error');
    });
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

// دالة معالجة إغلاق الغرفة
function handleRoomClosed() {
    leaveRoom();
    showNotification('تم إغلاق الغرفة من قبل المدير', 'error');
}
