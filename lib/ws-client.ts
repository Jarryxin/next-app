type Listener = (...args: unknown[]) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private url = "";
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private messageQueue: string[] = [];
  private listeners = new Map<string, Set<Listener>>();
  private intentionalClose = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private status: "idle" | "connecting" | "connected" | "reconnecting" = "idle";

  get connectionStatus() {
    return this.status;
  }

  connect(url: string) {
    this.url = url;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    this.status = "connecting";
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.status = "connected";
      this.emit("status", "connected");
      while (this.messageQueue.length > 0) {
        this.ws?.send(this.messageQueue.shift()!);
      }
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        this.emit("message", JSON.parse(event.data as string));
      } catch {
        /* skip unparseable */
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.status = this.intentionalClose ? "idle" : "reconnecting";
      this.emit("status", this.status);
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      /* onclose fires after error */
    };
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay);
    const jitter = Math.random() * 1000;
    this.reconnectAttempts++;
    setTimeout(() => this.doConnect(), delay + jitter);
  }

  send(data: object) {
    const msg = JSON.stringify(data);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.messageQueue.push(msg);
    }
  }

  disconnect() {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.status = "idle";
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  on(event: string, handler: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((h) => h(...args));
  }

  destroy() {
    this.disconnect();
    this.listeners.clear();
  }
}

export const wsClient = new WSClient();
