/*
 * Abu Hamza47 - تطبيق دردشة صوتية
 * ================================
 * تجميع لجميع ملفات JavaScript في المشروع
 */

// ==========================================
// 1. إعدادات الخادم (server.js)
// ==========================================

const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const app = express();

// إعداد خادم Express لخدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// إنشاء خادم HTTP
const server = app.listen(3000, () => {
    console.log('خادم HTTP يعمل على المنفذ 3000');
});

// إنشاء خادم WebSocket
const wss = new WebSocket.Server({ server });

// تخزين الغرف والمستخدمين
const rooms = new Map();

// معالجة اتصالات WebSocket
wss.on('connection', (socket) => {
    console.log('مستخدم جديد متصل');

    socket.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'CREATE_ROOM':
                handleCreateRoom(socket, data);
                break;
            case 'JOIN_REQUEST':
                handleJoinRequest(socket, data);
                break;
            case 'JOIN_ACCEPTED':
                handleJoinAccepted(socket, data);
                break;
            case 'JOIN_REJECTED':
                handleJoinRejected(socket, data);
                break;
            case 'LEAVE_ROOM':
                handleLeaveRoom(socket, data);
                break;
        }
    });

    socket.on('close', () => {
        handleDisconnect(socket);
    });
});

// دوال معالجة الغرف
function handleCreateRoom(socket, data) {
    const { roomCode, userName } = data;
    
    if (!rooms.has(roomCode)) {
        rooms.set(roomCode, {
            owner: socket,
            ownerName: userName,
            participants: new Map([[socket, userName]]),
            joinRequests: new Map()
        });
        
        socket.roomCode = roomCode;
        socket.userName = userName;
        console.log(`تم إنشاء غرفة جديدة: ${roomCode} بواسطة ${userName}`);
    }
}

function handleJoinRequest(socket, data) {
    const { roomCode, userName } = data;
    const room = rooms.get(roomCode);
    
    if (room) {
        room.joinRequests.set(socket, userName);
        socket.roomCode = roomCode;
        socket.userName = userName;
        
        room.owner.send(JSON.stringify({
            type: 'JOIN_REQUEST',
            userName: userName
        }));
    }
}

function handleJoinAccepted(socket, data) {
    const { roomCode, userName } = data;
    const room = rooms.get(roomCode);
    
    if (room) {
        const requesterSocket = findSocketByUserName(room.joinRequests, userName);
        if (requesterSocket) {
            room.participants.set(requesterSocket, userName);
            room.joinRequests.delete(requesterSocket);
            
            requesterSocket.send(JSON.stringify({
                type: 'JOIN_ACCEPTED',
                roomCode
            }));
            
            broadcastToRoom(room, {
                type: 'PARTICIPANT_JOINED',
                userName
            }, [requesterSocket]);
        }
    }
}

function handleJoinRejected(socket, data) {
    const { roomCode, userName } = data;
    const room = rooms.get(roomCode);
    
    if (room) {
        const requesterSocket = findSocketByUserName(room.joinRequests, userName);
        if (requesterSocket) {
            room.joinRequests.delete(requesterSocket);
            
            requesterSocket.send(JSON.stringify({
                type: 'JOIN_REJECTED',
                roomCode
            }));
        }
    }
}

function handleLeaveRoom(socket, data) {
    const { roomCode } = data;
    const room = rooms.get(roomCode);
    
    if (room) {
        if (socket === room.owner) {
            closeRoom(roomCode);
        } else {
            const userName = room.participants.get(socket);
            room.participants.delete(socket);
            
            broadcastToRoom(room, {
                type: 'PARTICIPANT_LEFT',
                userName
            });
        }
    }
}

function handleDisconnect(socket) {
    const roomCode = socket.roomCode;
    if (roomCode) {
        const room = rooms.get(roomCode);
        if (room) {
            if (socket === room.owner) {
                closeRoom(roomCode);
            } else {
                const userName = room.participants.get(socket) || room.joinRequests.get(socket);
                room.participants.delete(socket);
                room.joinRequests.delete(socket);
                
                if (userName) {
                    broadcastToRoom(room, {
                        type: 'PARTICIPANT_LEFT',
                        userName
                    });
                }
            }
        }
    }
}

function closeRoom(roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
        broadcastToRoom(room, {
            type: 'ROOM_CLOSED'
        });
        
        rooms.delete(roomCode);
        console.log(`تم إغلاق الغرفة ${roomCode}`);
    }
}

function findSocketByUserName(map, userName) {
    for (const [socket, name] of map.entries()) {
        if (name === userName) {
            return socket;
        }
    }
    return null;
}

function broadcastToRoom(room, message, excludeSockets = []) {
    const messageStr = JSON.stringify(message);
    
    for (const socket of room.participants.keys()) {
        if (!excludeSockets.includes(socket)) {
            socket.send(messageStr);
        }
    }
}

// ==========================================
// 2. منطق التطبيق الرئيسي (app.js)
// ==========================================

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

// التحقق من دعم المتصفح
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showNotification('متصفحك لا يدعم المكالمات الصوتية. الرجاء استخدام متصفح حديث.', 'error');
}
