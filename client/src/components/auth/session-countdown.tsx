import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SessionCountdown() {
  const { 
    getSessionTimeRemainingFormatted, 
    logout, 
    sessionExpiresAt,
    user 
  } = useAuth();

  const [timeRemaining, setTimeRemaining] = useState(0);
  const { toast } = useToast();
  
  // Use refs to track toast states and stable logout reference
  const warningToastShown = useRef(false);
  const expiredToastShown = useRef(false);
  const logoutRef = useRef(logout);

  // Keep logout ref current
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    if (!sessionExpiresAt) return;

    // Compute time directly from sessionExpiresAt to avoid dependency on function
    const expiresAt = new Date(sessionExpiresAt).getTime();
    
    const updateTime = () => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeRemaining(remaining);

      // Show warning when less than 5 minutes remaining (only once)
      if (remaining > 0 && remaining <= 5 * 60 * 1000 && remaining > 4 * 60 * 1000 && !warningToastShown.current) {
        warningToastShown.current = true;
        toast({
          title: 'Session Expiring Soon',
          description: 'Your session will expire in less than 5 minutes.',
          variant: 'destructive',
        });
      }

      // Auto logout when session expires (only once)
      if (remaining <= 0 && !expiredToastShown.current) {
        expiredToastShown.current = true;
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please login again.',
          variant: 'destructive',
        });
        logoutRef.current();
      }
    };

    // Reset toast state when session is renewed
    warningToastShown.current = false;
    expiredToastShown.current = false;

    // Update immediately
    updateTime();

    // Update every second
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiresAt]); // Only depend on sessionExpiresAt to prevent infinite re-renders

  // Early return AFTER all hooks are called
  if (!sessionExpiresAt || !user) {
    return null;
  }

  const isExpiringSoon = timeRemaining <= 10 * 60 * 1000; // 10 minutes

  return (
    <div className="flex items-center gap-2 text-sm" data-testid="session-countdown">
      <Clock className="w-4 h-4" />
      <span className="text-muted-foreground">Session expires in:</span>
      <Badge 
        variant={isExpiringSoon ? "destructive" : "secondary"}
        data-testid="session-time-badge"
      >
        {getSessionTimeRemainingFormatted()}
      </Badge>
      {isExpiringSoon && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="ml-2"
          data-testid="button-refresh-session"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      )}
    </div>
  );
}