import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/NewsStatus.scss';

const NewsStatus = () => {
  const [newsStats, setNewsStats] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const fetchNewsStats = async () => {
    try {
      const response = await axios.get('/api/news/stats');
      setNewsStats(response.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch news stats:', error);
      setError('Failed to load news statistics');
    }
  };

  const handleManualUpdate = async () => {
    setIsUpdating(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/news/update');
      setLastUpdate(new Date());
      await fetchNewsStats(); // Refresh stats after update
      
      // Show success message briefly
      setTimeout(() => setLastUpdate(null), 5000);
    } catch (error) {
      console.error('Failed to update news:', error);
      setError('Failed to update news');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleAutoUpdate = async () => {
    try {
      if (newsStats.isAutoUpdateRunning) {
        await axios.post('/api/news/stop-auto-update');
      } else {
        await axios.post('/api/news/start-auto-update');
      }
      await fetchNewsStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to toggle auto-update:', error);
      setError('Failed to toggle automatic updates');
    }
  };

  useEffect(() => {
    fetchNewsStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchNewsStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!newsStats && !error) {
    return (
      <div className="news-status loading">
        <div className="loading-spinner"></div>
        <span>Loading news status...</span>
      </div>
    );
  }

  return (
    <div className="news-status">
      <div className="news-status-header">
        <h3>📰 Real-time News</h3>
        <button 
          className={`auto-update-toggle ${newsStats?.isAutoUpdateRunning ? 'active' : ''}`}
          onClick={toggleAutoUpdate}
          title={newsStats?.isAutoUpdateRunning ? 'Stop automatic updates' : 'Start automatic updates'}
        >
          {newsStats?.isAutoUpdateRunning ? '⏸️ Auto' : '▶️ Auto'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {newsStats && (
        <div className="news-stats">
          <div className="stat-item">
            <span className="stat-label">Articles:</span>
            <span className="stat-value">{newsStats.totalDocuments || 0}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Feeds:</span>
            <span className="stat-value">{newsStats.feedCount || 0}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Auto-update:</span>
            <span className={`stat-value ${newsStats.isAutoUpdateRunning ? 'active' : 'inactive'}`}>
              {newsStats.isAutoUpdateRunning ? 'ON' : 'OFF'}
            </span>
          </div>
          
          {newsStats.updateInterval && (
            <div className="stat-item">
              <span className="stat-label">Interval:</span>
              <span className="stat-value">
                {Math.round(newsStats.updateInterval / 60000)}m
              </span>
            </div>
          )}
        </div>
      )}

      <div className="news-actions">
        <button 
          className="update-button"
          onClick={handleManualUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <>
              <div className="mini-spinner"></div>
              Updating...
            </>
          ) : (
            <>🔄 Update Now</>
          )}
        </button>
      </div>

      {lastUpdate && (
        <div className="success-message">
          ✅ News updated successfully!
        </div>
      )}

      <div className="news-info">
        <small>
          Sources: Reuters, CNN, BBC, TechCrunch, The Verge
        </small>
      </div>
    </div>
  );
};

export default NewsStatus;