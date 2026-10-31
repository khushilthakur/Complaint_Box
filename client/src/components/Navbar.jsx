import React, { useState } from 'react';
import { 
  Building, Bell, LogIn, LogOut, PlusCircle, 
  BarChart3, LayoutGrid, Shield, GraduationCap, Briefcase, User,
  Sun, Moon, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal, onOpenSubmitModal }) {
  const { currentUser, role, logout } = useAuth();
  const { unreadCount, setIsDrawerOpen } = useNotifications();
  const { isDark, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-[#FDFBF7]/95 dark:bg-[#1E1713]/95 border-b border-[#E3D3C2] dark:border-[#38281E] sticky top-0 z-30 shadow-xs backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div 
            onClick={() => setActiveTab(currentUser ? (role === 'student' ? 'student' : role === 'teacher' ? 'teacher' : 'admin') : 'login')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7A5B42] via-[#5F442E] to-[#C9650F] flex items-center justify-center text-white shadow-md shadow-[#C9650F]/20 dark:shadow-none group-hover:scale-105 transition">
              <Building className="w-5 h-5 text-warm-100" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[#2E1E14] dark:text-[#F5EFEB] text-base sm:text-lg tracking-tight">
                  Student Complaint Box
                </span>
                <span className="text-[10px] font-bold bg-[#F1E9DF] dark:bg-[#38281E] text-[#7A5B42] dark:text-[#FCDCAC] px-2 py-0.5 rounded-full border border-[#E3D3C2] dark:border-[#4D3B2F] uppercase">
                  Institutional
                </span>
              </div>
              <p className="text-[11px] text-[#8C7563] dark:text-[#C7B4A3] hidden sm:block">
                College Student Complaint & Solution System
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1 text-xs font-semibold">
            {!currentUser && (
              <button
                onClick={() => setActiveTab('login')}
                className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  activeTab === 'login'
                    ? 'bg-[#C9650F] text-white font-bold shadow-sm shadow-[#C9650F]/30'
                    : 'text-[#6E5848] dark:text-[#DDD0C3] hover:text-[#2E1E14] dark:hover:text-white hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Direct Login</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('rankings')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'rankings'
                  ? 'bg-[#C9650F] text-white font-bold shadow-sm shadow-[#C9650F]/30'
                  : 'text-[#6E5848] dark:text-[#DDD0C3] hover:text-[#2E1E14] dark:hover:text-white hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span>College Rankings</span>
            </button>

            <button
              onClick={() => setActiveTab('public')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'public'
                  ? 'bg-[#C9650F] text-white font-bold shadow-sm shadow-[#C9650F]/30'
                  : 'text-[#6E5848] dark:text-[#DDD0C3] hover:text-[#2E1E14] dark:hover:text-white hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Public Complaints</span>
            </button>

            {/* Student Specific Tab */}
            {role === 'student' && (
              <button
                onClick={() => setActiveTab('student')}
                className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  activeTab === 'student'
                    ? 'bg-[#C9650F] text-white font-bold shadow-sm shadow-[#C9650F]/30'
                    : 'text-[#6E5848] dark:text-[#DDD0C3] hover:text-[#2E1E14] dark:hover:text-white hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>My Dashboard</span>
              </button>
            )}

            {/* Teacher Specific Tab */}
            {role === 'teacher' && (
              <button
                onClick={() => setActiveTab('teacher')}
                className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  activeTab === 'teacher'
                    ? 'bg-[#C9650F] text-white font-bold shadow-sm shadow-[#C9650F]/30'
                    : 'text-[#6E5848] dark:text-[#DDD0C3] hover:text-[#2E1E14] dark:hover:text-white hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Teacher Workspace</span>
              </button>
            )}

            {/* Admin Hub */}
            {role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-[#C9650F] text-white font-bold shadow-sm shadow-[#C9650F]/30'
                    : 'text-[#6E5848] dark:text-[#DDD0C3] hover:text-[#2E1E14] dark:hover:text-white hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Console</span>
              </button>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Submit Complaint Button for Student */}
            {role === 'student' && (
              <button
                onClick={onOpenSubmitModal}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7A5B42] hover:bg-[#5F442E] text-white font-bold text-xs shadow-sm shadow-[#7A5B42]/30 transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Submit Complaint</span>
              </button>
            )}

            {/* Dark Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-[#6E5848] hover:text-[#2E1E14] hover:bg-[#F1E9DF] dark:text-[#DDD0C3] dark:hover:text-white dark:hover:bg-[#2A1F18] transition"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-[#6E5848]" />
              )}
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="relative p-2 rounded-xl text-[#6E5848] hover:text-[#2E1E14] hover:bg-[#F1E9DF] dark:text-[#DDD0C3] dark:hover:text-white dark:hover:bg-[#2A1F18] transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#C9650F] text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Session Profile / Login CTA */}
            {currentUser ? (
              <div className="flex items-center gap-2 border-l border-[#E3D3C2] dark:border-[#38281E] pl-2 sm:pl-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-[#2E1E14] dark:text-[#F5EFEB] truncate max-w-[140px]">
                    {role === 'student' ? currentUser.maskedName || currentUser.name : currentUser.name}
                  </div>
                  <div className="text-[10px] text-[#8C7563] dark:text-[#C7B4A3] font-mono">
                    {role === 'student' ? currentUser.studentId : role === 'teacher' ? currentUser.teacherId : 'System Administrator'}
                  </div>
                </div>

                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                  role === 'student' ? 'bg-[#F1E9DF] dark:bg-[#38281E] text-[#5F442E] dark:text-[#FCDCAC] border-[#E3D3C2] dark:border-[#4D3B2F]' :
                  role === 'teacher' ? 'bg-[#FAF6F0] dark:bg-[#2F231B] text-[#7A5B42] dark:text-[#EBE1D7] border-[#DDD0C3] dark:border-[#4D3B2F]' :
                  'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                }`}>
                  {role}
                </span>

                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-[#8C7563] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('login')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9650F] hover:bg-[#A34C0C] text-white font-bold text-xs shadow-md shadow-[#C9650F]/20 transition cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Direct Login</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 md:hidden rounded-xl text-[#6E5848] hover:text-[#2E1E14] hover:bg-[#F1E9DF] dark:text-[#DDD0C3] dark:hover:text-white dark:hover:bg-[#2A1F18] transition"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-[#E3D3C2] dark:border-[#38281E] space-y-1 text-xs font-semibold">
            {!currentUser && (
              <button
                onClick={() => { setActiveTab('login'); setIsMobileMenuOpen(false); }}
                className={`w-full px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'login'
                    ? 'bg-[#C9650F] text-white font-bold'
                    : 'text-[#6E5848] dark:text-[#DDD0C3] hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Direct Login</span>
              </button>
            )}

            <button
              onClick={() => { setActiveTab('public'); setIsMobileMenuOpen(false); }}
              className={`w-full px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                activeTab === 'public'
                  ? 'bg-[#C9650F] text-white font-bold'
                  : 'text-[#6E5848] dark:text-[#DDD0C3] hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Public Complaints</span>
            </button>

            <button
              onClick={() => { setActiveTab('rankings'); setIsMobileMenuOpen(false); }}
              className={`w-full px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                activeTab === 'rankings'
                  ? 'bg-[#C9650F] text-white font-bold'
                  : 'text-[#6E5848] dark:text-[#DDD0C3] hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span>College Rankings</span>
            </button>

            {role === 'student' && (
              <>
                <button
                  onClick={() => { setActiveTab('student'); setIsMobileMenuOpen(false); }}
                  className={`w-full px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                    activeTab === 'student'
                      ? 'bg-[#C9650F] text-white font-bold'
                      : 'text-[#6E5848] dark:text-[#DDD0C3] hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>My Dashboard</span>
                </button>
                <button
                  onClick={() => { onOpenSubmitModal(); setIsMobileMenuOpen(false); }}
                  className="w-full px-3 py-2 rounded-lg bg-[#7A5B42] text-white font-bold flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Submit Complaint</span>
                </button>
              </>
            )}

            {role === 'teacher' && (
              <button
                onClick={() => { setActiveTab('teacher'); setIsMobileMenuOpen(false); }}
                className={`w-full px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'teacher'
                    ? 'bg-[#C9650F] text-white font-bold'
                    : 'text-[#6E5848] dark:text-[#DDD0C3] hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Teacher Workspace</span>
              </button>
            )}

            {role === 'admin' && (
              <button
                onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }}
                className={`w-full px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'admin'
                    ? 'bg-[#C9650F] text-white font-bold'
                    : 'text-[#6E5848] dark:text-[#DDD0C3] hover:bg-[#F1E9DF] dark:hover:bg-[#2A1F18]'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Console</span>
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
