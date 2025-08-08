"use client";

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && resetOnPropsChange && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some(
        (resetKey, idx) => prevResetKeys[idx] !== resetKey
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
      });
    }, 0);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-muted/50 rounded-lg border border-destructive/20">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <h2 className="text-lg font-semibold text-destructive">
          Something went wrong
        </h2>
      </div>
      
      <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
        An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
      </p>

      {isDevelopment && error && (
        <details className="mb-4 p-3 bg-muted rounded text-xs max-w-full overflow-auto">
          <summary className="cursor-pointer font-medium mb-2">
            Error Details (Development Only)
          </summary>
          <pre className="whitespace-pre-wrap text-destructive">
            {error.name}: {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      <Button onClick={resetErrorBoundary} variant="outline" size="sm">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  );
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Specific error boundaries for different parts of the app
export function FormErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Form Error</span>
          </div>
          <p className="text-sm text-muted-foreground">
            There was an error with the form. Please refresh the page and try again.
          </p>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('Form error:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ScreenshotErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center w-16 h-12 bg-destructive/10 border border-destructive/20 rounded">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('Screenshot preview error:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}