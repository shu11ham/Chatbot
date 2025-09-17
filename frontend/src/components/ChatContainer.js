import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import '../styles/ChatContainer.scss';

const ChatContainer = ({ sessionId }) => {
  const { 
    messages, 
    isLoading, 
    error, 
    isTyping, 
    streamingMessage,
    sendMessage,
    sendStreamingMessage,
    clearChat 
  } = useChat();
  
  const { socket, isConnected } = useSocket();
  const [useStreaming, setUseStreaming] = useState(true);
  const [socketMessages, setSocketMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, socketMessages]);

  useEffect(() => {
    if (socket && sessionId) {
      socket.emit('join-session', sessionId);

      socket.on('chat-response-chunk', (data) => {
        if (data.sessionId === sessionId) {
          if (data.isComplete) {
            // Handle completion
            setSocketMessages(prev => [
              ...prev.slice(0, -1), // Remove streaming message
              {
                type: 'assistant',
                content: data.chunk.response,
                sources: data.chunk.sources || [],
                timestamp: new Date().toISOString()
              }
            ]);
          } else {
            // Update streaming message
            setSocketMessages(prev => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.type === 'assistant' && lastMessage.streaming) {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    content: lastMessage.content + data.chunk
                  }
                ];
              } else {
                return [
                  ...prev,
                  {
                    type: 'assistant',
                    content: data.chunk,
                    streaming: true,
                    timestamp: new Date().toISOString()
                  }
                ];
              }
            });
          }
        }
      });

      socket.on('chat-error', (data) => {
        if (data.sessionId === sessionId) {
          console.error('Socket chat error:', data.error);
        }
      });

      return () => {
        socket.off('chat-response-chunk');
        socket.off('chat-error');
      };
    }
  }, [socket, sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (message) => {
    if (useStreaming && isConnected) {
      // Add user message to socket messages
      setSocketMessages(prev => [
        ...prev,
        {
          type: 'user',
          content: message,
          timestamp: new Date().toISOString()
        }
      ]);

      // Send via socket
      socket.emit('chat-message', { sessionId, message });
    } else {
      // Fallback to HTTP streaming or regular API
      if (useStreaming) {
        await sendStreamingMessage(message);
      } else {
        await sendMessage(message);
      }
    }
  };

  const handleClearChat = async () => {
    await clearChat();
    setSocketMessages([]);
  };

  const allMessages = [...messages, ...socketMessages];

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-title">
          <h2>News Assistant</h2>
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="chat-controls">
          <button
            className={`toggle-streaming ${useStreaming ? 'active' : ''}`}
            onClick={() => setUseStreaming(!useStreaming)}
            title={useStreaming ? 'Disable streaming' : 'Enable streaming'}
          >
            {useStreaming ? '⚡ Streaming' : '📝 Standard'}
          </button>
          
          <button 
            className="clear-chat"
            onClick={handleClearChat}
            disabled={isLoading}
            title="Clear chat history"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
        </div>
      )}

      <div className="chat-messages">
        {allMessages.length === 0 && !isLoading && (
          <div className="welcome-message">
            <div className="welcome-content">
              <h3>👋 Welcome to News Assistant!</h3>
              <p>Ask me anything about recent news and current events.</p>
              <div className="sample-questions">
                <h4>Try asking:</h4>
                <ul>
                  <li>"What's the latest news about technology?"</li>
                  <li>"Tell me about recent political developments"</li>
                  <li>"What are the top stories today?"</li>
                  <li>"Any updates on climate change?"</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <MessageList messages={allMessages} />
        
        {(isTyping || streamingMessage) && (
          <TypingIndicator streamingContent={streamingMessage} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <MessageInput 
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder="Ask me about the latest news..."
      />
    </div>
  );
};

export default ChatContainer;