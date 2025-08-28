import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'member';
  permissions?: Record<string, boolean>;
}

interface AuthData {
  user: User;
  sessionExpiresAt: string;
}

export function useAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: authData, isLoading, error } = useQuery<AuthData>({
    queryKey: ['/api/auth/user'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/user'], null);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out',
      });
      setLocation('/login');
    },
    onError: (error: any) => {
      // Even if logout fails on server, clear client state
      queryClient.setQueryData(['/api/auth/user'], null);
      setLocation('/login');
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  const getSessionTimeRemaining = (): number => {
    if (!authData?.sessionExpiresAt) return 0;
    const expiresAt = new Date(authData.sessionExpiresAt);
    const now = new Date();
    return Math.max(0, expiresAt.getTime() - now.getTime());
  };

  const getSessionTimeRemainingFormatted = (): string => {
    const msRemaining = getSessionTimeRemaining();
    if (msRemaining === 0) return '0s';
    
    const totalSeconds = Math.floor(msRemaining / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const hasPermission = (permission: string): boolean => {
    if (authData?.user.role === 'admin') return true;
    return authData?.user.permissions?.[permission] || false;
  };

  return {
    user: authData?.user,
    isLoading,
    isAuthenticated: !!authData?.user,
    sessionExpiresAt: authData?.sessionExpiresAt,
    getSessionTimeRemaining,
    getSessionTimeRemainingFormatted,
    hasPermission,
    logout,
    isLoggingOut: logoutMutation.isPending,
    error,
  };
}