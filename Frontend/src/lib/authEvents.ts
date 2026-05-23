type AuthRedirectListener = (path: string) => void;

let redirectListener: AuthRedirectListener | null = null;

export function setAuthRedirectListener(listener: AuthRedirectListener | null) {
  redirectListener = listener;
}

export function notifyAuthRedirect(path = '/login') {
  if (redirectListener) {
    redirectListener(path);
  } else if (typeof window !== 'undefined') {
    window.location.href = path;
  }
}
