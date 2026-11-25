import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Server } from 'lucide-react';
import { healthApi } from '../services/api';

export default function SettingsPage() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: healthApi.check,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Infrastructure Health */}
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

        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { name: 'MongoDB', status: health?.dependencies?.mongodb || 'checking...' },
            { name: 'Redis (BullMQ)', status: health?.dependencies?.redis || 'checking...' },
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

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            This project uses <span className="font-medium text-slate-700">MongoDB</span> as the
            primary database and <span className="font-medium text-slate-700">Redis</span> for
            BullMQ job queues and per-sender rate limiting.
          </p>
        </div>
      </div>

      {/* Tech Stack Info */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Stack Overview</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Frontend', value: 'React + Vite + Tailwind CSS' },
            { label: 'Backend', value: 'Node.js + Express.js' },
            { label: 'Database', value: 'MongoDB + Mongoose' },
            { label: 'Job Queue', value: 'BullMQ + Redis' },
            { label: 'Email', value: 'Nodemailer + Ethereal (fake SMTP)' },
            { label: 'Auth', value: 'JWT (email/password + demo login)' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-50 border border-slate-200/70 px-3 py-2.5">
              <span className="text-slate-500">{item.label}</span>
              <p className="font-medium text-slate-900 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
