import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Lock, RefreshCw, Store, Settings2, ChevronUp, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStoreContext } from "@/hooks/useStoreContext";

interface EmailSettings {
  id?: string;
  smtpHost: string;
  smtpPort: number;
  fromEmail: string;
  fromName: string;
  smtpUsername?: string;
  smtpPassword?: string;
  isConfigured: boolean;
}

interface UserPreferences {
  id?: string;
  adminNotificationEmail: string;
  enableAnalytics: boolean;
  sendWelcomeEmail: boolean;
  enableDoubleOptIn: boolean;
  validateDiscountCode: boolean;
  notifyOnSubscriptions: boolean;
  dailySubscriberSummary: boolean;
  alertOnUnsubscribeRate: boolean;
}

interface Store {
  id: string;
  name: string;
  shopifyUrl: string;
  shopifyStoreName?: string;
  customDomain?: string;
  shopifyAccessToken?: string;
  isConnected: boolean;
  isVerified: boolean;
}

export default function Settings() {
  const [emailForm, setEmailForm] = useState<EmailSettings>({
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    fromEmail: "updates@foxxbioprocess.com",
    fromName: "Foxx Bioprocess",
    isConfigured: false,
  });
  const [preferencesForm, setPreferencesForm] = useState<UserPreferences>({
    adminNotificationEmail: "admin@foxxbioprocess.com",
    enableAnalytics: true,
    sendWelcomeEmail: true,
    enableDoubleOptIn: false,
    validateDiscountCode: true,
    notifyOnSubscriptions: true,
    dailySubscriberSummary: false,
    alertOnUnsubscribeRate: true,
  });
  const [shopifyCollapsed, setShopifyCollapsed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [newToken, setNewToken] = useState('');
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [urlEditMode, setUrlEditMode] = useState<'myshopify' | 'domain'>('myshopify');
  
  // Helper to mask token display
  const maskToken = (token: string) => {
    if (!token || token.length < 8) return token;
    const first4 = token.substring(0, 4);
    const last4 = token.substring(token.length - 4);
    const middle = '•'.repeat(Math.max(8, token.length - 8));
    return `${first4}${middle}${last4}`;
  };
  
  // Helper to normalize Shopify URL
  const normalizeShopifyUrl = (url: string) => {
    if (!url) return url;
    
    // If it ends with .myshopify.com, it's a Shopify store - normalize it
    if (url.endsWith('.myshopify.com')) {
      // Remove any protocol and trailing slash, but keep the .myshopify.com format
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    
    // If it's just a store name (no dots), add .myshopify.com
    if (!url.includes('.')) {
      return `${url}.myshopify.com`;
    }
    
    // For custom domains, preserve the full URL with protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    return url.replace(/\/$/, ''); // Just remove trailing slash
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedStore } = useStoreContext();

  const { data: emailSettings, isLoading: emailLoading } = useQuery<EmailSettings>({
    queryKey: [`/api/stores/${selectedStore?.id}/email-settings`],
    enabled: !!selectedStore?.id,
  });

  const { data: userPreferences, isLoading: preferencesLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user-preferences"],
  });

  // Handle emailSettings data updates
  useEffect(() => {
    if (emailSettings) {
      setEmailForm(emailSettings);
      // Reset editing states when new data loads
      setEditingPassword(false);
      setTempPassword("");
      setShowPassword(false);
    }
  }, [emailSettings]);

  // Handle userPreferences data updates
  useEffect(() => {
    if (userPreferences) {
      setPreferencesForm(userPreferences);
    }
  }, [userPreferences]);

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  // Filter stores to only show the selected store
  const currentStore = stores.find(store => store.id === selectedStore?.id);

  const saveEmailMutation = useMutation({
    mutationFn: (data: EmailSettings) => {
      if (!selectedStore?.id) throw new Error("No store selected");
      return apiRequest(`/api/stores/${selectedStore.id}/email-settings`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${selectedStore?.id}/email-settings`] });
      toast({
        title: "Success",
        description: "Email settings saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save email settings",
        variant: "destructive",
      });
    },
  });

  const savePreferencesMutation = useMutation({
    mutationFn: (data: UserPreferences) => apiRequest("/api/user-preferences", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({
        title: "Success", 
        description: "Settings saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const verifyShopifyMutation = useMutation({
    mutationFn: ({ storeId, data }: { storeId: string; data: { shopifyUrl: string; accessToken: string } }) =>
      apiRequest(`/api/stores/${storeId}/shopify/verify`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({
        title: "Success",
        description: "Shopify connection verified successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to verify Shopify connection",
        variant: "destructive",
      });
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure temporary password is included in submission
    const formDataToSubmit = {
      ...emailForm,
      smtpPassword: editingPassword && tempPassword.trim() ? tempPassword : emailForm.smtpPassword
    };
    
    // Clear editing state
    if (editingPassword && tempPassword.trim()) {
      setEmailForm({ ...emailForm, smtpPassword: tempPassword });
      setEditingPassword(false);
      setTempPassword("");
    }
    
    saveEmailMutation.mutate(formDataToSubmit);
  };

  const handleSaveAllSettings = () => {
    savePreferencesMutation.mutate(preferencesForm);
  };

  const handleResetToDefaults = () => {
    setPreferencesForm({
      adminNotificationEmail: "admin@foxxbioprocess.com",
      enableAnalytics: true,
      sendWelcomeEmail: true,
      enableDoubleOptIn: false,
      validateDiscountCode: true,
      notifyOnSubscriptions: true,
      dailySubscriberSummary: false,
      alertOnUnsubscribeRate: true,
    });
  };

  const handleShopifyTest = (storeId: string, shopifyUrl: string, accessToken: string) => {
    verifyShopifyMutation.mutate({
      storeId,
      data: { shopifyUrl, accessToken: accessToken || "" },
    });
  };

  const updateTokenMutation = useMutation({
    mutationFn: ({ storeId, accessToken }: { storeId: string; accessToken: string }) => {
      // Never log or expose the full token
      const store = stores.find(s => s.id === storeId);
      return apiRequest(`/api/stores/${storeId}/shopify/connect`, {
        method: "POST",
        body: JSON.stringify({ 
          shopifyUrl: store?.shopifyUrl, 
          accessToken // This will be encrypted server-side
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setEditingToken(null);
      setNewToken('');
      toast({
        title: "Success",
        description: "Access token updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update access token",
        variant: "destructive",
      });
    },
  });

  
  const updateUrlMutation = useMutation({
    mutationFn: ({ storeId, shopifyStoreName, customDomain }: { storeId: string; shopifyStoreName?: string; customDomain?: string }) => {
      return apiRequest(`/api/stores/${storeId}/shopify/connect`, {
        method: "POST",
        body: JSON.stringify({ 
          shopifyStoreName: shopifyStoreName || null,
          customDomain: customDomain || null,
          accessToken: '' // Empty for URL-only updates to avoid Unicode token issues
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setEditingUrl(null);
      setEditingDomain(null); // Also clear custom domain editing state
      setNewUrl('');
      setNewDomain(''); // Also clear custom domain input
      toast({
        title: "Success",
        description: "Store URL updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update store URL",
        variant: "destructive",
      });
    },
  });
  
  const handleUrlEdit = (storeId: string, currentStoreName: string) => {
    setEditingUrl(storeId);
    // Strip .myshopify.com from the stored name for editing
    const storeName = currentStoreName ? currentStoreName.replace('.myshopify.com', '') : '';
    setNewUrl(storeName);
    setUrlEditMode('myshopify');
  };
  
  const handleDomainEdit = (storeId: string, currentDomain: string) => {
    setEditingDomain(storeId);
    setNewDomain(currentDomain || '');
    setUrlEditMode('domain');
  };
  
  const handleUrlSave = (storeId: string) => {
    if (newUrl.trim()) {
      updateUrlMutation.mutate({ storeId, shopifyStoreName: newUrl.trim() });
    }
  };
  
  const handleDomainSave = (storeId: string) => {
    if (newDomain.trim()) {
      updateUrlMutation.mutate({ storeId, customDomain: newDomain.trim() });
    }
  };
  
  const handleUrlCancel = () => {
    setEditingUrl(null);
    setEditingDomain(null);
    setNewUrl('');
    setNewDomain('');
  };
  
  const handleTokenEdit = (storeId: string) => {
    setEditingToken(storeId);
    setNewToken(''); // Never pre-populate with existing token for security
  };
  
  const handleTokenSave = (storeId: string) => {
    if (newToken.trim()) {
      // Clear the input immediately for security
      const tokenToSave = newToken.trim();
      setNewToken('');
      updateTokenMutation.mutate({ storeId, accessToken: tokenToSave });
    }
  };
  
  const handleTokenCancel = () => {
    setEditingToken(null);
    setNewToken('');
  };

  if (emailLoading || preferencesLoading) {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-semibold text-foreground">
          Settings {selectedStore ? `- ${selectedStore.name}` : ''}
        </h2>
        <div className="grid lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Settings {selectedStore ? `- ${selectedStore.name}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure your email and Shopify integration settings
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Email Configuration */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <Settings2 className="h-5 w-5 mr-2 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Email Configuration</h3>
            </div>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <Label htmlFor="smtpHost">SMTP Host</Label>
                <Input
                  id="smtpHost"
                  value={emailForm.smtpHost}
                  onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  data-testid="input-smtp-host"
                />
              </div>
              <div>
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={emailForm.smtpPort}
                  onChange={(e) => setEmailForm({ ...emailForm, smtpPort: Number(e.target.value) })}
                  placeholder="587"
                  data-testid="input-smtp-port"
                />
              </div>
              <div>
                <Label htmlFor="fromEmail">From Email</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={emailForm.fromEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                  placeholder="updates@foxxbioprocess.com"
                  data-testid="input-from-email"
                />
              </div>
              <div>
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={emailForm.fromName}
                  onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })}
                  placeholder="Foxx Bioprocess"
                  data-testid="input-from-name"
                />
              </div>
              <div>
                <Label htmlFor="smtpUsername">SMTP Username</Label>
                <Input
                  id="smtpUsername"
                  value={emailForm.smtpUsername || ""}
                  onChange={(e) => setEmailForm({ ...emailForm, smtpUsername: e.target.value })}
                  placeholder="your-email@gmail.com"
                  data-testid="input-smtp-username"
                />
              </div>
              <div>
                <Label htmlFor="smtpPassword">SMTP Password</Label>
                <div className="relative">
                  {!editingPassword && emailForm.isConfigured && !emailForm.smtpPassword ? (
                    // Show masked password with Edit option
                    <>
                      <Input
                        id="smtpPassword"
                        type="password"
                        value="••••••••••••"
                        readOnly
                        className="pr-16"
                        data-testid="input-smtp-password-masked"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => {
                          setEditingPassword(true);
                          setTempPassword(""); // Start with empty for new password entry
                        }}
                        data-testid="button-edit-password"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    // Show editable password field
                    <>
                      <Input
                        id="smtpPassword"
                        type={showPassword ? "text" : "password"}
                        value={editingPassword ? tempPassword : (emailForm.smtpPassword || "")}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          if (editingPassword) {
                            setTempPassword(newValue);
                          } else {
                            setEmailForm({ ...emailForm, smtpPassword: newValue });
                          }
                        }}
                        onBlur={() => {
                          if (editingPassword && tempPassword.trim()) {
                            setEmailForm({ ...emailForm, smtpPassword: tempPassword });
                            setEditingPassword(false);
                            setTempPassword("");
                          }
                        }}
                        placeholder="Your app password"
                        className="pr-20"
                        data-testid="input-smtp-password"
                      />
                      <div className="absolute right-0 top-0 h-full flex">
                        {editingPassword && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-full px-2 hover:bg-transparent"
                            onClick={() => {
                              if (tempPassword.trim()) {
                                setEmailForm({ ...emailForm, smtpPassword: tempPassword });
                                setEditingPassword(false);
                                setTempPassword("");
                              }
                            }}
                            data-testid="button-save-password"
                          >
                            ✓
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center">
                  <Lock className="h-4 w-4 mr-2 text-yellow-800" />
                  <p className="text-sm text-yellow-800">
                    SMTP credentials are encrypted and stored securely
                  </p>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={saveEmailMutation.isPending}
                data-testid="button-save-email"
              >
                {saveEmailMutation.isPending ? "Saving..." : "Save Email Settings"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Shopify Configuration */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Store className="h-5 w-5 mr-2 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Shopify Store Configuration</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShopifyCollapsed(!shopifyCollapsed)}
                className="text-primary hover:text-primary/80"
              >
                <ChevronUp className={`h-4 w-4 mr-1 transition-transform ${shopifyCollapsed ? 'rotate-180' : ''}`} />
                {shopifyCollapsed ? 'Expand' : 'Collapse'}
              </Button>
            </div>

            {!shopifyCollapsed && (
              <div className="space-y-4">
                {stores.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No stores configured</p>
                    <p className="text-sm">Add a store to configure Shopify integration</p>
                  </div>
                ) : !currentStore ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="status-no-store-selected">
                    <p>No store selected</p>
                    <p className="text-sm">Please select a store to configure.</p>
                  </div>
                ) : (
                  <div key={currentStore.id} className="space-y-4 border rounded-lg p-4">
                      <div className="space-y-4">
                        <div>
                          <Label>Store Name</Label>
                          <div className="flex items-center p-3 border border-border rounded-md bg-muted">
                            <Store className="h-4 w-4 mr-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{currentStore.name}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex gap-2 mb-3">
                            <Button
                              variant={urlEditMode === 'myshopify' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setUrlEditMode('myshopify')}
                              data-testid={`button-mode-myshopify-${currentStore.id}`}
                            >
                              .myshopify.com Format
                            </Button>
                            <Button
                              variant={urlEditMode === 'domain' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setUrlEditMode('domain')}
                              data-testid={`button-mode-domain-${currentStore.id}`}
                            >
                              Custom Domain
                            </Button>
                          </div>
                          
                          {urlEditMode === 'myshopify' ? (
                            <div>
                              <Label>Shopify Store Name (.myshopify.com)</Label>
                              {editingUrl === currentStore.id ? (
                                <div className="space-y-2">
                                  <Input
                                    type="text"
                                    value={newUrl}
                                    onChange={(e) => {
                                      const storeName = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
                                      setNewUrl(storeName);
                                    }}
                                    placeholder="your-store-name"
                                    className="flex-1"
                                    data-testid={`input-store-name-${currentStore.id}`}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Will become: {newUrl || 'your-store-name'}.myshopify.com
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleUrlSave(currentStore.id)}
                                      disabled={!newUrl.trim() || updateUrlMutation.isPending}
                                      data-testid={`button-save-store-name-${currentStore.id}`}
                                    >
                                      {updateUrlMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleUrlCancel}
                                      disabled={updateUrlMutation.isPending}
                                      data-testid={`button-cancel-store-name-${currentStore.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <Input
                                    value={currentStore.shopifyStoreName || ''}
                                    readOnly
                                    className="flex-1 bg-muted text-muted-foreground"
                                    placeholder="Not configured"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleUrlEdit(currentStore.id, currentStore.shopifyStoreName || '')}
                                    data-testid={`button-edit-store-name-${currentStore.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Enter your Shopify store name (e.g., "my-store" becomes "my-store.myshopify.com")
                              </p>
                            </div>
                          ) : (
                            <div>
                              <Label>Custom Domain URL</Label>
                              {editingDomain === currentStore.id ? (
                                <div className="space-y-2">
                                  <Input
                                    type="url"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    placeholder="https://shop.yourdomain.com"
                                    className="flex-1"
                                    data-testid={`input-domain-${currentStore.id}`}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Enter your custom Shopify domain with protocol
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleDomainSave(currentStore.id)}
                                      disabled={!newDomain.trim() || updateUrlMutation.isPending}
                                      data-testid={`button-save-domain-${currentStore.id}`}
                                    >
                                      {updateUrlMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleUrlCancel}
                                      disabled={updateUrlMutation.isPending}
                                      data-testid={`button-cancel-domain-${currentStore.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <Input
                                    value={currentStore.customDomain || ''}
                                    readOnly
                                    className="flex-1 bg-muted text-muted-foreground"
                                    placeholder="Not configured"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleDomainEdit(currentStore.id, currentStore.customDomain || '')}
                                    data-testid={`button-edit-domain-${currentStore.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                For custom domains (e.g., "https://shop.yourstore.com")
                              </p>
                            </div>
                          )}
                        </div>

                        <div>
                        <Label>Store Access Token</Label>
                        {editingToken === currentStore.id ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-2">
                              <div className="flex items-center">
                                <Lock className="h-4 w-4 mr-2 text-yellow-800" />
                                <p className="text-xs text-yellow-800">
                                  Enter your new access token. It will be encrypted and securely stored.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <Input
                                type="password"
                                value={newToken}
                                onChange={(e) => {
                                  // Sanitize input to remove Unicode characters that cause ByteString errors
                                  const sanitized = e.target.value.replace(/[^\x00-\x7F]/g, '');
                                  setNewToken(sanitized);
                                }}
                                placeholder="Enter new access token (will be encrypted)"
                                className="flex-1"
                                data-testid={`input-new-token-${currentStore.id}`}
                                autoComplete="new-password"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleTokenSave(currentStore.id)}
                                disabled={!newToken.trim() || updateTokenMutation.isPending}
                                data-testid={`button-save-token-${currentStore.id}`}
                              >
                                {updateTokenMutation.isPending ? 'Encrypting & Saving...' : 'Save & Encrypt'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTokenCancel}
                                disabled={updateTokenMutation.isPending}
                                data-testid={`button-cancel-token-${currentStore.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Input
                              type="password"
                              value={currentStore.shopifyAccessToken ? maskToken(currentStore.shopifyAccessToken) : ''}
                              readOnly
                              className="flex-1 bg-muted text-muted-foreground"
                              placeholder="No token configured"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2"
                              onClick={() => handleTokenEdit(currentStore.id)}
                              data-testid={`button-edit-token-${currentStore.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Private app access token with inventory permissions
                        </p>
                      </div>

                      <div className={`flex items-center justify-between p-4 border rounded-md ${
                        currentStore.isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 ${
                            currentStore.isConnected ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className={`text-sm font-medium ${
                            currentStore.isConnected ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {currentStore.isConnected ? 'Connected' : 'Not Connected'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShopifyTest(currentStore.id, currentStore.shopifyUrl, currentStore.shopifyAccessToken || '')}
                          disabled={verifyShopifyMutation.isPending}
                          className={currentStore.isConnected ? 'text-green-700 hover:text-green-900' : 'text-red-700 hover:text-red-900'}
                          data-testid={`button-test-connection-${currentStore.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${verifyShopifyMutation.isPending ? 'animate-spin' : ''}`} />
                          Test Connection
                        </Button>
                        </div>
                      </div>
                    </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">General Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="analytics" 
                  checked={preferencesForm.enableAnalytics}
                  onCheckedChange={(checked) => setPreferencesForm({ ...preferencesForm, enableAnalytics: !!checked })}
                  data-testid="checkbox-analytics" 
                />
                <Label htmlFor="analytics" className="text-sm">
                  Enable popup analytics tracking
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="welcome-email" 
                  checked={preferencesForm.sendWelcomeEmail}
                  onCheckedChange={(checked) => setPreferencesForm({ ...preferencesForm, sendWelcomeEmail: !!checked })}
                  data-testid="checkbox-welcome-email" 
                />
                <Label htmlFor="welcome-email" className="text-sm">
                  Send welcome email after subscription
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="double-optin" 
                  checked={preferencesForm.enableDoubleOptIn}
                  onCheckedChange={(checked) => setPreferencesForm({ ...preferencesForm, enableDoubleOptIn: !!checked })}
                  data-testid="checkbox-double-optin" 
                />
                <Label htmlFor="double-optin" className="text-sm">
                  Enable double opt-in confirmation
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="validate-discount" 
                  checked={preferencesForm.validateDiscountCode}
                  onCheckedChange={(checked) => setPreferencesForm({ ...preferencesForm, validateDiscountCode: !!checked })}
                  data-testid="checkbox-validate-discount" 
                />
                <Label htmlFor="validate-discount" className="text-sm">
                  Validate discount code usage via Shopify API
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Notification Settings</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="adminEmail">Admin Notification Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={preferencesForm.adminNotificationEmail}
                  onChange={(e) => setPreferencesForm({ ...preferencesForm, adminNotificationEmail: e.target.value })}
                  data-testid="input-admin-email"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="notify-subscriptions" 
                  checked={preferencesForm.notifyOnSubscriptions}
                  onCheckedChange={(checked) => setPreferencesForm({ ...preferencesForm, notifyOnSubscriptions: !!checked })}
                  data-testid="checkbox-notify-subscriptions" 
                />
                <Label htmlFor="notify-subscriptions" className="text-sm">
                  Notify on new subscriptions
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="daily-summary" 
                  checked={preferencesForm.dailySubscriberSummary}
                  onCheckedChange={(checked) => setPreferencesForm({ ...preferencesForm, dailySubscriberSummary: !!checked })}
                  data-testid="checkbox-daily-summary" 
                />
                <Label htmlFor="daily-summary" className="text-sm">
                  Daily subscriber summary
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="unsubscribe-alert" 
                  checked={preferencesForm.alertOnUnsubscribeRate}
                  onCheckedChange={(checked) => setPreferencesForm({ ...preferencesForm, alertOnUnsubscribeRate: !!checked })}
                  data-testid="checkbox-unsubscribe-alert" 
                />
                <Label htmlFor="unsubscribe-alert" className="text-sm">
                  Alert on high unsubscribe rate
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex justify-end space-x-3 pt-6">
        <Button
          variant="outline"
          onClick={handleResetToDefaults}
          disabled={savePreferencesMutation.isPending}
          data-testid="button-reset-defaults"
        >
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSaveAllSettings}
          disabled={savePreferencesMutation.isPending}
          data-testid="button-save-settings"
        >
          {savePreferencesMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
