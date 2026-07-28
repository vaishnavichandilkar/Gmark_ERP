import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/geist-sans';
import '@fontsource/plus-jakarta-sans';
import './styles/global.css';
import './i18n/index';

import ErrorBoundaryFallback from './components/common/ErrorBoundaryFallback';

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
        <ErrorBoundaryFallback 
          error={this.state.error} 
          resetError={() => this.setState({ hasError: false, error: null })} 
        />
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
