export class Network {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.connected = false;
    this.playerId = null;
    this.roomId = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(protocol + '//' + location.host);

      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
      };
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.emit(msg.type, msg);
        } catch (e) { /* ignore bad messages */ }
      };
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  emit(event, data) {
    if (this.handlers[event]) {
      for (const h of this.handlers[event]) h(data);
    }
  }

  createRoom(name) { this.send({ type: 'create_room', name }); }
  joinRoom(roomId, name) { this.send({ type: 'join_room', roomId: roomId.toUpperCase(), name }); }
  startGame() { this.send({ type: 'start_game' }); }
  sendInput(keys) { this.send({ type: 'input', keys }); }
  sendChat(message) { this.send({ type: 'chat', message }); }
}
