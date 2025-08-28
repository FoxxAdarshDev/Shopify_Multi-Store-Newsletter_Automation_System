import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart3, 
  Store, 
  Layout, 
  Users, 
  Code, 
  Settings,
  Building2,
  Shield
} from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  permission?: string;
  adminOnly?: boolean;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Store Management", href: "/stores", icon: Store, permission: "manage_stores" },
  { name: "Popup Builder", href: "/popup-builder", icon: Layout, permission: "manage_popups" },
  { name: "Subscribers", href: "/subscribers", icon: Users, permission: "view_subscribers" },
  { name: "Integration", href: "/integration", icon: Code, permission: "manage_integrations" },
  { name: "Settings", href: "/settings", icon: Settings, permission: "manage_email_settings" },
  { name: "Member Management", href: "/admin/members", icon: Shield, adminOnly: true },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, hasPermission } = useAuth();

  if (!user) {
    return null;
  }

  // Filter navigation based on permissions
  const visibleNavigation = navigation.filter((item) => {
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
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Newsletter Manager</h1>
            <p className="text-xs text-muted-foreground">Foxx Bioprocess</p>
          </div>
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
                    <a
                      className={cn(
                        "w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive 
                          ? "bg-accent text-accent-foreground" 
                          : "text-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="mr-3 h-4 w-4 text-muted-foreground" />
                      {item.name}
                    </a>
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
