import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Server, Slack, Shield } from 'lucide-react';
import { authApi, getApiErrorMessage, healthApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChannel, setSelectedChannel] = useState(user?.slackChannelId || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    Boolean(user?.slackNotificationsEnabled)
  );

  useEffect(() => {
    setSelectedChannel(user?.slackChannelId || '');
    setNotificationsEnabled(Boolean(user?.slackNotificationsEnabled));
  }, [user]);

  useEffect(() => {
    if (searchParams.get('slack') === 'connected') {
      void refreshUser();
      showToast({ variant: 'success', title: 'Slack workspace connected' });
      searchParams.delete('slack');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshUser, showToast]);

  const { data: oauthUrls } = useQuery({
    queryKey: ['oauth-urls'],
    queryFn: authApi.getOAuthUrls,
  });

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: healthApi.check,
    refetchInterval: 10000,
  });

  const { data: slackChannels = [] } = useQuery({
    queryKey: ['slack-channels'],
    queryFn: authApi.getSlackChannels,
    enabled: Boolean(user?.slackConnected),
  });

  const saveSlackMutation = useMutation({
    mutationFn: authApi.updateSlackSettings,
    onSuccess: async () => {
      await refreshUser();
      showToast({ variant: 'success', title: 'Slack settings saved' });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        title: 'Could not save Slack settings',
        description: getApiErrorMessage(err),
      });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* System Dependencies */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Infrastructure Health</h2>
          </div>
          <a
            href="/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Open BullMQ Dashboard
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { name: 'PostgreSQL', status: health?.dependencies.postgres || 'checking...' },
            { name: 'Redis (BullMQ)', status: health?.dependencies.redis || 'checking...' },
            {
              name: 'Elasticsearch',
              status: health?.dependencies.elasticsearch || 'checking...',
            },
          ].map((dep) => {
            const ok = dep.status === 'connected';
            return (
              <div
                key={dep.name}
                className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 flex items-center justify-between"
              >
                <span className="text-xs font-medium text-slate-800">{dep.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    ok ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      ok ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {dep.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slack Integration */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Slack className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Slack Notifications</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Receive alerts when scheduled emails complete, fail, or hit sender hourly limits.
              </p>
            </div>
          </div>

          {user?.slackConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected{user.slackTeamName ? ` (${user.slackTeamName})` : ''}
            </span>
          ) : oauthUrls?.slackUrl ? (
            <a href={oauthUrls.slackUrl}>
              <Button size="sm">Connect Slack</Button>
            </a>
          ) : (
            <span className="text-xs text-slate-500">
              Set <code className="text-slate-700">SLACK_CLIENT_ID</code> in backend <code className="text-slate-700">.env</code> to enable OAuth
            </span>
          )}
        </div>

        {user?.slackConnected && (
          <div className="pt-3 border-t border-slate-100 grid sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Notification Channel
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
              >
                <option value="">Select a Slack channel</option>
                {slackChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.isPrivate ? '[Private] #' : '#'}
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Enable Slack alerts
              </label>

              <Button
                size="sm"
                loading={saveSlackMutation.isPending}
                onClick={() =>
                  saveSlackMutation.mutate({
                    slackChannelId: selectedChannel || null,
                    slackNotificationsEnabled: notificationsEnabled,
                  })
                }
              >
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Google OAuth */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Google Account Sign-In</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {user?.googleConnected
                ? `Linked to ${user.email}`
                : 'OAuth 2.0 authentication using google-auth-library.'}
            </p>
          </div>
        </div>

        {user?.googleConnected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verified
          </span>
        ) : oauthUrls?.googleUrl ? (
          <a href={oauthUrls.googleUrl}>
            <Button size="sm" variant="secondary">
              Link Google Account
            </Button>
          </a>
        ) : (
          <span className="text-xs text-slate-500">
            Set <code className="text-slate-700">GOOGLE_CLIENT_ID</code> in backend <code className="text-slate-700">.env</code>
          </span>
        )}
      </div>
    </div>
  );
}
