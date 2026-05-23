import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import { AuthRedirectHandler } from '../components/common/AuthRedirectHandler';
import Loader from '../components/common/Loader';
import { ROUTES } from '../lib/constants';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const UploadPage = lazy(() => import('../pages/UploadPage'));
const ItineraryDetailPage = lazy(() => import('../pages/ItineraryDetailPage'));
const HistoryPage = lazy(() => import('../pages/HistoryPage'));
const SharedItineraryPage = lazy(() => import('../pages/SharedItineraryPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <AuthRedirectHandler />
      <Suspense fallback={<Loader variant="fullPage" />}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.SHARED_ITINERARY} element={<SharedItineraryPage />} />
          <Route path={ROUTES.DASHBOARD} element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path={ROUTES.UPLOAD} element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path={ROUTES.ITINERARY_DETAIL} element={<ProtectedRoute><ItineraryDetailPage /></ProtectedRoute>} />
          <Route path={ROUTES.HISTORY} element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
