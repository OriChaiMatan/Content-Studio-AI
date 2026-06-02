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

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
