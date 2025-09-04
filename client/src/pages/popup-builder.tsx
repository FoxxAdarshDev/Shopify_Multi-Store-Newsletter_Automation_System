import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PopupPreview from "@/components/popup-preview";
import { apiRequest } from "@/lib/queryClient";

interface PopupConfig {
  id: string;
  storeId: string;
  title: string;
  subtitle: string;
  buttonText: string;
  fields: {
    email: boolean;
    name: boolean;
    phone: boolean;
    company: boolean;
    address: boolean;
  };
  emailValidation: {
    companyEmailsOnly: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
  };
  discountCode: string;
  discountPercentage: number;
  displayTrigger: string;
  animation: string;
  suppressAfterSubscription: boolean;
  isActive: boolean;
}

interface Store {
  id: string;
  name: string;
}

export default function PopupBuilder() {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const urlStoreId = urlParams.get('storeId') || "";
  const previewMode = urlParams.get('preview') === 'true';
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>(urlStoreId);
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const [showPreview, setShowPreview] = useState(previewMode);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  const { data: popupConfig, isLoading } = useQuery({
    queryKey: [`/api/stores/${selectedStoreId}/popup`],
    enabled: !!selectedStoreId,
  });

  const updateConfigMutation = useMutation({
    mutationFn: (updates: Partial<PopupConfig>) =>
      apiRequest(`/api/stores/${selectedStoreId}/popup`, { method: "PUT", body: JSON.stringify(updates) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${selectedStoreId}/popup`] });
      toast({
        title: "Success",
        description: "Popup configuration updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update popup configuration",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (popupConfig) {
      setConfig(popupConfig as PopupConfig);
    }
  }, [popupConfig]);

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const handleConfigUpdate = (updates: Partial<PopupConfig>) => {
    if (!config) return;
    
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    updateConfigMutation.mutate(updates);
  };

  const handleFieldChange = (field: keyof PopupConfig["fields"], checked: boolean) => {
    if (!config) return;
    
    const newFields = { ...config.fields, [field]: checked };
    handleConfigUpdate({ fields: newFields });
  };

  const handleEmailValidationChange = (field: keyof PopupConfig["emailValidation"], value: any) => {
    if (!config) return;
    
    const newValidation = { ...config.emailValidation, [field]: value };
    handleConfigUpdate({ emailValidation: newValidation });
  };

  // Show message if no stores exist
  if (stores.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-4">No Stores Configured</h2>
          <p className="text-muted-foreground mb-6">
            You need to add a store before you can build newsletter popups.
          </p>
          <Button onClick={() => window.location.href = '/stores'}>
            Add Your First Store
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !config) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-32 bg-muted rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div>
              <Card>
                <CardContent className="p-6">
                  <div className="h-96 bg-muted rounded"></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="popup-builder-page">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Newsletter Popup Builder</h2>
          <p className="text-sm text-muted-foreground">
            Customize your newsletter subscription popup
          </p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setShowPreview(true)}
            data-testid="button-preview-popup"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview Popup
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Basic Settings */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Basic Settings</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Popup Title</Label>
                  <Input
                    id="title"
                    value={config.title}
                    onChange={(e) => handleConfigUpdate({ title: e.target.value })}
                    data-testid="input-popup-title"
                  />
                </div>
                <div>
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Textarea
                    id="subtitle"
                    rows={3}
                    value={config.subtitle}
                    onChange={(e) => handleConfigUpdate({ subtitle: e.target.value })}
                    data-testid="textarea-popup-subtitle"
                  />
                </div>
                <div>
                  <Label htmlFor="buttonText">Button Text</Label>
                  <Input
                    id="buttonText"
                    value={config.buttonText}
                    onChange={(e) => handleConfigUpdate({ buttonText: e.target.value })}
                    data-testid="input-button-text"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field Configuration */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Form Fields</h3>
              <div className="space-y-3">
                {Object.entries(config.fields).map(([field, enabled]) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${field}`}
                      checked={enabled}
                      onCheckedChange={(checked) => 
                        handleFieldChange(field as keyof PopupConfig["fields"], !!checked)
                      }
                      disabled={field === 'email'}
                      data-testid={`checkbox-field-${field}`}
                    />
                    <Label htmlFor={`field-${field}`} className="text-sm">
                      {field === 'email' ? 'Email Address (Required)' : 
                       field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Email Validation */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Email Validation</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="companyEmailsOnly"
                    checked={config.emailValidation.companyEmailsOnly}
                    onCheckedChange={(checked) => 
                      handleEmailValidationChange('companyEmailsOnly', !!checked)
                    }
                    data-testid="checkbox-company-emails-only"
                  />
                  <Label htmlFor="companyEmailsOnly" className="text-sm">
                    Accept only company email addresses
                  </Label>
                </div>
                <div>
                  <Label htmlFor="allowedDomains">Allowed Domains (comma-separated)</Label>
                  <Input
                    id="allowedDomains"
                    placeholder="foxxlifesciences.com, company.com"
                    value={config.emailValidation.allowedDomains.join(', ')}
                    onChange={(e) => 
                      handleEmailValidationChange(
                        'allowedDomains', 
                        e.target.value.split(',').map(d => d.trim()).filter(Boolean)
                      )
                    }
                    data-testid="input-allowed-domains"
                  />
                </div>
                <div>
                  <Label htmlFor="blockedDomains">Blocked Domains</Label>
                  <Input
                    id="blockedDomains"
                    placeholder="gmail.com, yahoo.com, hotmail.com"
                    value={config.emailValidation.blockedDomains.join(', ')}
                    onChange={(e) => 
                      handleEmailValidationChange(
                        'blockedDomains', 
                        e.target.value.split(',').map(d => d.trim()).filter(Boolean)
                      )
                    }
                    data-testid="input-blocked-domains"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Discount Configuration */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Discount Configuration</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="discountCode">Discount Code Name</Label>
                  <Input
                    id="discountCode"
                    value={config.discountCode}
                    onChange={(e) => handleConfigUpdate({ discountCode: e.target.value })}
                    data-testid="input-discount-code"
                  />
                </div>
                <div>
                  <Label htmlFor="discountPercentage">Discount Percentage</Label>
                  <Input
                    id="discountPercentage"
                    type="number"
                    min="1"
                    max="100"
                    value={config.discountPercentage}
                    onChange={(e) => handleConfigUpdate({ discountPercentage: Number(e.target.value) })}
                    data-testid="input-discount-percentage"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Live Preview</h3>
              <PopupPreview config={config} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Popup Settings</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="displayTrigger">Display Trigger</Label>
                  <Select 
                    value={config.displayTrigger} 
                    onValueChange={(value) => handleConfigUpdate({ displayTrigger: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Show immediately</SelectItem>
                      <SelectItem value="after-5s">After 5 seconds</SelectItem>
                      <SelectItem value="scroll-50">On scroll (50%)</SelectItem>
                      <SelectItem value="exit-intent">On exit intent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="animation">Animation</Label>
                  <Select 
                    value={config.animation} 
                    onValueChange={(value) => handleConfigUpdate({ animation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slide-in">Slide-in</SelectItem>
                      <SelectItem value="fade-in">Fade-in</SelectItem>
                      <SelectItem value="zoom-in">Zoom-in</SelectItem>
                      <SelectItem value="bounce-in">Bounce-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showExitIntentIfNotSubscribed"
                    checked={config.showExitIntentIfNotSubscribed || false}
                    onCheckedChange={(checked) => 
                      handleConfigUpdate({ showExitIntentIfNotSubscribed: !!checked })
                    }
                    data-testid="checkbox-show-exit-intent-if-not-subscribed"
                  />
                  <Label htmlFor="showExitIntentIfNotSubscribed" className="text-sm">
                    Show popup on exit intent if user didn't subscribe initially
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="suppressAfterSubscription"
                    checked={config.suppressAfterSubscription}
                    onCheckedChange={(checked) => 
                      handleConfigUpdate({ suppressAfterSubscription: !!checked })
                    }
                    data-testid="checkbox-suppress-after-subscription"
                  />
                  <Label htmlFor="suppressAfterSubscription" className="text-sm">
                    Don't show again after subscription
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PopupPreview 
        config={config} 
        isFullscreen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
}
