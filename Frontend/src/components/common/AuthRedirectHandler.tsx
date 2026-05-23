import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthRedirectListener } from '../../lib/authEvents';
import { ROUTES } from '../../lib/constants';

export function AuthRedirectHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    setAuthRedirectListener((path) => {
      navigate(path || ROUTES.LOGIN, { replace: true });
    });
    return () => setAuthRedirectListener(null);
  }, [navigate]);

  return null;
}
