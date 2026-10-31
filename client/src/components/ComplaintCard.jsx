import React, { useState } from 'react';
import { 
  Building2, User, Clock, AlertCircle, CheckCircle, 
  Paperclip, MessageSquare, Flag, ShieldAlert, ArrowUpRight 
} from 'lucide-react';
import ResolutionTimer from './ResolutionTimer';
import ReportModal from './ReportModal';

export const CATEGORY_COLORS = {
  Academic: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  Infrastructure: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  Hostel: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Examination: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  'Fees/Administration': 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'Harassment/Safety': 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  Library: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  Transport: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Other: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
};

export const PRIORITY_STYLES = {
  Urgent: 'bg-rose-700 text-white shadow-sm shadow-rose-200 dark:shadow-none animate-pulse',
  High: 'bg-[#C9650F] text-white shadow-sm shadow-[#C9650F]/30 dark:shadow-none',
  Medium: 'bg-[#7A5B42] text-white',
  Low: 'bg-stone-500 text-white'
};

export const PRIORITY_LABELS = {
  Urgent: 'Urgent (24h Response Time)',
  High: 'High (48h Response Time)',
  Medium: 'Medium (3-day Response Time)',
  Low: 'Low (7-day Response Time)'
};

export const STATUS_LABELS = {
  Pending: 'Waiting',
  Approved: 'Approved',
  Assigned: 'Assigned',
  'In Progress': 'Being Worked On',
  Resolved: 'Solved',
  Completed: 'Solved & Confirmed',
  'Not Done': 'Reopened',
  Rejected: 'Not Accepted',
  Escalated: 'Sent to Higher Authority'
};

export const CATEGORY_LABELS = {
  Academic: 'Academic',
  Infrastructure: 'College Facilities',
  Hostel: 'Hostel',
  Examination: 'Examination',
  'Fees/Administration': 'Fees & Administration',
  'Harassment/Safety': 'Safety & Well-being',
  Library: 'Library',
  Transport: 'Transport',
  Other: 'Other'
};

export const STATUS_STYLES = {
  Pending: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  Approved: 'bg-stone-100 dark:bg-stone-800/60 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700',
  Assigned: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  'In Progress': 'bg-[#F1E9DF] dark:bg-[#2F231B] text-[#7A5B42] dark:text-[#EBE1D7] border-[#DDD0C3] dark:border-[#4D3B2F]',
  Resolved: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 font-bold',
  Completed: 'bg-emerald-700 text-white border-emerald-700 font-bold',
  'Not Done': 'bg-orange-100 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-800',
  Rejected: 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800',
  Escalated: 'bg-rose-700 text-white border-rose-700 animate-pulse font-bold'
};

