# RAG Chatbot Frontend

A modern React frontend for the RAG-powered news chatbot with real-time streaming responses and responsive design.

## Features

- 💬 **Modern Chat Interface**: Clean, intuitive design with message bubbles
- 🌓 **Dark/Light Theme**: Toggle between themes with persistent preference
- ⚡ **Streaming Responses**: Real-time typing indicators and response streaming
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile
- 🔄 **Session Management**: Create, clear, and persist chat sessions
- 📊 **System Monitoring**: Health status and statistics sidebar
- 🎯 **Quick Prompts**: Pre-defined questions for easy interaction
- 📰 **Source Citations**: Display article sources with relevance scores

## Tech Stack

- **React 18**: Modern React with hooks and context
- **SCSS**: Styled with CSS variables for theming
- **Socket.IO**: Real-time communication
- **Axios**: HTTP client for API calls
- **React Markdown**: Rich text rendering for responses

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Configure backend URL if different from default
   ```

3. **Start Development Server**:
   ```bash
   npm start
   ```

4. **Build for Production**:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/          # React components
│   ├── ChatContainer.js # Main chat interface
│   ├── Header.js        # App header with controls
│   ├── MessageInput.js  # Message input with quick prompts
│   ├── MessageList.js   # Message display with sources
│   ├── Sidebar.js       # Session info and stats
│   └── TypingIndicator.js # Typing animation
├── context/             # React contexts
│   ├── ChatContext.js   # Chat state management
│   └── SocketContext.js # Socket.IO connection
├── styles/              # SCSS stylesheets
│   ├── App.scss         # Global styles and variables
│   ├── ChatContainer.scss
│   ├── Header.scss
│   ├── MessageInput.scss
│   ├── MessageList.scss
│   ├── Sidebar.scss
│   └── TypingIndicator.scss
├── App.js               # Main app component
└── index.js             # React entry point
```

## Components

### ChatContainer
- Main chat interface
- Manages message flow
- Handles streaming vs standard responses
- Error handling and loading states

### MessageList
- Displays chat messages with timestamps
- Renders markdown content
- Shows source citations with relevance scores
- Animated message appearance

### MessageInput
- Multi-line text input with auto-resize
- Quick prompt buttons
- Character counter
- Send button with loading state

### Header
- App title and branding
- Theme toggle (dark/light)
- New session button
- Sidebar toggle

### Sidebar
- Session information
- System health status
- Usage statistics
- Action buttons

## Styling

### CSS Variables
- Consistent theming with CSS custom properties
- Dark/light theme support
- Responsive breakpoints
- Animation utilities

### SCSS Features
- Nested selectors for component organization
- Mixins for common patterns
- Variables for consistent spacing
- Media queries for responsiveness

## State Management

### ChatContext
- Message history
- Loading states
- Error handling
- Session management
- Streaming response handling

### SocketContext
- WebSocket connection management
- Connection status monitoring
- Real-time event handling

## Features in Detail

### Real-time Streaming
- Socket.IO for WebSocket communication
- Fallback to HTTP streaming (Server-Sent Events)
- Typing indicators during response generation
- Smooth message appearance animations

### Session Management
- Unique session IDs with UUID
- Persistent session storage in localStorage
- Chat history loading from backend
- Clear session functionality

### Responsive Design
- Mobile-first approach
- Flexible grid layouts
- Touch-friendly controls
- Optimized for various screen sizes

### Accessibility
- Semantic HTML structure
- Keyboard navigation support
- Screen reader friendly
- High contrast mode compatibility

## Environment Variables

```env
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_APP_NAME=News Assistant
REACT_APP_VERSION=1.0.0
```

## Available Scripts

- `npm start` - Start development server (port 3000)
- `npm run build` - Create production build
- `npm test` - Run test suite
- `npm run eject` - Eject from Create React App

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Optimizations

- React.memo for preventing unnecessary re-renders
- Lazy loading for large message lists
- Debounced input handling
- Optimized bundle size with code splitting

## Deployment

### Development
```bash
npm start  # Starts on localhost:3000
```

### Production Build
```bash
npm run build
serve -s build  # Serve static files
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npx", "serve", "-s", "build", "-l", "3000"]
```

### Hosting Options
- **Vercel**: Automatic deployments from Git
- **Netlify**: Static site hosting with CI/CD
- **AWS S3 + CloudFront**: Scalable static hosting
- **Docker**: Containerized deployment

## Contributing

1. Follow React best practices
2. Use functional components with hooks
3. Maintain consistent SCSS structure
4. Add PropTypes for component props
5. Write tests for new features

## Testing

```bash
npm test                 # Run all tests
npm test -- --coverage  # Run with coverage report
```

## License

MIT License - see LICENSE file for details