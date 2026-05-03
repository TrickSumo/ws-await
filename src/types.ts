export enum ConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED'
}

export interface SocketConfig {
    url: string;
    getAuthToken?: () => Promise<string | null>;
    onMessage?: (msg: any) => void
    onReconnect?: () => void
    onDisconnect?: () => void
    onError?: (err: Error) => void
    options?: {
        timeout?: number;
        heartbeatInterval?: number;
        maxReconnectAttempts?: number;
    }
}

export interface WebSocketState {
    connectionState: ConnectionState;
    error: Error | null;
}

export interface WebSocketActions {
    connect: () => void;
    disconnect: () => void;
    send: (action: string, payload?: object) => boolean;
    request: (action: string, payload?: object) => Promise<unknown>;
}

export type WebSocketStore = WebSocketState & WebSocketActions;

export interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeoutId: ReturnType<typeof setTimeout>;
}

