import { useState, useEffect } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, Mail, Eye, Trash2, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  discountCodeSent: string | null;
  discountCodeUsed: boolean;
  isActive: boolean;
  subscribedAt: string;
}

interface Store {
  id: string;
  name: string;
}

export default function Subscribers() {
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });
  
  // Set default store to first store instead of "all"
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubscribers, setSelectedSubscribers] = useState<string[]>([]);
  const [viewingSubscriber, setViewingSubscriber] = useState<Subscriber | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Set default store when stores are loaded
  React.useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/stores", selectedStoreId, "subscribers"],
    enabled: !!selectedStoreId,
  });
  
  const deleteSubscriberMutation = useMutation({
    mutationFn: async (subscriberId: string) => {
      // Make it store-specific by using the store context
      return apiRequest(`/api/stores/${selectedStoreId}/subscribers/${subscriberId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/stores", selectedStoreId, "subscribers"]
      });
      toast({
        title: "Success",
        description: "Subscriber deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subscriber",
        variant: "destructive",
      });
    },
  });

  const filteredSubscribers = subscribers.filter(subscriber => {
    const matchesSearch = subscriber.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (subscriber.name && subscriber.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && subscriber.isActive) ||
                         (statusFilter === "unsubscribed" && !subscriber.isActive);
    
    return matchesSearch && matchesStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubscribers(filteredSubscribers.map(s => s.id));
    } else {
      setSelectedSubscribers([]);
    }
  };

  const handleSelectSubscriber = (subscriberId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubscribers(prev => [...prev, subscriberId]);
    } else {
      setSelectedSubscribers(prev => prev.filter(id => id !== subscriberId));
    }
  };
  
  const handleViewSubscriber = (subscriber: Subscriber) => {
    setViewingSubscriber(subscriber);
  };
  
  const handleDeleteSubscriber = (subscriberId: string) => {
    deleteSubscriberMutation.mutate(subscriberId);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Subscribers</h2>
          <div className="flex space-x-2">
            <Button disabled variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button disabled>
              <Mail className="h-4 w-4 mr-2" />
              Send Campaign
            </Button>
          </div>
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-96 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="subscribers-page">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Subscribers</h2>
          <p className="text-sm text-muted-foreground">
            Manage your newsletter subscribers
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button data-testid="button-send-campaign">
            <Mail className="h-4 w-4 mr-2" />
            Send Campaign
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Store</label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Date Range</label>
              <Select defaultValue="last-30">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-7">Last 7 days</SelectItem>
                  <SelectItem value="last-30">Last 30 days</SelectItem>
                  <SelectItem value="last-90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Search</label>
              <Input
                placeholder="Search email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-subscribers"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscribers Table */}
      <Card>
        <CardContent className="p-0">
          {filteredSubscribers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No subscribers found
              </h3>
              <p className="text-muted-foreground">
                {subscribers.length === 0 
                  ? "No subscribers have signed up yet. Set up your popup to start collecting emails."
                  : "No subscribers match your current filters. Try adjusting your search criteria."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Checkbox
                        checked={selectedSubscribers.length === filteredSubscribers.length}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Session ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Subscribed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Coupon Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredSubscribers.map((subscriber) => (
                    <tr key={subscriber.id} data-testid={`subscriber-row-${subscriber.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Checkbox
                          checked={selectedSubscribers.includes(subscriber.id)}
                          onCheckedChange={(checked) => 
                            handleSelectSubscriber(subscriber.id, !!checked)
                          }
                          data-testid={`checkbox-subscriber-${subscriber.id}`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {subscriber.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {subscriber.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {subscriber.sessionId ? subscriber.sessionId.substring(0, 12) + '...' : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {subscriber.name || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {subscriber.company || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(subscriber.subscribedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={subscriber.discountCodeUsed ? "default" : "secondary"}
                          data-testid={`badge-coupon-${subscriber.id}`}
                        >
                          {subscriber.discountCodeUsed ? "Used" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={subscriber.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${subscriber.id}`}
                        >
                          {subscriber.isActive ? "Active" : "Unsubscribed"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        <div className="flex space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <button 
                                className="text-primary hover:text-primary/80"
                                onClick={() => handleViewSubscriber(subscriber)}
                                data-testid={`button-view-${subscriber.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Subscriber Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                                  <p className="text-sm">{subscriber.email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                                  <p className="text-sm">{subscriber.name || "Not provided"}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Company</label>
                                  <p className="text-sm">{subscriber.company || "Not provided"}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Subscribed Date</label>
                                  <p className="text-sm">{new Date(subscriber.subscribedAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Discount Code Sent</label>
                                  <p className="text-sm">{subscriber.discountCodeSent || "None"}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Discount Code Used</label>
                                  <p className="text-sm">{subscriber.discountCodeUsed ? "Yes" : "No"}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                                  <p className="text-sm">{subscriber.isActive ? "Active" : "Unsubscribed"}</p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button 
                                className="text-red-600 hover:text-red-800"
                                data-testid={`button-delete-${subscriber.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Subscriber</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {subscriber.email}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteSubscriber(subscriber.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredSubscribers.length > 0 && (
            <div className="bg-muted px-6 py-3 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredSubscribers.length} of {subscribers.length} subscribers
              </div>
              {selectedSubscribers.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedSubscribers.length} selected
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
