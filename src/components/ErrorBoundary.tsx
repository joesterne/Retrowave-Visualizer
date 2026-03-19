import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = 'Something went wrong.';
      try {
        const errorInfo = JSON.parse(error?.message || '');
        if (errorInfo.error) {
          errorMessage = `Firestore Error: ${errorInfo.error} (${errorInfo.operationType} on ${errorInfo.path})`;
        }
      } catch {
        errorMessage = error?.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-[#00ff00] font-mono p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">SYSTEM ERROR</h2>
          <div className="bg-[#111] border-2 border-[#ff0000] p-4 max-w-md">
            <p className="text-sm break-words">{errorMessage}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-[#00ff00] text-black font-bold hover:bg-[#00aa00] transition-colors"
          >
            REBOOT SYSTEM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
