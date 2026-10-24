const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);
app.get('/style.css', (_req, res) =>
  res.sendFile(path.join(__dirname, 'style.css'))
);
app.get('/app.js', (_req, res) =>
  res.sendFile(path.join(__dirname, 'app.js'))
);
app.get('/health', (_req, res) => res.json({ ok: true, app: 'SlowTalk' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const rooms = new Map(); // roomId -> Map(socketId, {name})
const MAX_PEOPLE = 2;

function safeName(value) {
  const name = String(value || '').trim().replace(/[<>]/g, '').slice(0, 24);
  return name || 'Guest';
}
function roomInfo(roomId) {
  const room = rooms.get(roomId);
  return { roomId, count: room ? room.size : 0, max: MAX_PEOPLE,
    participants: room ? [...room.entries()].map(([id, p]) => ({ id, name: p.name })) : [] };
}
function validRoom(id) { return typeof id === 'string' && /^[a-f0-9]{8,32}$/.test(id); }

io.on('connection', socket => {
  socket.on('create-room', ({ name } = {}, reply = () => {}) => {
    const roomId = crypto.randomBytes(6).toString('hex');
    rooms.set(roomId, new Map());
    joinRoom(roomId, name, reply);
  });

  socket.on('join-room', ({ roomId, name } = {}, reply = () => {}) => {
    if (!validRoom(roomId) || !rooms.has(roomId)) return reply({ ok: false, error: 'This invitation is invalid or the room has expired.' });
    joinRoom(roomId, name, reply);
  });

  function joinRoom(roomId, name, reply) {
    const room = rooms.get(roomId);
    if (!room) return reply({ ok: false, error: 'Room not found. Create a new private room.' });
    if (room.size >= MAX_PEOPLE && !room.has(socket.id)) return reply({ ok: false, error: 'This private room is full (2/2 people).' });
    const alreadyIn = [...socket.rooms].find(r => r !== socket.id && rooms.has(r));
    if (alreadyIn && alreadyIn !== roomId) leaveCurrent();
    room.set(socket.id, { name: safeName(name) });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = safeName(name);
    reply({ ok: true, ...roomInfo(roomId), secure: false });
    io.to(roomId).emit('room-update', roomInfo(roomId));
    socket.to(roomId).emit('system-message', { text: `${safeName(name)} joined the room.` });
  }

  socket.on('chat-message', ({ text } = {}) => {
    const roomId = socket.data.roomId;
    const message = String(text || '').trim().slice(0, 2000);
    if (!roomId || !message || !rooms.has(roomId)) return;
    io.to(roomId).emit('chat-message', { id: crypto.randomUUID(), senderId: socket.id, name: socket.data.name || 'Guest', text: message, time: new Date().toISOString() });
  });

  // WebRTC signaling is only relayed to the other participant in the current private room.
  for (const event of ['rtc-offer', 'rtc-answer', 'rtc-ice', 'call-mode', 'call-ended']) {
    socket.on(event, payload => {
      const roomId = socket.data.roomId;
      if (roomId && rooms.has(roomId)) socket.to(roomId).emit(event, payload);
    });
  }

  socket.on('leave-room', () => leaveCurrent());
  socket.on('disconnect', () => leaveCurrent());

  function leaveCurrent() {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    socket.leave(roomId);
    if (room) {
      room.delete(socket.id);
      socket.to(roomId).emit('system-message', { text: `${socket.data.name || 'A participant'} left the room.` });
      if (room.size === 0) rooms.delete(roomId);
      else io.to(roomId).emit('room-update', roomInfo(roomId));
    }
    delete socket.data.roomId;
  }
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SlowTalk listening on http://0.0.0.0:${PORT}`);
});
