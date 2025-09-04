import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Code, ArrowRight, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AddStoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StoreFormData {
  name: string;
  shopifyUrl: string;
  shopifyAccessToken?: string;
}

export default function AddStoreModal({ open, onOpenChange }: AddStoreModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<StoreFormData>({
    name: "",
    shopifyUrl: "",
  });
  const [selectedIntegrationType, setSelectedIntegrationType] = useState("typical");
  const [isHttps, setIsHttps] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createStoreMutation = useMutation({
    mutationFn: (data: StoreFormData) => apiRequest("/api/stores", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({
        title: "Success",
        description: "Store added successfully",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add store",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep(1);
    setFormData({ name: "", shopifyUrl: "" });
    setSelectedIntegrationType("typical");
    setIsHttps(true);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.shopifyUrl) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      createStoreMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const integrationTypes = [
    { id: "typical", name: "Typical Site", icon: Code, selected: selectedIntegrationType === "typical" },
    { id: "shopify", name: "Shopify", icon: Code, selected: selectedIntegrationType === "shopify" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="add-store-modal">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add New Store</DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                1
              </div>
              <span className={`ml-3 text-sm font-medium ${
                step >= 1 ? "text-foreground" : "text-muted-foreground"
              }`}>
                Add Your Site
              </span>
            </div>
            <div className="flex-1 mx-4 h-px bg-border"></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                2
              </div>
              <span className={`ml-3 text-sm font-medium ${
                step >= 2 ? "text-foreground" : "text-muted-foreground"
              }`}>
                Integrate Newsletter
              </span>
            </div>
            <div className="flex-1 mx-4 h-px bg-border"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="ml-3 text-sm text-muted-foreground">Verify Installation</span>
            </div>
          </div>

          {step === 1 && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Icon Upload */}
              <div className="space-y-4">
                <Card className="border-2 border-dashed border-border">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-muted rounded-lg mx-auto mb-4 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h4 className="font-medium text-foreground mb-2">UPLOAD ICON</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Recommended 192px x 192px<br />Must be square in size
                    </p>
                    <Button variant="secondary" size="sm" data-testid="button-choose-file">
                      Choose File
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Store Details */}
              <div className="space-y-4">
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-4">
                    Select Integration Type:
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {integrationTypes.map((type) => (
                      <Button
                        key={type.id}
                        variant="outline"
                        className={`p-3 h-auto flex flex-col items-center ${
                          type.selected 
                            ? "border-2 border-primary bg-primary/5" 
                            : "hover:border-primary hover:bg-primary/5"
                        }`}
                        onClick={() => setSelectedIntegrationType(type.id)}
                        data-testid={`button-integration-${type.id}`}
                      >
                        <type.icon className={`h-5 w-5 mb-2 ${
                          type.selected ? "text-primary" : "text-muted-foreground"
                        }`} />
                        <div className={`text-sm ${
                          type.selected ? "text-primary font-medium" : "text-muted-foreground"
                        }`}>
                          {type.name}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="siteName">Site Name:</Label>
                  <Input
                    id="siteName"
                    placeholder="Enter a name to remember your website by..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-site-name"
                  />
                </div>

                <div>
                  <Label htmlFor="siteUrl">
                    URL: <span className="text-xs text-muted-foreground">
                      (Enter full site url. Example: http://www.sitename.com)
                    </span>
                  </Label>
                  <Input
                    id="siteUrl"
                    type="url"
                    placeholder="enter your website url here..."
                    value={formData.shopifyUrl}
                    onChange={(e) => setFormData({ ...formData, shopifyUrl: e.target.value })}
                    data-testid="input-site-url"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notHttps"
                    checked={!isHttps}
                    onCheckedChange={(checked) => setIsHttps(!checked)}
                    data-testid="checkbox-not-https"
                  />
                  <Label htmlFor="notHttps" className="text-sm text-muted-foreground">
                    My site is not fully HTTPS
                  </Label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Configure Store Settings
                </h3>
                <p className="text-sm text-muted-foreground">
                  Add your Shopify access token to enable full integration
                </p>
              </div>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label htmlFor="accessToken">Shopify Access Token (Optional)</Label>
                    <Input
                      id="accessToken"
                      type="password"
                      placeholder="shpat_..."
                      value={formData.shopifyAccessToken || ""}
                      onChange={(e) => setFormData({ ...formData, shopifyAccessToken: e.target.value })}
                      data-testid="input-access-token"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Required for discount code validation and customer data access
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="font-medium text-blue-900 mb-2">How to get your access token:</h4>
                    <ol className="text-sm text-blue-800 space-y-1">
                      <li>1. Go to your Shopify admin panel</li>
                      <li>2. Navigate to Apps → App and sales channel settings</li>
                      <li>3. Click "Develop apps" → "Create an app"</li>
                      <li>4. Configure the app with necessary permissions</li>
                      <li>5. Install the app and copy the access token</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-end space-x-3">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleNext}
            disabled={createStoreMutation.isPending}
            data-testid="button-next-step"
          >
            {step === 1 ? (
              <>
                Next Step <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              createStoreMutation.isPending ? "Creating..." : "Create Store"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
