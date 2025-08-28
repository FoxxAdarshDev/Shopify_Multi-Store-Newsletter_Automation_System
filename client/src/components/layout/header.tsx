import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, User } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Newsletter Manager</h1>
          <p className="text-sm text-muted-foreground">Manage your Shopify store newsletter campaigns</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="button-add-store-header"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Store
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
