import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import RegisterForm from '../components/auth/RegisterForm';
import Loader from '../components/common/Loader';
import { PageShell } from '../components/layout/PageShell';
import { ROUTES } from '../lib/constants';

const RegisterPage = () => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) return <Loader variant="fullPage" />;
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />;

  return (
    <PageShell centered>
      <RegisterForm />
    </PageShell>
  );
};

export default RegisterPage;
