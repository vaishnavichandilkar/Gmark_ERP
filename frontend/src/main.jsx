import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/geist-sans';
import '@fontsource/plus-jakarta-sans';
import './styles/global.css';
import './i18n/index';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
