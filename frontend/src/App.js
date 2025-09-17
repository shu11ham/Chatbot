import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatContainer from './components/ChatContainer';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { ChatProvider } from './context/ChatContext';
import { SocketProvider } from './context/SocketContext';
import './styles/App.scss';

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Initialize session
    const savedSessionId = localStorage.getItem('chatSessionId');
    if (savedSessionId) {
      setSessionId(savedSessionId);
    } else {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      localStorage.setItem('chatSessionId', newSessionId);
    }

    // Load theme preference
    const savedTheme = localStorage.getItem('chatTheme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  const createNewSession = () => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    localStorage.setItem('chatSessionId', newSessionId);
  };

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('chatTheme', newTheme ? 'dark' : 'light');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (!sessionId) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Initializing chat session...</p>
      </div>
    );
  }

  return (
    <div className={`app ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <SocketProvider>
        <ChatProvider sessionId={sessionId}>
          <Header 
            onToggleSidebar={toggleSidebar}
            onToggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
            onNewSession={createNewSession}
          />
          
          <div className="app-body">
            <Sidebar 
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              sessionId={sessionId}
              onNewSession={createNewSession}
            />
            
            <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
              <ChatContainer sessionId={sessionId} />
            </main>
          </div>
        </ChatProvider>
      </SocketProvider>
    </div>
  );
}

export default App;