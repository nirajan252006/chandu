import React from 'react';

// Lightweight internal router for this app (no react-router dependency).
// We use window.location.hash for navigation.

type Route = '/login' | '/change-password' | '/';

type NavigateProps = { to: Route; replace?: boolean };

export function Navigate({ to }: NavigateProps) {
  React.useEffect(() => {
    window.location.hash = to;
  }, [to]);
  return null;
}


export function useHashRoute() {
  const getRoute = (): Route => {
    const h = window.location.hash.replace('#', '');
    if (h === '/login') return '/login';
    if (h === '/change-password') return '/change-password';
    return '/';
  };

  const [route, setRoute] = React.useState<Route>(() => getRoute());

  React.useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return route;
}

