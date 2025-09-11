import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Trash, AlertCircle, BarChart3, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EmailClickData {
  id: string;
  subscriberEmail: string;
  storeId: string;
  trackingId: string;
  originalUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  clickedAt: string | null;
  isClicked: boolean;
  clickCount: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function EmailAnalytics() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedStore } = useStoreContext();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Query for detailed analytics data
  const { data: detailedAnalytics, isLoading: analyticsLoading } = useQuery<{
    stats: {clickRate: number; totalEmails: number; totalClicks: number};
    clickData: EmailClickData[];
  }>({
    queryKey: [`/api/stores/${selectedStore?.id}/email-analytics`],
    enabled: !!selectedStore?.id,
  });

  // Delete single analytics record mutation
  const deleteSingleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/email-analytics/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${selectedStore?.id}/email-analytics`] });
      toast({
        title: "Success",
        description: "Analytics record deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete analytics record",
        variant: "destructive",
      });
    },
  });

  // Bulk delete analytics records mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!selectedStore?.id) throw new Error("No store selected");
      return apiRequest(`/api/stores/${selectedStore.id}/email-analytics/bulk`, {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
    },
    onSuccess: (data: { deletedCount?: number }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${selectedStore?.id}/email-analytics`] });
      const deletedCount = data?.deletedCount || selectedIds.length;
      setSelectedIds([]);
      toast({
        title: "Success",
        description: `Successfully deleted ${deletedCount} analytics records`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete analytics records",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    checked = !!checked; // Ensure boolean type
    if (checked && detailedAnalytics?.clickData) {
      setSelectedIds(detailedAnalytics.clickData.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleSingleDelete = (id: string) => {
    deleteSingleMutation.mutate(id);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length > 0) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  if (analyticsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={selectedStore ? `/store/${selectedStore.id}/email-templates` : '/email-templates'} data-testid="link-back-email-templates">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Email Templates
              </Button>
            </Link>
            <h2 className="text-xl font-semibold text-foreground">Email Analytics</h2>
          </div>
        </div>
        <div className="flex justify-center py-8">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!detailedAnalytics?.clickData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={selectedStore ? `/store/${selectedStore.id}/email-templates` : '/email-templates'} data-testid="link-back-email-templates">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Email Templates
              </Button>
            </Link>
            <h2 className="text-xl font-semibold text-foreground">Email Analytics</h2>
          </div>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          No email data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={selectedStore ? `/store/${selectedStore.id}/email-templates` : '/email-templates'} data-testid="link-back-email-templates">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Email Templates
            </Button>
          </Link>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <h2 className="text-xl font-semibold text-foreground">Email Analytics</h2>
          </div>
        </div>
        {selectedIds.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete"
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete Selected ({selectedIds.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Analytics Records</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedIds.length} analytics record(s)? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Analytics Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary" data-testid="text-click-rate">
              {detailedAnalytics.stats.clickRate}%
            </div>
            <div className="text-sm text-muted-foreground">Click Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" data-testid="text-total-emails">
              {detailedAnalytics.stats.totalEmails}
            </div>
            <div className="text-sm text-muted-foreground">Emails Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-clicks">
              {detailedAnalytics.stats.totalClicks}
            </div>
            <div className="text-sm text-muted-foreground">Total Clicks</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Individual Email Details */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Email Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === detailedAnalytics.clickData.length && detailedAnalytics.clickData.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clicked Date</TableHead>
                  <TableHead>Click Count</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailedAnalytics.clickData.map((email) => (
                  <TableRow key={email.id} data-testid={`row-email-${email.subscriberEmail}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(email.id)}
                        onCheckedChange={(checked) => handleSelectItem(email.id, !!checked)}
                        data-testid={`checkbox-select-${email.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{email.subscriberEmail}</TableCell>
                    <TableCell>{new Date(email.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={email.isClicked ? "default" : "secondary"}>
                        {email.isClicked ? "Clicked" : "Sent"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {email.clickedAt ? new Date(email.clickedAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>{email.clickCount}</TableCell>
                    <TableCell className="text-xs">{email.ipAddress || "-"}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={deleteSingleMutation.isPending}
                            data-testid={`button-delete-${email.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Analytics Record</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the analytics record for {email.subscriberEmail}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleSingleDelete(email.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}