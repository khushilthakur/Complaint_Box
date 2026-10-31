import React from 'react';
import { X, Bell, CheckCheck, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationsDrawer({ onSelectComplaint }) {
  const { 
    notifications, 
    unreadCount, 
    isDrawerOpen, 
    setIsDrawerOpen, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-brown-950/60 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-md bg-warm-50 dark:bg-brown-900 h-full shadow-2xl flex flex-col border-l border-warm-200 dark:border-brown-800">
        {/* Drawer Header */}
        <div className="p-5 border-b border-warm-200 dark:border-brown-800 flex items-center justify-between bg-warm-100/70 dark:bg-brown-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent-100 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-brown-900 dark:text-warm-100 text-sm">Notifications</h3>
              <p className="text-[11px] text-brown-500 dark:text-warm-400">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-semibold text-accent-700 dark:text-accent-400 hover:text-accent-800 dark:hover:text-accent-300 flex items-center gap-1 cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Read all</span>
              </button>
            )}
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 rounded-lg text-brown-400 hover:text-brown-700 dark:hover:text-warm-200 hover:bg-warm-200/60 dark:hover:bg-brown-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-brown-400 dark:text-warm-500 text-xs">
              No notifications yet. You will be alerted whenever complaints are updated, resolved, or verified.
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => {
                  markAsRead(n.id);
                  if (n.complaintId && onSelectComplaint) {
                    onSelectComplaint(n.complaintId);
                    setIsDrawerOpen(false);
                  }
                }}
                className={`p-3.5 rounded-xl border transition cursor-pointer text-xs space-y-1 ${
                  n.isRead
                    ? 'bg-white dark:bg-brown-900/80 border-warm-200 dark:border-brown-800 hover:bg-warm-100/50 dark:hover:bg-brown-800/50'
                    : 'bg-accent-50/70 dark:bg-accent-950/40 border-accent-200 dark:border-accent-900/60 hover:bg-accent-50 dark:hover:bg-accent-950/60 font-medium shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${n.isRead ? 'text-brown-800 dark:text-warm-200' : 'text-accent-900 dark:text-accent-300'}`}>
                    {n.title}
                  </span>
                  <span className="text-[10px] text-brown-400 dark:text-warm-500">
                    {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-brown-600 dark:text-warm-300/80 leading-relaxed">{n.message}</p>
                {n.complaintId && (
                  <div className="text-[11px] font-mono text-accent-700 dark:text-accent-400 font-semibold pt-1">
                    Reference: {n.complaintId} →
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
