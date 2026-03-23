const io = require('socket.io')(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

// Mapping: email -> { deviceId: socketId }
const users = {}; 

io.on('connection', (socket) => {
    const { email, deviceId, deviceName } = socket.handshake.query;

    if (!email || !deviceId) {
        return socket.disconnect();
    }

    // Register User & Device
    if (!users[email]) users[email] = {};
    users[email][deviceId] = {
        socketId: socket.id,
        deviceName: deviceName || "Unknown Device"
    };

    console.log(`✅ Registered: ${deviceName} under ${email}`);

    // Broadcast update to all other devices on the same email
    socket.broadcast.emit('user-update', users[email]);

    // --- SIGNALING HANDLERS ---

    socket.on('offer', (data) => {
        if (!data.target || !data.sdp) return;
        const targetSocket = users[email][data.target]?.socketId;
        if (targetSocket) {
            io.to(targetSocket).emit('offer', {
                sdp: data.sdp,
                senderId: deviceId,
                senderName: deviceName
            });
        }
    });

    socket.on('answer', (data) => {
        if (!data.target || !data.sdp) return;
        const targetSocket = users[email][data.target]?.socketId;
        if (targetSocket) {
            io.to(targetSocket).emit('answer', { sdp: data.sdp });
        }
    });

    socket.on('ice-candidate', (data) => {
        if (!data.target || !data.candidate) return;
        const targetSocket = users[email][data.target]?.socketId;
        if (targetSocket) {
            io.to(targetSocket).emit('ice-candidate', data.candidate);
        }
    });

    // --- DISCONNECT CLEANUP ---
    socket.on('disconnect', () => {
        if (users[email] && users[email][deviceId]) {
            delete users[email][deviceId];
            if (Object.keys(users[email]).length === 0) delete users[email];
            console.log(`❌ Disconnected: ${deviceName}`);
        }
    });
});
