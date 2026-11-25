import { lazy, Suspense, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { EmailJob } from './types';
import { AppShell } from './components/layout/AppShell';
import { ScheduleEmailModal } from './components/jobs/ScheduleEmailModal';
import { RescheduleModal } from './components/jobs/RescheduleModal';
import { JobDetailDrawer } from './components/jobs/JobDetailDrawer';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const SendersPage = lazy(() => import('./pages/SendersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading...
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<EmailJob | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-sm text-slate-500 gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Initializing workspace...
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/*"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (
              <AppShell onOpenCompose={() => setComposeOpen(true)}>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <DashboardPage
                          onOpenCompose={() => setComposeOpen(true)}
                          onSelectJob={setSelectedJobId}
                        />
                      }
                    />
                    <Route
                      path="/jobs"
                      element={
                        <JobsPage
                          onOpenCompose={() => setComposeOpen(true)}
                          onSelectJob={setSelectedJobId}
                          onRequestReschedule={setRescheduleTarget}
                        />
                      }
                    />
                    <Route path="/senders" element={<SendersPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>

                <ScheduleEmailModal
                  open={composeOpen}
                  onClose={() => setComposeOpen(false)}
                />
                <RescheduleModal
                  job={rescheduleTarget}
                  onClose={() => setRescheduleTarget(null)}
                />
                <JobDetailDrawer
                  jobId={selectedJobId}
                  onClose={() => setSelectedJobId(null)}
                  onRequestReschedule={(job) => setRescheduleTarget(job)}
                />
              </AppShell>
            )
          }
        />
      </Routes>
    </Suspense>
  );
}
