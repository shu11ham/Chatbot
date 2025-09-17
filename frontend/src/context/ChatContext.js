import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const ChatContext = createContext();

const initialState = {
  messages: [],
  isLoading: false,
  error: null,
  isTyping: false,
  streamingMessage: '',
  sessionStats: null
};

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload],
        error: null
      };
    
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };
    
    case 'SET_STREAMING_MESSAGE':
      return { ...state, streamingMessage: action.payload };
    
    case 'CLEAR_STREAMING':
      return { ...state, streamingMessage: '', isTyping: false };
    
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], error: null };
    
    case 'SET_SESSION_STATS':
      return { ...state, sessionStats: action.payload };
    
    default:
      return state;
  }
};

export const ChatProvider = ({ children, sessionId }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  const loadChatHistory = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await axios.get(`/api/session/${sessionId}/history`);
      dispatch({ type: 'SET_MESSAGES', payload: response.data.messages });
    } catch (error) {
      console.error('Failed to load chat history:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load chat history' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const sendMessage = async (message) => {
    try {
      // Add user message immediately
      const userMessage = {
        type: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatch({ type: 'SET_TYPING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const response = await axios.post('/api/chat/message', {
        message,
        sessionId
      });

      // Add assistant response
      const assistantMessage = {
        type: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        sources: response.data.sources || []
      };
      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
      
    } catch (error) {
      console.error('Failed to send message:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send message. Please try again.' });
    } finally {
      dispatch({ type: 'SET_TYPING', payload: false });
    }
  };

  const sendStreamingMessage = async (message) => {
    try {
      // Add user message immediately
      const userMessage = {
        type: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatch({ type: 'SET_TYPING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, sessionId })
      });

      if (!response.ok) {
        throw new Error('Failed to get streaming response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamingContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                streamingContent += data.content;
                dispatch({ type: 'SET_STREAMING_MESSAGE', payload: streamingContent });
              } else if (data.type === 'complete') {
                // Add complete assistant message
                const assistantMessage = {
                  type: 'assistant',
                  content: streamingContent,
                  timestamp: new Date().toISOString(),
                  sources: data.sources || []
                };
                dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
                dispatch({ type: 'CLEAR_STREAMING' });
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to send streaming message:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send message. Please try again.' });
      dispatch({ type: 'CLEAR_STREAMING' });
    }
  };

  const clearChat = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await axios.delete(`/api/session/${sessionId}/clear`);
      dispatch({ type: 'CLEAR_MESSAGES' });
    } catch (error) {
      console.error('Failed to clear chat:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to clear chat history' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const loadSessionStats = async () => {
    try {
      const response = await axios.get('/api/session/stats');
      dispatch({ type: 'SET_SESSION_STATS', payload: response.data });
    } catch (error) {
      console.error('Failed to load session stats:', error);
    }
  };

  const value = {
    ...state,
    sendMessage,
    sendStreamingMessage,
    clearChat,
    loadChatHistory,
    loadSessionStats
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};