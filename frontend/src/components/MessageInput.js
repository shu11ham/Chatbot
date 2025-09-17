import React, { useState, useRef, useEffect } from 'react';
import '../styles/MessageInput.scss';

const MessageInput = ({ onSendMessage, disabled, placeholder }) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isComposing) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const quickPrompts = [
    "What's the latest news?",
    "Tell me about technology updates",
    "Recent political developments",
    "Climate change news",
    "Economic updates"
  ];

  const insertQuickPrompt = (prompt) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="message-input-container">
      <div className="quick-prompts">
        {quickPrompts.map((prompt, index) => (
          <button
            key={index}
            className="quick-prompt"
            onClick={() => insertQuickPrompt(prompt)}
            disabled={disabled}
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder || "Type your message..."}
            disabled={disabled}
            className="message-textarea"
            rows={1}
          />
          
          <button
            type="submit"
            disabled={!message.trim() || disabled || isComposing}
            className="send-button"
            title="Send message (Enter)"
          >
            {disabled ? (
              <div className="loading-spinner small"></div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9"></polygon>
              </svg>
            )}
          </button>
        </div>
        
        <div className="input-footer">
          <span className="input-hint">
            Press Enter to send, Shift+Enter for new line
          </span>
          <span className="character-count">
            {message.length}/2000
          </span>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;