import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import axios from 'axios';
import NewsStatus from './NewsStatus';
import '../styles/Sidebar.scss';

const Sidebar = ({ isOpen, onClose, sessionId, onNewSession }) => {
  const { loadSessionStats, sessionStats } = useChat();
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      checkHealth();
    }
  }, [isOpen]);

  const loadStats = async () => {
    setLoading(true);
    try {
      await loadSessionStats();
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
    setLoading(false);
  };

  const checkHealth = async () => {
    try {
      const response = await axios.get('/api/health');
      setHealthStatus(response.data);
    } catch (error) {
      console.error('Failed to check health:', error);
      setHealthStatus({ status: 'unhealthy', error: error.message });
    }
  };

  const formatSessionId = (id) => {
    return id ? `${id.substring(0, 8)}...` : 'N/A';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return '#28a745';
      case 'degraded': return '#ffc107';
      case 'unhealthy': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Session Info</h3>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="sidebar-content">
          <div className="session-details">
            <h4>Current Session</h4>
            <div className="detail-item">
              <span className="label">Session ID:</span>
              <span className="value">{formatSessionId(sessionId)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Created:</span>
              <span className="value">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {sessionStats && (
            <div className="stats-section">
              <h4>Statistics</h4>
              <div className="stat-card">
                <div className="stat-item">
                  <span className="stat-label">Total Sessions</span>
                  <span className="stat-value">{sessionStats.sessions?.totalSessions || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Messages</span>
                  <span className="stat-value">{sessionStats.sessions?.totalMessages || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">News Articles</span>
                  <span className="stat-value">{sessionStats.embeddings?.totalDocuments || 0}</span>
                </div>
              </div>
            </div>
          )}

          {healthStatus && (
            <div className="health-section">
              <h4>System Health</h4>
              <div className="health-card">
                <div className="health-status">
                  <span 
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(healthStatus.status) }}
                  ></span>
                  <span className="status-text">
                    {healthStatus.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                
                {healthStatus.services && (
                  <div className="services-list">
                    {Object.entries(healthStatus.services).map(([service, status]) => (
                      <div key={service} className="service-item">
                        <span className="service-name">{service}</span>
                        <span 
                          className={`service-status ${status.status}`}
                        >
                          {status.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <NewsStatus />

          <div className="actions-section">
            <h4>Actions</h4>
            <button 
              className="action-btn primary"
              onClick={onNewSession}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
              New Session
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={loadStats}
              disabled={loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              {loading ? 'Refreshing...' : 'Refresh Stats'}
            </button>
          </div>

          <div className="info-section">
            <h4>About</h4>
            <p className="info-text">
              This chatbot uses Retrieval-Augmented Generation (RAG) to answer questions about recent news articles.
            </p>
            <div className="tech-stack">
              <span className="tech-item">React</span>
              <span className="tech-item">Node.js</span>
              <span className="tech-item">Gemini AI</span>
              <span className="tech-item">Qdrant</span>
              <span className="tech-item">Redis</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;