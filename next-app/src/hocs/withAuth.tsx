'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '../components/ui/Loading';

interface WithAuthOptions {
  redirectTo?: string;
  loadingMessage?: string;
}

export function withAuth<T extends Record<string, any>>(
  WrappedComponent: React.ComponentType<T>,
  options: WithAuthOptions = {}
) {
  const {
    loadingMessage = 'Loading...'
  } = options;

  return function AuthenticatedComponent(props: T) {
    const { user, loading, openAuthModal } = useAuth();

    useEffect(() => {
      if (!loading && !user) {
        openAuthModal('login');
      }
    }, [user, loading, openAuthModal]);

    // Show loading while checking authentication
    if (loading) {
      return <Loading message={loadingMessage} fullScreen />;
    }

    // Show redirecting message if no user
    if (!user) {
      return <Loading message="Redirecting to login..." fullScreen />;
    }

    // Render the wrapped component if authenticated
    return <WrappedComponent {...props} />;
  };
}

// Convenience HOC for admin-only routes
export function withAdminAuth<T extends Record<string, any>>(
  WrappedComponent: React.ComponentType<T>,
  options: WithAuthOptions = {}
) {
  return withAuth((props: T) => {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (user && user.role !== 'Admin') {
        router.push('/unauthorized');
      }
    }, [user, router]);

    if (user?.role !== 'Admin') {
      return <Loading message="Checking permissions..." fullScreen />;
    }

    return <WrappedComponent {...props} />;
  }, {
    ...options,
    loadingMessage: 'Checking admin permissions...'
  });
}