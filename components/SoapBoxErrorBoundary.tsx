//--src/components/SoapBoxErrorBoundary.tsx
'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

export class SoapBoxErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: error.stack || 'No error stack available'
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('🚨 SoapBox Error Boundary Caught:', error);
    console.error('Error Info:', errorInfo);
    
    this.setState({
      hasError: true,
      error,
      errorInfo: errorInfo.componentStack || 'No component stack available'
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-red-600 mb-2">🚨 SoapBox Error</h1>
              <p className="text-gray-600">Your SoapBox application encountered an error</p>
            </div>

            <div className="bg-red-100 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-800 mb-2">Error Details:</h3>
              <p className="text-sm text-red-700 font-mono break-words">
                {this.state.error?.message || 'Unknown error occurred'}
              </p>
            </div>

            {this.state.errorInfo && (
              <details className="bg-gray-100 rounded-lg p-4 mb-6">
                <summary className="font-semibold text-gray-800 cursor-pointer mb-2">
                  Component Stack (Click to expand)
                </summary>
                <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                  {this.state.errorInfo}
                </pre>
              </details>
            )}

            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                🔄 Reload Application
              </button>

              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Common Solutions:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Clear your browser cache and reload</li>
                  <li>• Check your wallet connection</li>
                  <li>• Try connecting from a different browser</li>
                  <li>• Ensure your wallet is on Base network</li>
                </ul>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500">
                  If this error persists, please report it to the development team.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SoapBoxErrorBoundary;