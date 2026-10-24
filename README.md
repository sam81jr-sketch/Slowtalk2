# SlowTalk 2 — Private conversations (HTTP-only)

A responsive two-person chat app with private rooms, text chat, and audio/video call screens.

## Run in Termux or on a computer

```bash
cd slowtalk2
npm install
npm start
```

Open `http://127.0.0.1:3000` on the same device. For layout and text testing on another device on the same Wi-Fi, open `http://YOUR-LAN-IP:3000`.

## Important limitation

This version has HTTPS certificate support and certificate files removed, and runs over plain HTTP only. Browsers generally allow camera/microphone access on `localhost`, but block it on ordinary HTTP LAN addresses and public websites. Audio/video calls may therefore not work on other devices unless the app is served through HTTPS. Text chat can still work over HTTP.

## Features and limitations

- Private rooms allow a maximum of two participants.
- Create a room and copy its invitation URL; the other person pastes the link or room code.
- Text messages, audio/video call controls, mute, camera toggle, and local video preview.
- Room state and messages are in memory; restarting the server clears rooms and messages.
- The invitation URL is a bearer link: anyone who has it can attempt to join until the room closes.
- WebRTC uses a public STUN server only. Some mobile networks/NATs require a TURN server for calls to connect reliably.
