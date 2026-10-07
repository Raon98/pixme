import type { Message } from '@/api';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger';

const log = logger('ws');

/* ------------------------------------------------------------- protocol */

/**
 * Wire protocol for the chat socket (Spring `WebSocketHandler`, JSON frames).
 *
 * Plain JSON rather than STOMP: PIXME's realtime surface is one feature with
 * four frame types, so a broker protocol would add a dependency and a
 * handshake for no benefit. REST remains the source of truth — the socket is
 * a latency optimisation, and every send is also idempotent over REST.
 */
export type ServerFrame =
  | { type: 'MESSAGE'; payload: Message }
  | {
      type: 'READ';
      payload: { conversationId: string; lastMessageId: string; readAt: string };
    }
  | {
      type: 'CONVERSATION_UPDATED';
      payload: { conversationId: string; inactive: boolean };
    }
  | { type: 'ACK'; payload: { clientMessageId: string; message: Message } }
  | { type: 'ERROR'; payload: { code: string; message: string } }
  | { type: 'PONG' };

export type ClientFrame =
  | {
      type: 'SEND';
      payload: {
        conversationId: string;
        clientMessageId: string;
        content: string;
      };
    }
  | {
      type: 'READ';
      payload: { conversationId: string; lastMessageId: string };
    }
  | { type: 'SUBSCRIBE'; payload: { conversationId: string } }
  | { type: 'PING' };

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed';

/* ------------------------------------------------------------- client */

type Listener = (frame: ServerFrame) => void;
type StatusListener = (status: SocketStatus) => void;

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * A single shared socket for the whole app.
 *
 * It is a module singleton rather than per-screen state because messages must
 * keep arriving (and driving the tab badge) while the user is in the feed or
 * the square, not only while a chat screen is mounted.
 */
class ChatSocket {
  private socket: WebSocket | null = null;
  private status: SocketStatus = 'idle';
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private token: string | null = null;
  private intentionallyClosed = false;
  /** Frames queued while the socket was down. */
  private outbox: ClientFrame[] = [];

  connect(token: string) {
    if (this.token === token && (this.status === 'open' || this.status === 'connecting')) {
      return;
    }
    this.token = token;
    this.intentionallyClosed = false;
    this.open();
  }

  private open() {
    if (!this.token) return;
    this.clearReconnect();
    this.setStatus('connecting');

    try {
      // The token travels as a query param because React Native's WebSocket
      // cannot set an Authorization header. The server treats it as a
      // short-lived access token and never logs the URL.
      const socket = new WebSocket(
        `${config.wsBaseUrl}/chat?token=${encodeURIComponent(this.token)}`,
      );
      this.socket = socket;

      socket.onopen = () => {
        this.attempt = 0;
        this.setStatus('open');
        this.startHeartbeat();
        this.flushOutbox();
      };

      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(String(event.data)) as ServerFrame;
          if (frame.type === 'PONG') return;
          this.listeners.forEach((listener) => listener(frame));
        } catch (error) {
          log.warn('unparseable frame', error);
        }
      };

      socket.onerror = () => {
        // `onclose` always follows; reconnection is handled there.
        log.debug('socket error');
      };

      socket.onclose = () => {
        this.stopHeartbeat();
        this.socket = null;
        this.setStatus('closed');
        if (!this.intentionallyClosed) this.scheduleReconnect();
      };
    } catch (error) {
      log.warn('socket open failed', error);
      this.setStatus('closed');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.attempt += 1;
    const delay = Math.min(
      MAX_BACKOFF_MS,
      1000 * 2 ** (this.attempt - 1) + Math.random() * 500,
    );
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.send({ type: 'PING' }), HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private flushOutbox() {
    const pending = this.outbox;
    this.outbox = [];
    pending.forEach((frame) => this.send(frame));
  }

  /** Returns false when the frame was queued instead of sent. */
  send(frame: ClientFrame): boolean {
    if (this.socket && this.status === 'open') {
      this.socket.send(JSON.stringify(frame));
      return true;
    }
    // Never queue heartbeats — a stale PING is useless.
    if (frame.type !== 'PING') this.outbox.push(frame);
    return false;
  }

  disconnect() {
    this.intentionallyClosed = true;
    this.clearReconnect();
    this.stopHeartbeat();
    this.outbox = [];
    this.token = null;
    this.socket?.close();
    this.socket = null;
    this.setStatus('idle');
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: SocketStatus) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  getStatus() {
    return this.status;
  }
}

export const chatSocket = new ChatSocket();
