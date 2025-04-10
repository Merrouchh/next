import { useState, useEffect } from 'react';
import { trackView } from '../utils/viewTracking';
import { useAuth } from '../contexts/AuthContext';

export default function TestViewTracking() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewerId, setViewerId] = useState('');
  const [method, setMethod] = useState('regular'); // 'regular' or 'direct'

  // On page load, set a default anonymous viewer ID if not logged in
  useEffect(() => {
    if (!user) {
      let anonId = localStorage.getItem('anonymousViewerId');
      if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
        localStorage.setItem('anonymousViewerId', anonId);
      }
      setViewerId(anonId);
    } else {
      setViewerId(user.id);
    }
  }, [user]);

  const handleTrackView = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      // Use a real clip ID from your database
      const clipId = e.target.clipId.value;
      const viewerIdToUse = e.target.viewerId.value;
      const isAnonymous = !user;
      
      console.log(`Test view tracking with ${method} method:`, { clipId, viewerId: viewerIdToUse, isAnonymous });
      
      if (method === 'regular') {
        // Use the standard view tracking flow
        const viewCount = await trackView(clipId, viewerIdToUse, isAnonymous);
        setResult({
          success: true,
          viewCount: viewCount,
          message: viewCount !== null ? 'View tracked successfully!' : 'View already tracked in this session'
        });
      } else {
        // Use direct API endpoint
        const response = await fetch('/api/clips/direct-view-insert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clipId,
            viewerId: viewerIdToUse
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to track view directly');
        }
        
        setResult({
          success: true,
          viewCount: data.viewCount,
          message: data.message || 'View tracked directly!'
        });
      }
    } catch (err) {
      console.error('Error in test view tracking:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', background: '#222', color: '#fff', borderRadius: '8px' }}>
      <h1 style={{ marginBottom: '20px' }}>Test View Tracking</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
        <p><strong>User Status:</strong> {user ? 'Logged in as ' + user.username : 'Not logged in'}</p>
        <p><strong>Viewer ID:</strong> {viewerId ? viewerId.substring(0, 8) + '...' : 'Not set'}</p>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button 
          onClick={() => setMethod('regular')}
          style={{
            flex: 1,
            padding: '10px',
            background: method === 'regular' ? '#FFD700' : '#333',
            color: method === 'regular' ? '#000' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Regular Method
        </button>
        <button 
          onClick={() => setMethod('direct')}
          style={{
            flex: 1,
            padding: '10px',
            background: method === 'direct' ? '#FFD700' : '#333',
            color: method === 'direct' ? '#000' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Direct Insert
        </button>
      </div>
      
      <form onSubmit={handleTrackView} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Clip ID (required):
            <input 
              type="text" 
              name="clipId" 
              required
              style={{ 
                width: '100%', 
                padding: '8px', 
                background: '#333', 
                color: '#fff', 
                border: '1px solid #555', 
                borderRadius: '4px' 
              }} 
            />
          </label>
          <small style={{ color: '#aaa' }}>Enter a valid clip ID from your database</small>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Viewer ID:
            <input 
              type="text" 
              name="viewerId" 
              value={viewerId}
              onChange={(e) => setViewerId(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '8px', 
                background: '#333', 
                color: '#fff', 
                border: '1px solid #555', 
                borderRadius: '4px' 
              }} 
            />
          </label>
          <small style={{ color: '#aaa' }}>{user ? 'Your user ID' : 'Anonymous ID'}</small>
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            padding: '10px 15px',
            background: '#FFD700',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Tracking...' : `Track View (${method})`}
        </button>
      </form>
      
      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#1a1a1a', 
          borderRadius: '4px',
          borderLeft: '4px solid #4CAF50'
        }}>
          <h3>Result:</h3>
          <p><strong>Message:</strong> {result.message}</p>
          {result.viewCount !== null && (
            <p><strong>New View Count:</strong> {result.viewCount}</p>
          )}
        </div>
      )}
      
      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#1a1a1a', 
          borderRadius: '4px',
          borderLeft: '4px solid #f44336'
        }}>
          <h3>Error:</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
} 