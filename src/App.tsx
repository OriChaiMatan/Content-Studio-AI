import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppDirection } from './i18n/useT';
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
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyWhatsAppPage } from './features/auth/VerifyWhatsAppPage';
import { useAuthStore } from './stores/authStore';
import { useContentCasesStore } from './stores/contentCasesStore';
import { useLibraryStore } from './stores/libraryStore';
import { ComingSoonModal } from './components/ui/ComingSoonModal';

// Lazy-loaded: the marketing site is an animation-heavy bundle (canvas particles,
// scroll choreography) with its own CSS that logged-in users never need to fetch.
const LandingPage = lazy(() => import('./features/marketing/LandingPage').then(m => ({ default: m.LandingPage })));
const AboutPage = lazy(() => import('./features/marketing/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./features/marketing/ContactPage').then(m => ({ default: m.ContactPage })));
const TermsPage = lazy(() => import('./features/marketing/TermsPage').then(m => ({ default: m.TermsPage })));
// Reachable both signed-in (Chrome Web Store reviewers, existing users) and
// signed-out (public), so it's imported once and used in both route trees below.
const PrivacyPage = lazy(() => import('./features/marketing/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

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
        <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPage /></Suspense>} />
        {/* Reachable while signed in so an emailed reset link still resolves. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  const status = useAuthStore(s => s.status);
  const loadMe = useAuthStore(s => s.loadMe);

  // App Language → <html dir/lang> (RTL for Hebrew, LTR for English), app-wide.
  useAppDirection();

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
          {/* Marketing site — the public face of the app for logged-out visitors.
              Lazy-loaded (see imports above) so its bundle/CSS stay out of the auth pages. */}
          <Route path="/" element={<Suspense fallback={null}><LandingPage /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={null}><AboutPage /></Suspense>} />
          <Route path="/contact" element={<Suspense fallback={null}><ContactPage /></Suspense>} />
          <Route path="/terms" element={<Suspense fallback={null}><TermsPage /></Suspense>} />
          {/* Public — reachable without auth (e.g. Chrome Web Store reviewers). */}
          <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPage /></Suspense>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      {/* Global — the one shared "LumAI Pro is coming soon" modal, reachable from
          every Upgrade/Waitlist CTA regardless of auth state. */}
      <ComingSoonModal />
    </BrowserRouter>
  );
}
