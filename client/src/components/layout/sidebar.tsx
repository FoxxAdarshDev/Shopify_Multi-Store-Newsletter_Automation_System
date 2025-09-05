import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useStoreContext } from "@/hooks/useStoreContext";
// Import logo from client assets
import foxxLogo from "@/assets/foxx-logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  Store, 
  Layout, 
  Users, 
  Code, 
  Settings,
  Building2,
  Shield,
  ChevronDown,
  Plus,
  Settings as SettingsIcon,
  Mail
} from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  permission?: string;
  adminOnly?: boolean;
}

const getNavigation = (selectedStoreId: string | null): NavigationItem[] => [
  { name: "Dashboard", href: selectedStoreId ? `/store/${selectedStoreId}/dashboard` : "/dashboard", icon: BarChart3 },
  { name: "Store Management", href: "/stores", icon: Store, permission: "manage_stores" },
  { name: "Popup Builder", href: selectedStoreId ? `/store/${selectedStoreId}/popup-builder` : "/popup-builder", icon: Layout, permission: "manage_popups" },
  { name: "Subscribers", href: selectedStoreId ? `/store/${selectedStoreId}/subscribers` : "/subscribers", icon: Users, permission: "view_subscribers" },
  { name: "Email Templates", href: selectedStoreId ? `/store/${selectedStoreId}/email-templates` : "/email-templates", icon: Mail, permission: "manage_email_settings" },
  { name: "Integration", href: selectedStoreId ? `/store/${selectedStoreId}/integration` : "/integration", icon: Code, permission: "manage_integrations" },
  { name: "Settings", href: selectedStoreId ? `/store/${selectedStoreId}/settings` : "/settings", icon: Settings, permission: "manage_email_settings" },
  { name: "Member Management", href: "/admin/members", icon: Shield, adminOnly: true },
];

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, hasPermission } = useAuth();
  const { stores, selectedStoreId, setSelectedStoreId, selectedStore } = useStoreContext();

  if (!user) {
    return null;
  }

  const navigation = getNavigation(selectedStoreId);
  // Filter navigation based on permissions
  const visibleNavigation = (navigation || []).filter((item) => {
    if (item.adminOnly && user.role !== 'admin') {
      return false;
    }
    if (item.permission && !hasPermission(item.permission)) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-64 bg-card border-r border-border shadow-sm sidebar-transition" data-testid="sidebar">
      <div className="p-6 border-b border-border">
        <div className="flex justify-center mb-4">
          <img 
            src={foxxLogo} 
            alt="Foxx Bioprocess Logo" 
            className="h-10 w-auto"
            data-testid="foxx-logo"
          />
        </div>
        
        {/* Store Selector */}
        <div className="mt-4">
          <Select value={selectedStoreId || ''} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-full">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                <SelectValue placeholder="Select Store">
                  {selectedStore?.name || 'Select Store'}
                </SelectValue>
                <ChevronDown className="h-4 w-4 ml-auto" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-xs text-muted-foreground border-b">
                filter by name...
              </div>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    {store.name}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="add-new" onSelect={() => setLocation('/onboarding')}>
                <div className="flex items-center text-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Site
                </div>
              </SelectItem>
              <div className="border-t pt-1">
                <SelectItem value="setup" onSelect={() => setLocation('/settings')}>
                  <div className="flex items-center">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Setup
                  </div>
                </SelectItem>
              </div>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <nav className="mt-6">
        <div className="px-3">
          <ul className="space-y-1">
            {visibleNavigation.map((item) => {
              const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
              return (
                <li key={item.name}>
                  <Link href={item.href}>
                    <div
                      className={cn(
                        "w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                        isActive 
                          ? "bg-accent text-accent-foreground" 
                          : "text-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="mr-3 h-4 w-4 text-muted-foreground" />
                      {item.name}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}
