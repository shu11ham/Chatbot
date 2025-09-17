import React from 'react';
import ReactMarkdown from 'react-markdown';
import '../styles/MessageList.scss';

const MessageList = ({ messages }) => {
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const SourceCard = ({ source }) => (
    <div className="source-card">
      <div className="source-header">
        <span className="source-title">{source.title}</span>
        <span className="source-score">Score: {(source.score * 100).toFixed(1)}%</span>
      </div>
      {source.url && (
        <a 
          href={source.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="source-link"
        >
          Read more →
        </a>
      )}
    </div>
  );

  return (
    <div className="message-list">
      {messages.map((message, index) => (
        <div 
          key={index} 
          className={`message ${message.type} ${message.streaming ? 'streaming' : ''}`}
        >
          <div className="message-avatar">
            {message.type === 'user' ? '👤' : '🤖'}
          </div>
          
          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">
                {message.type === 'user' ? 'You' : 'News Assistant'}
              </span>
              <span className="message-time">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            
            <div className="message-body">
              {message.type === 'user' ? (
                <p>{message.content}</p>
              ) : (
                <ReactMarkdown 
                  components={{
                    p: ({ children }) => <p>{children}</p>,
                    ul: ({ children }) => <ul className="markdown-list">{children}</ul>,
                    ol: ({ children }) => <ol className="markdown-list">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    strong: ({ children }) => <strong>{children}</strong>,
                    em: ({ children }) => <em>{children}</em>,
                    code: ({ children }) => <code className="inline-code">{children}</code>,
                    pre: ({ children }) => <pre className="code-block">{children}</pre>
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
              
              {message.streaming && (
                <span className="typing-cursor">|</span>
              )}
            </div>
            
            {message.sources && message.sources.length > 0 && !message.streaming && (
              <div className="message-sources">
                <div className="sources-header">
                  <span>📰 Sources ({message.sources.length})</span>
                </div>
                <div className="sources-list">
                  {message.sources.map((source, sourceIndex) => (
                    <SourceCard key={sourceIndex} source={source} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;