import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setPasswordSchema, type SetPasswordData } from '@shared/schema';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (!resetToken) {
      toast({
        title: 'Invalid Link',
        description: 'This password reset link is invalid or expired.',
        variant: 'destructive',
      });
      setLocation('/login');
    } else {
      setToken(resetToken);
    }
  }, [toast, setLocation]);

  const form = useForm<SetPasswordData>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      token: '',
      password: '',
    },
  });

  // Update form when token is loaded
  useEffect(() => {
    if (token) {
      form.setValue('token', token);
    }
  }, [token, form]);

  const resetMutation = useMutation({
    mutationFn: async (data: SetPasswordData) => {
      return await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Password Set Successfully',
        description: 'Your password has been set. You can now login.',
      });
      setLocation('/login');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set password',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SetPasswordData) => {
    resetMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
              <CardDescription>Validating reset token...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Set New Password
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose a strong password for your account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle data-testid="reset-password-title">Set New Password</CardTitle>
            <CardDescription>
              Enter a strong password that you'll remember
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your new password"
                          data-testid="input-password"
                          autoComplete="new-password"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-gray-500">
                        Password must be at least 8 characters long
                      </p>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetMutation.isPending}
                  data-testid="button-set-password"
                >
                  {resetMutation.isPending ? 'Setting Password...' : 'Set Password'}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm"
                    onClick={() => setLocation('/login')}
                    data-testid="link-back-to-login"
                  >
                    Back to Login
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}