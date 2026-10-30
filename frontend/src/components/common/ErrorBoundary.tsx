// ============================================================
// SmartLivestock AI — React Error Boundary
// ============================================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './Card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/20">
            <h2 className="text-base font-bold text-rose-700 dark:text-rose-400">
              Component Error Encountered
            </h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700"
            >
              Retry
            </button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

