import { useState } from 'react';
import { Inbox, ArrowRight } from 'lucide-react';
import { authApi, getApiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const { setSession } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result =
        mode === 'register'
          ? await authApi.register({ email, password, name: name || undefined })
          : await authApi.login({ email, password });
      setSession(result.token, result.user);
    } catch (err) {
      showToast({
        variant: 'error',
        title: mode === 'register' ? 'Registration failed' : 'Sign in failed',
        description: getApiErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const result = await authApi.demoLogin();
      setSession(result.token, result.user);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Demo login failed',
        description: getApiErrorMessage(err),
      });
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto shadow-sm">
            <Inbox className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            ReachInbox Scheduler
          </h1>
          <p className="text-xs text-slate-500">
            Distributed email scheduling backed by BullMQ, Redis, and MongoDB
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm space-y-5">
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 rounded-md transition-colors ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-1.5 rounded-md transition-colors ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={mode === 'register' ? 8 : 1}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <Button type="submit" loading={submitting} className="w-full">
              {mode === 'register' ? 'Create Workspace' : 'Sign In'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200" />
            <span className="mx-3 text-[11px] uppercase tracking-wider text-slate-400">or</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              loading={demoLoading}
              onClick={handleDemoLogin}
              className="w-full"
            >
              Continue as Demo Evaluator
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
