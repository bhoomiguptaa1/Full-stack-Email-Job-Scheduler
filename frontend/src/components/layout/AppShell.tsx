import { useState, ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Mail,
  Send,
  Settings,
  Plus,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface AppShellProps {
  children: ReactNode;
  onOpenCompose: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/jobs', label: 'Email Jobs', icon: Mail },
  { to: '/senders', label: 'Senders & Limits', icon: Send },
  { to: '/settings', label: 'Integrations', icon: Settings },
];

export function AppShell({ children, onOpenCompose }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const currentNav = NAV_ITEMS.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-slate-900 block leading-none">
              ReachInbox
            </span>
            <span className="text-[11px] text-slate-500 leading-none mt-0.5 block">
              Email Scheduler
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-600"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        <Button onClick={onOpenCompose} className="w-full justify-center">
          <Plus className="h-4 w-4" />
          Schedule Email
        </Button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 text-slate-500" />
              {item.label}
            </NavLink>
          );
        })}

        <div className="pt-4 mt-4 border-t border-slate-200/70">
          <a
            href="/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <span>BullMQ Queue Board</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </a>
        </div>
      </nav>

      <div className="p-3 border-t border-slate-200/80">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">
              {user?.name || 'Workspace User'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 bg-white border-r border-slate-200/80 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-slate-950/35"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="w-64 bg-white h-full border-r border-slate-200 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white/90 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 rounded-md text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold text-slate-900 truncate">
              {currentNav?.label || 'ReachInbox'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onOpenCompose} className="lg:hidden">
              <Plus className="h-3.5 w-3.5" />
              Schedule
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
