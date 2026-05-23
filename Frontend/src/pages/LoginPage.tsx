import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/auth/LoginForm';
import Loader from '../components/common/Loader';
import { PageShell } from '../components/layout/PageShell';
import { ROUTES } from '../lib/constants';

const LoginPage = () => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) return <Loader variant="fullPage" />;
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />;

  return (
    <PageShell centered>
      <LoginForm />
    </PageShell>
  );
};

export default LoginPage;
