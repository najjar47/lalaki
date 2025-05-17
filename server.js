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

// معالجة إنشاء غرفة جديدة
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

// معالجة طلب الانضمام
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
        
        console.log(`طلب انضمام جديد للغرفة ${roomCode} من ${userName}`);
    }
}

// معالجة قبول طلب الانضمام
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
            
            // إعلام جميع المشاركين بالعضو الجديد
            broadcastToRoom(room, {
                type: 'PARTICIPANT_JOINED',
                userName
            }, [requesterSocket]);
            
            console.log(`تم قبول ${userName} في الغرفة ${roomCode}`);
        }
    }
}

// معالجة رفض طلب الانضمام
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
            
            console.log(`تم رفض ${userName} من الغرفة ${roomCode}`);
        }
    }
}

// معالجة مغادرة الغرفة
function handleLeaveRoom(socket, data) {
    const { roomCode } = data;
    const room = rooms.get(roomCode);
    
    if (room) {
        if (socket === room.owner) {
            // إذا كان المغادر هو المالك، قم بإغلاق الغرفة
            closeRoom(roomCode);
        } else {
            // إزالة المشارك من الغرفة
            const userName = room.participants.get(socket);
            room.participants.delete(socket);
            
            broadcastToRoom(room, {
                type: 'PARTICIPANT_LEFT',
                userName
            });
            
            console.log(`غادر ${userName} الغرفة ${roomCode}`);
        }
    }
}

// معالجة قطع الاتصال
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

// إغلاق غرفة
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

// البحث عن مستخدم باسمه
function findSocketByUserName(map, userName) {
    for (const [socket, name] of map.entries()) {
        if (name === userName) {
            return socket;
        }
    }
    return null;
}

// إرسال رسالة لجميع المشاركين في الغرفة
function broadcastToRoom(room, message, excludeSockets = []) {
    const messageStr = JSON.stringify(message);
    
    for (const socket of room.participants.keys()) {
        if (!excludeSockets.includes(socket)) {
            socket.send(messageStr);
        }
    }
}
