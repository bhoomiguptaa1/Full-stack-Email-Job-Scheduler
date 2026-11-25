import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="text-base font-semibold text-slate-900">Something went wrong</h1>
            <p className="text-xs text-slate-500 mt-1.5 break-words">{this.state.message}</p>
            <Button className="mt-4" onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}>
              Reload application
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
