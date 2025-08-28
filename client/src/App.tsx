import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import Stores from "@/pages/stores";
import PopupBuilder from "@/pages/popup-builder";
import Subscribers from "@/pages/subscribers";
import Integration from "@/pages/integration";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

// Auth pages
import Login from "@/pages/auth/login";
import ForgotPassword from "@/pages/auth/forgot-password";
import ResetPassword from "@/pages/auth/reset-password";

// Admin pages
import Members from "@/pages/admin/members";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication routes (always accessible)
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      
      {isAuthenticated ? (
        // Authenticated routes
        <Route>
          {() => (
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <Header />
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/dashboard" component={Dashboard} />
                    <Route path="/stores" component={Stores} />
                    <Route path="/popup-builder" component={PopupBuilder} />
                    <Route path="/subscribers" component={Subscribers} />
                    <Route path="/integration" component={Integration} />
                    <Route path="/settings" component={Settings} />
                    
                    {/* Admin only routes */}
                    {user?.role === 'admin' && (
                      <Route path="/admin/members" component={Members} />
                    )}
                    
                    <Route component={NotFound} />
                  </Switch>
                </div>
              </div>
            </div>
          )}
        </Route>
      ) : (
        // Redirect to login for unauthenticated users
        <Route>
          {() => {
            window.location.href = '/login';
            return null;
          }}
        </Route>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
