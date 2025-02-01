const { socket, isConnected } = useWebSocket();
console.log('[PARENT] WebSocket status:', { isConnected, socket });

const WebSocketDiagnostics = () => {
  const { socket, isConnected } = useWebSocket();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const testHandler = (data) => {
      setEvents(prev => [...prev, { type: 'received', data }]);
    };

    // Test event listeners
    socket.on('connect', () => {
      console.log('[WS] Connected');
      setEvents(prev => [...prev, { type: 'connect' }]);
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
      setEvents(prev => [...prev, { type: 'disconnect' }]);
    });

    socket.on('test', testHandler);

    // Send test event
    socket.emit('test', { timestamp: Date.now() });

    return () => {
      socket.off('test', testHandler);
    };
  }, [socket]);

  return (
    <div style={{ position: 'fixed', bottom: 0, background: 'white', padding: '1rem' }}>
      <h3>WebSocket Diagnostics</h3>
      <p>Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
      <div>
        {events.map((event, i) => (
          <div key={i}>
            {event.type} {event.data ? JSON.stringify(event.data) : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

// Add this to your parent component's render:
<WebSocketDiagnostics /> 