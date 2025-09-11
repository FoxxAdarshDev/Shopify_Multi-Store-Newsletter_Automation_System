import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { StoreProvider } from "@/hooks/useStoreContext";
import Dashboard from "@/pages/dashboard";
import Stores from "@/pages/stores";
import PopupBuilder from "@/pages/popup-builder";
import Subscribers from "@/pages/subscribers";
import Integration from "@/pages/integration";
import Settings from "@/pages/settings";
import Onboarding from "@/pages/onboarding";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

// Auth pages
import Login from "@/pages/auth/login";
import ForgotPassword from "@/pages/auth/forgot-password";
import ResetPassword from "@/pages/auth/reset-password";

// Admin pages
import Members from "@/pages/admin/members";
import EmailTemplates from "@/pages/email-templates";
import EmailAnalytics from "@/pages/email-analytics";

function AuthenticatedRouter() {
  const { user } = useAuth();
  
  // Check if user has any stores configured
  const { data: stores = [], isLoading: storesLoading } = useQuery<Array<{id: string, name: string}>>({
    queryKey: ["/api/stores"],
  });

  if (storesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If no stores exist, show onboarding flow (no sidebar)
  if (stores.length === 0) {
    return <Onboarding />;
  }

  // Handle onboarding route separately (no sidebar)
  return (
    <Switch>
      <Route path="/onboarding" component={Onboarding} />
      
      {/* Regular authenticated layout with sidebar for all other routes */}
      <Route>
        {() => (
          <StoreProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <Header />
                  <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/dashboard" component={Dashboard} />
                  <Route path="/store/:storeId/dashboard" component={Dashboard} />
                  <Route path="/stores" component={Stores} />
                  <Route path="/popup-builder" component={PopupBuilder} />
                  <Route path="/store/:storeId/popup-builder" component={PopupBuilder} />
                  <Route path="/subscribers" component={Subscribers} />
                  <Route path="/store/:storeId/subscribers" component={Subscribers} />
                  <Route path="/integration" component={Integration} />
                  <Route path="/store/:storeId/integration" component={Integration} />
                  <Route path="/email-templates" component={EmailTemplates} />
                  <Route path="/store/:storeId/email-templates" component={EmailTemplates} />
                  <Route path="/email-analytics" component={EmailAnalytics} />
                  <Route path="/store/:storeId/email-analytics" component={EmailAnalytics} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/store/:storeId/settings" component={Settings} />
                  
                  {/* Admin only routes */}
                  {user?.role === 'admin' && (
                    <Route path="/admin/members" component={Members} />
                  )}
                  
                  <Route component={NotFound} />
                </Switch>
                </div>
              </div>
            </div>
          </StoreProvider>
        )}
      </Route>
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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
        // Authenticated routes with store checking
        <Route component={AuthenticatedRouter} />
      ) : (
        // Redirect to login if not authenticated
        <Route>
          {() => {
            window.location.pathname = '/login';
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
