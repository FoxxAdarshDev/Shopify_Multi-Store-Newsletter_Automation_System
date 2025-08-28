import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Eye, Trash2, Store as StoreIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AddStoreModal from "@/components/modals/add-store-modal";
import { apiRequest } from "@/lib/queryClient";

interface Store {
  id: string;
  name: string;
  shopifyUrl: string;
  isConnected: boolean;
  isVerified: boolean;
  subscriberCount: number;
  conversionRate: string;
  createdAt: string;
}

export default function Stores() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  const deleteStoreMutation = useMutation({
    mutationFn: (storeId: string) => apiRequest("DELETE", `/api/stores/${storeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({
        title: "Success",
        description: "Store deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete store",
        variant: "destructive",
      });
    },
  });

  const handleDeleteStore = (storeId: string) => {
    if (confirm("Are you sure you want to delete this store? This action cannot be undone.")) {
      deleteStoreMutation.mutate(storeId);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Store Management</h2>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add New Store
          </Button>
        </div>
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="stores-page">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Store Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage your connected Shopify stores
          </p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          data-testid="button-add-store"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Store
        </Button>
      </div>

      <div className="grid gap-6">
        {stores.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <StoreIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No stores configured
              </h3>
              <p className="text-muted-foreground mb-4">
                Add your first Shopify store to start collecting newsletter subscribers
              </p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Store
              </Button>
            </CardContent>
          </Card>
        ) : (
          stores.map((store) => (
            <Card key={store.id} data-testid={`store-card-${store.id}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <StoreIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {store.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {store.shopifyUrl}
                      </p>
                      <div className="flex items-center mt-2 space-x-2">
                        <Badge
                          variant={store.isConnected ? "default" : "secondary"}
                          data-testid={`badge-status-${store.id}`}
                        >
                          {store.isConnected ? "Connected" : "Not Connected"}
                        </Badge>
                        {store.isVerified && (
                          <Badge variant="outline">Verified</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-configure-${store.id}`}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-preview-${store.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteStore(store.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      data-testid={`button-delete-${store.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Subscribers:</span>
                      <span className="ml-2 font-medium">{store.subscriberCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Conversion:</span>
                      <span className="ml-2 font-medium">{store.conversionRate}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <span className="ml-2 font-medium">
                        {new Date(store.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddStoreModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />
    </div>
  );
}
