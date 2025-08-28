import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SessionCountdown() {
  const { 
    getSessionTimeRemaining, 
    getSessionTimeRemainingFormatted, 
    logout, 
    sessionExpiresAt,
    user 
  } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!sessionExpiresAt) return;

    const updateTime = () => {
      const remaining = getSessionTimeRemaining();
      setTimeRemaining(remaining);

      // Show warning when less than 5 minutes remaining
      if (remaining > 0 && remaining <= 5 * 60 * 1000 && remaining > 4 * 60 * 1000) {
        toast({
          title: 'Session Expiring Soon',
          description: 'Your session will expire in less than 5 minutes.',
          variant: 'destructive',
        });
      }

      // Auto logout when session expires
      if (remaining <= 0) {
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please login again.',
          variant: 'destructive',
        });
        logout();
      }
    };

    // Update immediately
    updateTime();

    // Update every second
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiresAt, getSessionTimeRemaining, logout, toast]);

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