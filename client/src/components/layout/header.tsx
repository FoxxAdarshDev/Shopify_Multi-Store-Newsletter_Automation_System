import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { SessionCountdown } from "@/components/auth/session-countdown";
import { useLocation } from "wouter";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Settings as SettingsIcon } from "lucide-react";
import { Plus, User, LogOut, Settings, Shield } from "lucide-react";

export default function Header() {
  const { user, logout, isLoggingOut, hasPermission } = useAuth();
  const [, setLocation] = useLocation();
  const { stores, selectedStoreId, setSelectedStoreId, selectedStore } = useStoreContext();

  if (!user) {
    return null;
  }

  const userInitials = user.email.substring(0, 2).toUpperCase();

  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#0071b9' }}>
            Foxx Internal Tools
          </h1>
          <p className="text-sm text-muted-foreground">Newsletter Management Dashboard</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <SessionCountdown />
          
          {hasPermission('manage_stores') && (
            <Button 
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-white hover:opacity-90"
              style={{ backgroundColor: '#0071b9' }}
              data-testid="button-add-store-header"
              onClick={() => setLocation('/stores')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Store
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-user-menu">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none" data-testid="user-email">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs" data-testid="user-role">
                      {user.role === 'admin' ? (
                        <><Shield className="w-3 h-3 mr-1" />Admin</>
                      ) : (
                        <><User className="w-3 h-3 mr-1" />Member</>
                      )}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {user.role === 'admin' && (
                <>
                  <DropdownMenuItem
                    onClick={() => setLocation('/admin/members')}
                    data-testid="menu-manage-members"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Members
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem
                onClick={() => logout()}
                disabled={isLoggingOut}
                data-testid="menu-logout"
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