export default function ComplaintCard({ complaint, onSelect, activeUserId }) {
  const [isReportOpen, setIsReportOpen] = useState(false);

  const isResolvedPendingVerify = complaint.status === 'Resolved' && complaint.verification?.status === 'Pending';
  const hasProofs = complaint.proofs && complaint.proofs.length > 0;
  const isAuthor = activeUserId && complaint.studentRealDetails;

  return (
    <>
      <div 
        onClick={() => onSelect(complaint)}
        className="group relative bg-white dark:bg-[#221A15] rounded-2xl p-5 border border-[#E3D3C2] dark:border-[#38281E] hover:border-[#C9650F] dark:hover:border-[#C9650F] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
      >
        {/* Top bar: ID, College ID, Priority */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#F1E9DF] dark:bg-[#2E221B] text-[#5F442E] dark:text-[#EBE1D7] border border-[#E3D3C2] dark:border-[#433125]">
                {complaint.id}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-[#FAF6F0] dark:bg-[#281F19] text-[#7A5B42] dark:text-[#C7B4A3] border border-[#E8DDD2] dark:border-[#3B2C23]">
                <Building2 className="w-3 h-3 text-[#AA9482] dark:text-[#8C7563]" />
                <span>ID: {complaint.collegeId}</span>
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${PRIORITY_STYLES[complaint.priority]}`}>
                {PRIORITY_LABELS[complaint.priority] || complaint.priority}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[complaint.status]}`}>
                {STATUS_LABELS[complaint.status] || complaint.status}
              </span>
            </div>
          </div>

          {/* College Name & Category */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-[#8C7563] dark:text-[#AA9482] truncate max-w-[200px]">
              {complaint.collegeName}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${CATEGORY_COLORS[complaint.category] || CATEGORY_COLORS.Other}`}>
              {CATEGORY_LABELS[complaint.category] || complaint.category}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-[#2E1E14] dark:text-[#F5EFEB] text-base leading-snug group-hover:text-[#C9650F] dark:group-hover:text-[#FAC37A] transition mb-2 line-clamp-2">
            {complaint.title}
          </h3>

          {/* Description snippet */}
          <p className="text-xs text-[#6E5848] dark:text-[#C7B4A3] line-clamp-2 leading-relaxed mb-4">
            {complaint.description}
          </p>
        </div>

        {/* Bottom Section */}
        <div className="pt-3 border-t border-[#E3D3C2]/70 dark:border-[#38281E] space-y-3">
          {/* Student Protected Identity vs Teacher */}
          <div className="flex items-center justify-between text-xs text-[#8C7563] dark:text-[#AA9482]">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#AA9482] dark:text-[#8C7563]" />
              <span className="font-medium text-[#4D3B2F] dark:text-warm-200">
                {complaint.displayName || 'Anonymous Student'}
              </span>
              {isAuthor && (
                <span className="bg-[#FAF6F0] dark:bg-[#38281E] text-[#C9650F] dark:text-[#FAC37A] text-[10px] font-bold px-1.5 py-0.2 rounded border border-[#E3D3C2] dark:border-[#4D3B2F]">
                  You
                </span>
              )}
            </div>

            {hasProofs && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#6E5848] dark:text-[#C7B4A3] bg-[#FAF6F0] dark:bg-[#2A1F18] px-2 py-0.5 rounded border border-[#E3D3C2] dark:border-[#38281E]">
                <Paperclip className="w-3 h-3 text-[#AA9482]" />
                <span>{complaint.proofs.length} Proof</span>
              </span>
            )}
          </div>

          {/* Assigned Teacher if any */}
          {complaint.assignedTeacherName && (
            <div className="flex items-center justify-between text-xs bg-[#FAF6F0] dark:bg-[#281F19] px-2.5 py-1.5 rounded-xl border border-[#E8DDD2] dark:border-[#3B2C23]">
              <span className="text-[#8C7563] dark:text-[#AA9482] font-medium">Assigned Teacher:</span>
              <span className="font-semibold text-[#2E1E14] dark:text-[#F5EFEB]">
                {complaint.assignedTeacherName} ({complaint.assignedTeacherRefId || 'Teacher'})
              </span>
            </div>
          )}

          {/* Escalation banner */}
          {complaint.isEscalated && (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-900 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-900">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="leading-tight">
                <span className="block">Sent to Higher Authority ({complaint.escalatedTo || 'Principal'})</span>
                <span className="text-[10px] font-normal text-rose-700 dark:text-rose-300">Sent to higher authority due to delayed response</span>
              </div>
            </div>
          )}

          {/* Verification pending highlight */}
          {isResolvedPendingVerify && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Solved by Teacher! Confirmation Pending</span>
            </div>
          )}

          {/* Resolution timestamp tracker */}
          {complaint.assignedAt && (
            <ResolutionTimer
              assignedAt={complaint.assignedAt}
              deadlineAt={complaint.deadlineAt}
              isEscalated={complaint.isEscalated}
              status={complaint.status}
              compact={true}
            />
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#8C7563] dark:text-[#AA9482]">
              {new Date(complaint.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReportOpen(true);
                }}
                className="text-[#8C7563] hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                title="Report fake or abusive content"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C9650F] dark:text-[#FAC37A] group-hover:translate-x-0.5 transition">
                <span>View Details</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <ReportModal
        complaint={complaint}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </>
  );
}
