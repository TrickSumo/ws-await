import { useSocket, createSocket } from '@tricksumo/async-sockets'
import { useEffect } from 'react'
import './App.css'

const ws = createSocket({
  url: 'wss://id.execute-api.us-east-1.amazonaws.com/prod',
  // getAuthToken: async () => {
  //   const sessionStoragKeys = Object.keys(sessionStorage);
  //   const oidcKey = sessionStoragKeys.find(key => key.startsWith("oidc.user:https://cognito-idp."));
  //   const oidcContext = JSON.parse(sessionStorage.getItem(oidcKey!) || "{}");
  //   const accessToken = oidcContext?.access_token;
  //   return accessToken;
  // },
  onMessage: (msg) => {
    alert('Received message: ' + msg)
  },
  // options: {
  //   timeout: 30000,
  //   heartbeatInterval: 60000,
  //   maxReconnectAttempts: 3
  // }
})

function App() {
  const { isConnected, isConnecting, isDisConnected, error } = useSocket()

  useEffect(() => {
    ws.connect()

    return () => {
      ws.disconnect()
    }
  }, [])


  return (
    <>
      <h1>WS Await Library Demo</h1>

      <div className='box'>
        {isConnecting && <p>Connecting...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
        {isConnected && <p style={{ color: 'green' }}>Connected!</p>}
        {isDisConnected && <p style={{ color: 'orange' }}>Disconnected</p>}
        {isDisConnected && <button onClick={() => ws.connect()}>Connect</button>}
        {isConnected && <button onClick={() => ws.disconnect()}>Disconnect</button>}
      </div>

      <div className='btn-box'>
        <button onClick={() => {
          ws.send('ping')
        }}>
          Send Message
        </button>
      </div>


      <div className='btn-box'>
        <button onClick={async () => {
          try {
            const response = await ws.request('getSignedURL', { fileType: 'image/png' })
            console.log('Signed URL:', response)
          } catch (err) {
            console.error('Request failed:', err)
          }
        }}>
          Async/Await Request
        </button>
      </div>

    </>
  )
}

export default App
