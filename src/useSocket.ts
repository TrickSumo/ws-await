import { _store } from "./createSocket";
import { ConnectionState } from "./types";

export function useSocket() {
    // safe defaults if createSocket not called
    if (!_store) {
        return { isConnected: false, isConnecting: false, error: new Error("WS Connection Not Initialized!") }
    }

    const connectionState = _store((s) => s.connectionState)
    const error = _store((s) => s.error)



    return {
        isConnected: connectionState === ConnectionState.CONNECTED,
        isConnecting: connectionState === ConnectionState.CONNECTING,
        isDisConnected: connectionState === ConnectionState.DISCONNECTED,
        error: error
    }
}