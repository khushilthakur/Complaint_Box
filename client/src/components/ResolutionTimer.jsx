import React from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Format date and time in a clear, perfect format.
 * Example: "11 Sep 2026, 02:30 PM"
 */
export function formatPerfectDateTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const dateStr = d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return isoString;
  }
}

/**
 * Format full date with day: "Friday, 11 Sep 2026 • 02:30 PM"
 */
export function formatFullDateTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    const dateStr = d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dayName}, ${dateStr} • ${timeStr}`;
  } catch {
    return isoString;
  }
}

export default function ResolutionTimer({ assignedAt, deadlineAt, isEscalated, status, compact = false }) {
  if (!assignedAt) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 font-medium">
        <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
        <span>Waiting for Teacher Assignment</span>
      </div>
    );
  }

  const assignedMs = new Date(assignedAt).getTime();
  const elapsedMs = Math.max(0, Date.now() - assignedMs);
  const is24HoursCompleted = elapsedMs >= 24 * 60 * 60 * 1000;
  const hoursPassed = Math.floor(elapsedMs / (1000 * 60 * 60));
  const isCompleted = status === 'Completed' || status === 'Resolved';

  const perfectTime = formatPerfectDateTime(assignedAt);
  const fullPerfectTime = formatFullDateTime(assignedAt);

  // Compact display (Used in Complaint Cards and table rows)
  if (compact) {
    if (isCompleted) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Assigned: {perfectTime} (Solved)</span>
        </div>
      );
    }

    if (is24HoursCompleted || isEscalated) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
          <span>24+ hrs passed • Assigned: {perfectTime}</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
        <Clock className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400 shrink-0" />
        <span>Assigned on: {perfectTime} (Within 24h)</span>
      </div>
    );
  }

  // Full detailed display (Used in Complaint Detail Modal)
  return (
    <div className={`p-4 rounded-2xl border transition-colors ${
      isCompleted
        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
        : is24HoursCompleted || isEscalated
        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60'
        : 'bg-stone-50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800'
    }`}>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 text-xs mb-3 flex-wrap">
        <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100">
          <Calendar className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span>Teacher Assignment & Response Time</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${
          isCompleted
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
            : is24HoursCompleted || isEscalated
            ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700'
            : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700'
        }`}>
          {isCompleted ? 'SOLVED' : is24HoursCompleted ? '24+ HOURS PASSED' : 'WITHIN 24-HR WINDOW'}
        </span>
      </div>

      {/* Main assignment timestamp display */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2 text-xs flex-wrap">
          <span className="text-stone-600 dark:text-stone-400 font-medium">Exact Date & Time Assigned:</span>
          <strong className="text-stone-900 dark:text-stone-100 font-bold text-sm">
            {fullPerfectTime}
          </strong>
        </div>

        {/* 24-hour status notice */}
        {is24HoursCompleted && !isCompleted ? (
          <div className="p-3 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-bold block mb-0.5">24 Hours Completed Notice:</strong>
              <span>
                24 hours have completed since this complaint was assigned on <strong>{perfectTime}</strong> ({hoursPassed} hours elapsed). The assigned teacher is requested to complete the solution quickly.
              </span>
            </div>
          </div>
        ) : !isCompleted ? (
          <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-600 dark:text-stone-400 shrink-0" />
            <span>
              Complaint assigned on <strong>{perfectTime}</strong>. Currently within the initial 24 hours of teacher assignment.
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Complaint was assigned on <strong>{perfectTime}</strong> and has been successfully solved.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
