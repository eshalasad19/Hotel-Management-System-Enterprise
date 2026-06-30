import { useState, useEffect } from 'react';
import api from '../../api/authApi';
import { connectSocket, disconnectSocket } from '../../services/socketService';

const STATUS_COLORS = {
  available:   { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32', icon: '✅' },
  occupied:    { bg: '#fff3e0', border: '#ff9800', text: '#e65100', icon: '🛏️' },
  cleaning:    { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0', icon: '🧹' },
  maintenance: { bg: '#fce4ec', border: '#e91e63', text: '#880e4f', icon: '🔧' },
  reserved:    { bg: '#f3e5f5', border: '#9c27b0', text: '#4a148c', icon: '📋' },
};

const LiveRoomDashboard = () => {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    // Rooms load karo
    api.get('/rooms', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(res => {
      setRooms(res.data);
      setLoading(false);
    });

    // Socket connect karo
    const socket = connectSocket();
    socket.on('room_status_updated', (data) => {
      setRooms(prev => prev.map(room =>
        room._id === data.roomId
          ? { ...room, status: data.status }
          : room
      ));
      setLastUpdated(new Date().toLocaleTimeString());
    });

    return () => {
      socket.off('room_status_updated');
    };
  }, []);

  const filtered = filter === 'all' ? rooms : rooms.filter(r => r.status === filter);

  const counts = {
    all: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
    reserved: rooms.filter(r => r.status === 'reserved').length,
  };

  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-success"></div>
      <p className="mt-2 text-muted">Loading rooms...</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-0 fw-bold">🏨 Live Room Dashboard</h5>
          {lastUpdated && (
            <small className="text-success">⚡ Last updated: {lastUpdated}</small>
          )}
        </div>
        <span className="badge bg-success">LIVE</span>
      </div>

      {/* Stats */}
      <div className="row g-2 mb-3">
        {Object.entries(STATUS_COLORS).map(([status, style]) => (
          <div className="col-6 col-md-2" key={status}>
            <div
              className="p-2 rounded text-center"
              style={{ background: style.bg, border: `1px solid ${style.border}`, cursor: 'pointer' }}
              onClick={() => setFilter(status)}
            >
              <div style={{ fontSize: 20 }}>{style.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: style.text }}>{counts[status]}</div>
              <div style={{ fontSize: 11, color: style.text, textTransform: 'capitalize' }}>{status}</div>
            </div>
          </div>
        ))}
        <div className="col-6 col-md-2">
          <div
            className="p-2 rounded text-center"
            style={{ background: '#f5f5f5', border: '1px solid #9e9e9e', cursor: 'pointer' }}
            onClick={() => setFilter('all')}
          >
            <div style={{ fontSize: 20 }}>🏨</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#424242' }}>{counts.all}</div>
            <div style={{ fontSize: 11, color: '#424242' }}>All Rooms</div>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="row g-2">
        {filtered.map(room => {
          const style = STATUS_COLORS[room.status] || STATUS_COLORS.available;
          return (
            <div className="col-6 col-md-3 col-lg-2" key={room._id}>
              <div
                className="p-3 rounded text-center h-100"
                style={{
                  background: style.bg,
                  border: `2px solid ${style.border}`,
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ fontSize: 22 }}>{style.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: style.text }}>
                  {room.roomNumber}
                </div>
                <div style={{ fontSize: 11, color: style.text, textTransform: 'capitalize' }}>
                  {room.type}
                </div>
                <div
                  className="mt-1 rounded"
                  style={{
                    background: style.border,
                    color: 'white',
                    fontSize: 10,
                    padding: '1px 6px',
                    textTransform: 'capitalize',
                  }}
                >
                  {room.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveRoomDashboard;