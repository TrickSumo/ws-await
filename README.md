# @tricksumo/ws-await

> async/await for AWS Lambda WebSockets

WebSocket messages to AWS Lambda are **fire-and-forget by default** (ie. you send a message and have no way to wait for the response).

This library fixes that. It lets you `await` a Lambda response like a regular API call.

```ts
// without this library — no way to get the response back
socket.send('ping', { messsage: 'Some message here' })

// with this library
const { signedUrl } = await socket.request('getSignedUrl', { fileName: 'photo.jpg' })
```

Built on [Zustand](https://github.com/pmndrs/zustand).

---

## How it works

Every `request()` call attaches a unique `requestId` to the outgoing message. When your Lambda responds, it echoes the same `requestId` back. The library matches them up and resolves the Promise.

```
Client                          AWS Lambda
  |                                 |
  |-- { action, requestId, ... } -->|
  |                                 | (processes request)
  |<-- { data, requestId } ---------|
  |
Promise resolves ✅
```

No polling. No global message listeners. Just async/await.

> **Lambda requirement:** Your Lambda **must** echo the `requestId` back in its response — otherwise `request()` will never resolve. See [Lambda setup](#lambda-setup) below.

---

## Install

```bash
npm install @tricksumo/ws-await zustand
```

---

## Quick start

There are two parts: your **Lambda** and your **client**. Both must be set up for `request()` to work.

### Step 1 - Update your Lambda to echo back `requestId`

This is the most important step. Without it, `request()` hangs until timeout.

```js
// lambda/signedURL.mjs
export const handler = async (event) => {
  const { requestId, fileName, fileType } = JSON.parse(event.body || '{}')
  //       ↑ extract requestId from the incoming message

  const signedUrl = await getPresignedUrl(fileName, fileType)

  return {
    statusCode: 200,
    body: JSON.stringify({
      signedUrl,
      requestId, // ← REQUIRED: echo it back or the Promise never resolves
    }),
  }
}
```

### Step 2 - Set up the client

```ts
import { useSocket, createSocket } from '@tricksumo/ws-await'
import { useEffect } from 'react'

const ws = createSocket({
  url: 'wss://id.execute-api.us-east-1.amazonaws.com/prod',
})

function App() {

  const { isConnected, isConnecting, isDisConnected, error } = useSocket()

  useEffect(() => {
    ws.connect()
    return () => {
      ws.disconnect()
    }
  }, [])

  const handleGetSignedURL = async () => {
  try {
    const response = await ws.request('getSignedURL', { fileType: 'image/png' })
    console.log('Signed URL:', response)
  } catch (err) {
    console.error('Request failed:', err)
  }
}
  return (
    <>
      <div>
        <button onClick={handleGetSignedURL}>
          Click to get signed URL
        </button>
      </div>

    </>
  )
}

export default App
```

---

## React - connection state in components

```tsx
import { useSocket } from '@tricksumo/ws-await'

function StatusBar() {
  const { isConnected, isConnecting, error } = useSocket()

  if (isConnecting) return <p>Connecting...</p>
  if (!isConnected)  return <p>Disconnected — {error?.message}</p>
  return <p>Connected</p>
}
```

---

## Lambda setup

### Returning a success response

Always include `requestId` in the response body:

```js
return {
  statusCode: 200,
  body: JSON.stringify({ yourData: '...', requestId }), // requestId required
}
```

### Returning an error response

Any of these will cause `request()` to reject on the client:

```js
{ requestId, error: 'something went wrong' }  // error field
{ requestId, statusCode: 400 }                // statusCode >= 400
{ requestId, success: false }                 // success flag
```

### Forgetting `requestId`?

If your Lambda response does not include `requestId`, the message is treated as a broadcast and passed to `onMessage`. The `request()` call will hang until the `timeout` (default 30s) and then reject.

---

## Config options

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | required | WebSocket endpoint |
| `getAuthToken` | `() => Promise<string \| null>` | — | Called on every connect. Token appended as `?Authorization=<token>` |
| `onMessage` | `(msg: unknown) => void` | — | Server-pushed broadcast messages (no `requestId`) |
| `onDisconnect` | `() => void` | — | Fires on clean disconnect or when reconnect gives up |
| `onReconnect` | `() => void` | — | Fires when connection recovers after a failure |
| `onError` | `(err: Error) => void` | — | Fires on unclean disconnect or when reconnect is exhausted |
| `options.timeout` | `number` | `30000` | ms before a `request()` rejects with timeout error |
| `options.heartbeatInterval` | `number` | `300000` | ms between pings — keeps AWS API Gateway alive (idle limit is 10 min) |
| `options.maxReconnectAttempts` | `number` | `5` | Reconnect attempts with exponential backoff before giving up |

---