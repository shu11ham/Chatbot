import React from 'react';
import ReactMarkdown from 'react-markdown';
import '../styles/TypingIndicator.scss';

const TypingIndicator = ({ streamingContent }) => {
  if (streamingContent) {
    return (
      <div className="message assistant streaming">
        <div className="message-avatar">
          🤖
        </div>
        <div className="message-content">
          <div className="message-header">
            <span className="message-sender">News Assistant</span>
            <span className="message-time">typing...</span>
          </div>
          <div className="message-body">
            <ReactMarkdown>{streamingContent}</ReactMarkdown>
            <span className="typing-cursor">|</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="typing-indicator">
      <div className="message-avatar">
        🤖
      </div>
      <div className="typing-content">
        <div className="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span className="typing-text">News Assistant is typing...</span>
      </div>
    </div>
  );
};

export default TypingIndicator;