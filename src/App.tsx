import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ContentCasesPage } from './features/content-cases/ContentCasesPage';
import { ContentCaseDetail } from './features/content-cases/ContentCaseDetail';
import { ContentCasePipeline } from './features/content-cases/ContentCasePipeline';
import { ContentCaseReview } from './features/review/ContentCaseReview';
import { CreateCaseWizard } from './features/content-cases/wizard/CreateCaseWizard';
import { LibraryPage } from './features/library/LibraryPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { VerifyWhatsAppPage } from './features/auth/VerifyWhatsAppPage';
import { useAuthStore } from './stores/authStore';
import { useContentCasesStore } from './stores/contentCasesStore';
import { useLibraryStore } from './stores/libraryStore';

// The protected application shell + routes. Only rendered when authenticated, so this
// is the single place that kicks off PROTECTED data loads (cases + library). Runs once
// per authenticated session: it mounts on login and unmounts on logout.
function AuthedApp() {
  const fetchCases   = useContentCasesStore(s => s.fetchCases);
  const fetchLibrary = useLibraryStore(s => s.fetchLibrary);
  useEffect(() => {
    void fetchCases();
    void fetchLibrary();
  }, [fetchCases, fetchLibrary]);

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/cases" element={<ContentCasesPage />} />
        <Route path="/cases/new" element={<CreateCaseWizard />} />
        <Route path="/cases/:id" element={<ContentCaseDetail />} />
        <Route path="/cases/:id/pipeline" element={<ContentCasePipeline />} />
        <Route path="/cases/:id/review" element={<ContentCaseReview />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/verify-whatsapp" element={<VerifyWhatsAppPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  const status = useAuthStore(s => s.status);
  const loadMe = useAuthStore(s => s.loadMe);

  // Phase 12 — hydrate auth from the httpOnly cookie on boot.
  useEffect(() => { void loadMe(); }, [loadMe]);

  // Brief boot state while /auth/me resolves — avoids a login flash for signed-in users.
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface-variant text-sm">
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      {status === 'authenticated' ? (
        <AuthedApp />
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
