import { create, type StoreApi, type UseBoundStore } from "zustand"
import { ConnectionState, type SocketConfig, type PendingRequest, type WebSocketActions, type WebSocketStore } from "./types"

interface InternalStore extends WebSocketStore {
    pendingRequests: Record<string, PendingRequest>
    addPendingRequest: (id: string, resolve: PendingRequest['resolve'], reject: PendingRequest['reject']) => void
    resolvePendingRequest: (id: string, payload: unknown) => void
    rejectPendingRequest: (id: string, error: Error) => void
    rejectAllPendingRequests: (message: string) => void
}

export let _store: UseBoundStore<StoreApi<InternalStore>> | null = null


export const createSocket = ({ url, getAuthToken, onMessage, onReconnect, onDisconnect, onError, options }: SocketConfig) => {

    let socket: WebSocket | null = null
    let intentionalDisconnect = false
    let reconnectAttempts = 0
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
    let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null

    const maxAttempts = options?.maxReconnectAttempts ?? 5 // Default max reconnect attempts
    const timeout = options?.timeout ?? 30000 // default timeout of 30 secs for requests (async/await pattern)
    const heartbeatInterval = options?.heartbeatInterval ?? 300000 // default 5 mins

    _store = create<InternalStore>((set, get) => ({
        // state
        connectionState: ConnectionState.DISCONNECTED,
        pendingRequests: {} as Record<string, PendingRequest>,
        error: null,

        // connection
        connect: async () => {
            
            if (get().connectionState !== ConnectionState.DISCONNECTED) {
                return // Early return if already connected or connecting
            }

            set({ connectionState: ConnectionState.CONNECTING, error: null })
            intentionalDisconnect = false

            const token = (await getAuthToken?.()) || null // fresh token every connect
            intentionalDisconnect = false  // reset here, after await

            const connectionUrl = token ? `${url}?Authorization=${token}` : url
            socket = new WebSocket(connectionUrl)

            socket.onopen = () => {
                if (reconnectTimeoutId) {
                    clearTimeout(reconnectTimeoutId)
                    reconnectTimeoutId = null
                }
                set({ connectionState: ConnectionState.CONNECTED, error: null })
                if (reconnectAttempts > 0) {
                    onReconnect?.()
                }
                reconnectAttempts = 0

                // start heartbeat
                heartbeatIntervalId = setInterval(() => {
                    get().send('ping', {})
                }, heartbeatInterval)
            }

            socket.onclose = (event: CloseEvent) => {
                if (heartbeatIntervalId) {
                    clearInterval(heartbeatIntervalId)
                    heartbeatIntervalId = null
                }
                get().rejectAllPendingRequests('Connection closed') // Reject all pending requests when connection closes

                if (intentionalDisconnect) {
                    set({ connectionState: ConnectionState.DISCONNECTED, error: null })
                    onDisconnect?.()
                } else {
                    const error = event.wasClean
                        ? null
                        : new Error(`Connection failed (code: ${event.code}${event.reason ? `, reason: ${event.reason}` : ''})`)
                    set({ connectionState: ConnectionState.DISCONNECTED, error })
                    if (error) onError?.(error)
                    scheduleReconnect()
                }
            }

            socket.onerror = (error) => {
                console.error('⚠️ WebSocket error:', error);
            }

            socket.onmessage = (event: MessageEvent<string>) => {
                let data: any
                try {
                    data = JSON.parse(event.data)
                } catch {
                    return
                }

                if (data?.requestId) {
                    // async/await path (for request)
                    const isError = data.error ||
                        data.statusCode >= 400 ||
                        (typeof data.message === 'string' && data.message.toLowerCase().includes('error')) ||
                        data.success === false

                    if (isError) {
                        get().rejectPendingRequest(
                            data.requestId,
                            new Error(data.error || data.message || `Server error (${data.statusCode || 'unknown'})`)
                        )
                    } else {
                        get().resolvePendingRequest(data.requestId, data)
                    }
                } else {
                    // broadcast path (for send)
                    onMessage?.(data)
                }
            }
        },

        disconnect: () => {
            if (get().connectionState === ConnectionState.DISCONNECTED) return
            intentionalDisconnect = true
            socket?.close()
            if (reconnectTimeoutId) { clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null } // Clear any pending reconnect attempts
        },

        // fire and forget
        send: (...[action, payload]: Parameters<WebSocketActions['send']>) => {
            if (!socket || get().connectionState !== ConnectionState.CONNECTED) return false
            try {
                socket.send(JSON.stringify({ action, ...(payload ?? {}) }))
                return true
            } catch {
                return false
            }
        },

        // async/await
        request: (...[action, payload]: Parameters<WebSocketActions['request']>) => {
            return new Promise((resolve, reject) => {
                if (get().connectionState !== ConnectionState.CONNECTED) {
                    reject(new Error('WebSocket not connected'))
                    return
                }

                const requestId = `${Date.now()}-${Math.random()}`
                get().addPendingRequest(requestId, resolve, reject)
                const sent = get().send(action, { ...(payload ?? {}), requestId })
                if (!sent) {
                    get().rejectPendingRequest(requestId, new Error('Failed to send'))
                }
            })
        },

        addPendingRequest: (id: string, resolve: unknown, reject: unknown) => {
            const timeoutId = setTimeout(() => {
                get().rejectPendingRequest(id, new Error('Request timeout'))
            }, timeout)
            set((state: any) => {
                return { pendingRequests: { ...state.pendingRequests, [id]: { resolve, reject, timeoutId } } }
            })
        },

        resolvePendingRequest: (id: string, payload: unknown) => {
            const req = get().pendingRequests[id]
            if (req) {
                clearTimeout(req.timeoutId)
                req.resolve(payload)
                // delete get().pendingRequests[id]
                set((state: any) => {
                    const { [id]: _, ...rest } = state.pendingRequests
                    return { pendingRequests: rest }
                })

            }
        },

        rejectPendingRequest: (id: string, error: Error) => {
            const req = get().pendingRequests[id]
            if (req) {
                clearTimeout(req.timeoutId)
                req.reject(error)
                set((state: any) => {
                    const { [id]: _, ...rest } = state.pendingRequests
                    return { pendingRequests: rest }
                })
            }
        },

        rejectAllPendingRequests: (message: string) => {
            Object.keys(get().pendingRequests).forEach(id => {
                get().rejectPendingRequest(id, new Error(message))
            })
        },
    }))



    function scheduleReconnect() {
        if (reconnectAttempts >= maxAttempts) {
            console.warn(`Max reconnect attempts reached (${maxAttempts}). No further attempts will be made.`);
             onError?.(new Error(`Failed to reconnect after ${maxAttempts} attempts`))
             onDisconnect?.()
            return
        }

        // exponential backoff + jitter
        const base = Math.min(30000, Math.pow(2, reconnectAttempts) * 1000)
        const delay = base + Math.random() * 1000

        reconnectAttempts++

        reconnectTimeoutId = setTimeout(() => {
            _store?.getState().connect()
        }, delay)
    }

    // public API — user only sees these
    return {
        connect: () => _store?.getState().connect(),
        disconnect: () => _store?.getState().disconnect(),
        send: (...[action, payload]: Parameters<WebSocketActions['send']>) =>
            _store?.getState().send(action, payload),
        request: (...[action, payload]: Parameters<WebSocketActions['request']>) =>
            _store?.getState().request(action, payload),
    }
}