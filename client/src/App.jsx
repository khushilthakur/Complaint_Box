import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';

import Navbar from './components/Navbar';
import NotificationsDrawer from './components/NotificationsDrawer';
import ComplaintDetailModal from './components/ComplaintDetailModal';
import SubmitComplaintModal from './components/SubmitComplaintModal';
import ErrorBoundary from './components/ErrorBoundary';

import PublicPortal from './pages/PublicPortal';
import CollegeRankings from './pages/CollegeRankings';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AuthModal from './pages/AuthModal';
import DirectLoginPage from './pages/DirectLoginPage';

function MainApp() {
  const { currentUser, role } = useAuth();
  const [activeTab, setActiveTab] = useState(currentUser ? role : 'login');
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedCollegeFilter, setSelectedCollegeFilter] = useState('');

  // When role changes, automatically route to appropriate dashboard
  useEffect(() => {
    if (role === 'student') {
      setActiveTab('student');
    } else if (role === 'teacher') {
      setActiveTab('teacher');
    } else if (role === 'admin') {
      setActiveTab('admin');
    } else if (role === 'public') {
      setActiveTab('login');
    }
  }, [role]);

  const handleSelectCollege = (collegeId) => {
    setSelectedCollegeFilter(collegeId);
    setActiveTab('public');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] dark:bg-[#18120E] text-[#2C1E14] dark:text-[#F5EFEB] font-sans selection:bg-[#C9650F] selection:text-white transition-colors duration-200">
      {/* Institutional Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={() => setActiveTab('login')}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
      />

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'login' && (
          <DirectLoginPage 
            onLoginSuccess={(targetRole) => setActiveTab(targetRole)} 
          />
        )}
        {activeTab === 'public' && (
          <PublicPortal
            onSelectComplaint={(id) => setSelectedComplaintId(id)}
            onOpenSubmitModal={() => {
              if (!currentUser || currentUser.role !== 'student') {
                setIsAuthModalOpen(true);
              } else {
                setIsSubmitModalOpen(true);
              }
            }}
            initialCollegeId={selectedCollegeFilter}
            onClearCollegeFilter={() => setSelectedCollegeFilter('')}
            onNavigateRankings={() => setActiveTab('rankings')}
            onSelectCollege={handleSelectCollege}
          />
        )}

        {activeTab === 'rankings' && (
          <CollegeRankings onSelectCollege={handleSelectCollege} />
        )}

        {activeTab === 'student' && (
          role === 'student' ? (
            <StudentDashboard
              onSelectComplaint={(id) => setSelectedComplaintId(id)}
              isSubmitOpen={isSubmitModalOpen}
              setIsSubmitOpen={setIsSubmitModalOpen}
            />
          ) : (
            <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl m-4 text-rose-700 dark:text-rose-300 font-bold text-sm">
              Access restricted. Please log in with a valid student account.
            </div>
          )
        )}

        {activeTab === 'teacher' && (
          (role === 'teacher' && (currentUser?.approvalStatus === 'Approved' || (!currentUser?.approvalStatus && currentUser?.isVerified))) ? (
            <TeacherDashboard
              onSelectComplaint={(id) => setSelectedComplaintId(id)}
            />
          ) : (
            <div className="p-8 text-center bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 rounded-2xl m-4 text-amber-900 dark:text-amber-200 font-semibold text-sm space-y-2">
              <div className="font-extrabold text-base">Account Waiting for Admin Approval</div>
              <p>Your account is waiting for Admin approval. You can log in after your account is approved.</p>
            </div>
          )
        )}

        {activeTab === 'admin' && (
          role === 'admin' ? (
            <AdminDashboard
              onSelectComplaint={(id) => setSelectedComplaintId(id)}
            />
          ) : (
            <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl m-4 text-rose-700 dark:text-rose-300 font-bold text-sm">
              Access restricted. Administrator login required.
            </div>
          )
        )}
      </main>

      {/* Modals & Drawers */}
      <ComplaintDetailModal
        complaintId={selectedComplaintId}
        isOpen={Boolean(selectedComplaintId)}
        onClose={() => setSelectedComplaintId(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {currentUser?.role === 'student' && (
        <SubmitComplaintModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onSuccess={() => {
            setIsSubmitModalOpen(false);
          }}
          studentUser={currentUser}
        />
      )}

      <NotificationsDrawer
        onSelectComplaint={(id) => setSelectedComplaintId(id)}
      />

      {/* Institutional Footer with 5 Core Principles */}
      <footer className="bg-[#F5EFEB] dark:bg-[#1E1713] border-t border-[#E3D3C2] dark:border-[#38281E] mt-auto py-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white dark:bg-[#251D18] border border-[#E3D3C2] dark:border-[#38281E] shadow-xs">
              <span className="font-extrabold text-[#2C1E14] dark:text-warm-100 block mb-1">1. Student Safety</span>
              <p className="text-[#6E5848] dark:text-warm-400 leading-relaxed">Complainant identities are strictly protected from public users and teachers.</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#251D18] border border-[#E3D3C2] dark:border-[#38281E] shadow-xs">
              <span className="font-extrabold text-[#2C1E14] dark:text-warm-100 block mb-1">2. Controlled Filing</span>
              <p className="text-[#6E5848] dark:text-warm-400 leading-relaxed">Complaints require verified College IDs with 10-submission batches.</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#251D18] border border-[#E3D3C2] dark:border-[#38281E] shadow-xs">
              <span className="font-extrabold text-[#2C1E14] dark:text-warm-100 block mb-1">3. Public Transparency</span>
              <p className="text-[#6E5848] dark:text-warm-400 leading-relaxed">All approved complaints and resolution outcomes are accessible to view.</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#251D18] border border-[#E3D3C2] dark:border-[#38281E] shadow-xs">
              <span className="font-extrabold text-[#2C1E14] dark:text-warm-100 block mb-1">4. Resolver Accountability</span>
              <p className="text-[#6E5848] dark:text-warm-400 leading-relaxed">Assigned faculty work within monitored target deadlines and verify resolutions.</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#251D18] border border-[#E3D3C2] dark:border-[#38281E] shadow-xs">
              <span className="font-extrabold text-[#2C1E14] dark:text-warm-100 block mb-1">5. Admin Governance</span>
              <p className="text-[#6E5848] dark:text-warm-400 leading-relaxed">Centralized administration manages quotas, escalations, and abuse reports.</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#E3D3C2] dark:border-[#38281E] text-xs text-[#6E5848] dark:text-warm-400 flex-wrap gap-2">
            <div>
              <strong className="text-[#2C1E14] dark:text-warm-200">Student Complaint Box</strong> — Multi-College Grievance Management System
            </div>
            <div>
              © 2026 Student Complaint Box. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <MainApp />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
