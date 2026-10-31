import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    localStorage.removeItem('scb_user');
    localStorage.removeItem('scb_token');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF9F5] dark:bg-[#18120E] text-[#2C1E14] dark:text-[#F5EFEB] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#251D18] rounded-3xl p-8 border border-[#E3D3C2] dark:border-[#38281E] shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-[#2E1E14] dark:text-[#FAF5EE]">
              Application Encountered an Issue
            </h2>
            <p className="text-xs text-[#7A6250] dark:text-[#C7B4A3] leading-relaxed">
              An unexpected render error occurred. Click below to refresh the application session.
            </p>
            {this.state.error && (
              <pre className="text-[11px] text-left p-3 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-x-auto text-rose-600 dark:text-rose-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {this.state.error.stack || this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 rounded-xl bg-[#C9650F] hover:bg-[#B3560A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Session & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
