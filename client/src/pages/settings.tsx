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

interface Store {
  id: string;
  name: string;
  shopifyUrl: string;
  shopifyAccessToken?: string;
  isConnected: boolean;
  isVerified: boolean;
}

export default function Settings() {
  const [emailForm, setEmailForm] = useState<EmailSettings>({
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    fromEmail: "updates@foxxbioprocess.com",
    fromName: "Foxx Bioprocess",
    isConfigured: false,
  });
  const [shopifyCollapsed, setShopifyCollapsed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    
    // If it's just a store name (no dots), add .myshopify.com
    if (!url.includes('.')) {
      return `${url}.myshopify.com`;
    }
    
    // If it's a .myshopify.com URL, normalize it (remove protocol, ensure .myshopify.com)
    if (url.includes('.myshopify.com') || (!url.includes('http') && !url.includes('://'))) {
      url = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!url.endsWith('.myshopify.com') && !url.includes('.')) {
        url = `${url}.myshopify.com`;
      }
      return url;
    }
    
    // For custom domains, preserve the full URL with protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    return url.replace(/\/$/, ''); // Just remove trailing slash
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: emailSettings, isLoading: emailLoading } = useQuery<EmailSettings>({
    queryKey: ["/api/email-settings"],
  });

  // Handle emailSettings data updates
  useEffect(() => {
    if (emailSettings) {
      setEmailForm(emailSettings);
    }
  }, [emailSettings]);

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  const saveEmailMutation = useMutation({
    mutationFn: (data: EmailSettings) => apiRequest("/api/email-settings", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
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
    saveEmailMutation.mutate(emailForm);
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
    mutationFn: ({ storeId, shopifyUrl }: { storeId: string; shopifyUrl: string }) => {
      return apiRequest(`/api/stores/${storeId}/shopify/connect`, {
        method: "POST",
        body: JSON.stringify({ 
          shopifyUrl: normalizeShopifyUrl(shopifyUrl), 
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
  
  const handleUrlEdit = (storeId: string, currentUrl: string) => {
    setEditingUrl(storeId);
    // Only populate if it's actually a .myshopify.com URL
    if (currentUrl?.endsWith('.myshopify.com')) {
      setNewUrl(currentUrl.replace('.myshopify.com', '').replace('https://', '').replace('http://', ''));
    } else {
      setNewUrl(''); // Empty for non-.myshopify.com URLs
    }
    setUrlEditMode('myshopify');
  };
  
  const handleDomainEdit = (storeId: string, currentUrl: string) => {
    setEditingDomain(storeId);
    // Only populate if it's NOT a .myshopify.com URL
    if (currentUrl?.endsWith('.myshopify.com')) {
      setNewDomain(''); // Empty for .myshopify.com URLs
    } else {
      setNewDomain(currentUrl || '');
    }
    setUrlEditMode('domain');
  };
  
  const handleUrlSave = (storeId: string) => {
    if (newUrl.trim()) {
      const finalUrl = `${newUrl.trim()}.myshopify.com`;
      updateUrlMutation.mutate({ storeId, shopifyUrl: finalUrl });
    }
  };
  
  const handleDomainSave = (storeId: string) => {
    if (newDomain.trim()) {
      updateUrlMutation.mutate({ storeId, shopifyUrl: newDomain.trim() });
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

  if (emailLoading) {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
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
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
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
                  <Input
                    id="smtpPassword"
                    type={showPassword ? "text" : "password"}
                    value={emailForm.smtpPassword || ""}
                    onChange={(e) => setEmailForm({ ...emailForm, smtpPassword: e.target.value })}
                    placeholder="Your app password"
                    data-testid="input-smtp-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
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
                ) : (
                  stores.map((store) => (
                    <div key={store.id} className="space-y-4 border rounded-lg p-4">
                      <div className="space-y-4">
                        <div>
                          <Label>Store Name</Label>
                          <div className="flex items-center p-3 border border-border rounded-md bg-muted">
                            <Store className="h-4 w-4 mr-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{store.name}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex gap-2 mb-3">
                            <Button
                              variant={urlEditMode === 'myshopify' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setUrlEditMode('myshopify')}
                              data-testid={`button-mode-myshopify-${store.id}`}
                            >
                              .myshopify.com Format
                            </Button>
                            <Button
                              variant={urlEditMode === 'domain' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setUrlEditMode('domain')}
                              data-testid={`button-mode-domain-${store.id}`}
                            >
                              Custom Domain
                            </Button>
                          </div>
                          
                          {urlEditMode === 'myshopify' ? (
                            <div>
                              <Label>Shopify Store Name (.myshopify.com)</Label>
                              {editingUrl === store.id ? (
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
                                    data-testid={`input-store-name-${store.id}`}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Will become: {newUrl || 'your-store-name'}.myshopify.com
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleUrlSave(store.id)}
                                      disabled={!newUrl.trim() || updateUrlMutation.isPending}
                                      data-testid={`button-save-store-name-${store.id}`}
                                    >
                                      {updateUrlMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleUrlCancel}
                                      disabled={updateUrlMutation.isPending}
                                      data-testid={`button-cancel-store-name-${store.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <Input
                                    value={store.shopifyUrl?.endsWith('.myshopify.com') 
                                      ? store.shopifyUrl.replace('.myshopify.com', '').replace('https://', '').replace('http://', '')
                                      : ''}
                                    readOnly
                                    className="flex-1 bg-muted text-muted-foreground"
                                    placeholder="Not configured"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleUrlEdit(store.id, store.shopifyUrl || '')}
                                    data-testid={`button-edit-store-name-${store.id}`}
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
                              {editingDomain === store.id ? (
                                <div className="space-y-2">
                                  <Input
                                    type="url"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    placeholder="https://shop.yourdomain.com"
                                    className="flex-1"
                                    data-testid={`input-domain-${store.id}`}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Enter your custom Shopify domain with protocol
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleDomainSave(store.id)}
                                      disabled={!newDomain.trim() || updateUrlMutation.isPending}
                                      data-testid={`button-save-domain-${store.id}`}
                                    >
                                      {updateUrlMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleUrlCancel}
                                      disabled={updateUrlMutation.isPending}
                                      data-testid={`button-cancel-domain-${store.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <Input
                                    value={store.shopifyUrl?.endsWith('.myshopify.com') 
                                      ? '' // Don't show .myshopify.com URLs in custom domain field
                                      : store.shopifyUrl || ''}
                                    readOnly
                                    className="flex-1 bg-muted text-muted-foreground"
                                    placeholder="Not configured"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleDomainEdit(store.id, store.shopifyUrl || '')}
                                    data-testid={`button-edit-domain-${store.id}`}
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
                        {editingToken === store.id ? (
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
                                data-testid={`input-new-token-${store.id}`}
                                autoComplete="new-password"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleTokenSave(store.id)}
                                disabled={!newToken.trim() || updateTokenMutation.isPending}
                                data-testid={`button-save-token-${store.id}`}
                              >
                                {updateTokenMutation.isPending ? 'Encrypting & Saving...' : 'Save & Encrypt'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTokenCancel}
                                disabled={updateTokenMutation.isPending}
                                data-testid={`button-cancel-token-${store.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Input
                              type="password"
                              value={store.shopifyAccessToken ? maskToken(store.shopifyAccessToken) : ''}
                              readOnly
                              className="flex-1 bg-muted text-muted-foreground"
                              placeholder="No token configured"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2"
                              onClick={() => handleTokenEdit(store.id)}
                              data-testid={`button-edit-token-${store.id}`}
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
                        store.isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 ${
                            store.isConnected ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className={`text-sm font-medium ${
                            store.isConnected ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {store.isConnected ? 'Connected' : 'Not Connected'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShopifyTest(store.id, store.shopifyUrl, store.shopifyAccessToken || '')}
                          disabled={verifyShopifyMutation.isPending}
                          className={store.isConnected ? 'text-green-700 hover:text-green-900' : 'text-red-700 hover:text-red-900'}
                          data-testid={`button-test-connection-${store.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${verifyShopifyMutation.isPending ? 'animate-spin' : ''}`} />
                          Test Connection
                        </Button>
                        </div>
                      </div>
                    </div>
                  ))
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
                <Checkbox id="analytics" defaultChecked data-testid="checkbox-analytics" />
                <Label htmlFor="analytics" className="text-sm">
                  Enable popup analytics tracking
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="welcome-email" defaultChecked data-testid="checkbox-welcome-email" />
                <Label htmlFor="welcome-email" className="text-sm">
                  Send welcome email after subscription
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="double-optin" data-testid="checkbox-double-optin" />
                <Label htmlFor="double-optin" className="text-sm">
                  Enable double opt-in confirmation
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="validate-discount" defaultChecked data-testid="checkbox-validate-discount" />
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
                  defaultValue="admin@foxxbioprocess.com"
                  data-testid="input-admin-email"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="notify-subscriptions" defaultChecked data-testid="checkbox-notify-subscriptions" />
                <Label htmlFor="notify-subscriptions" className="text-sm">
                  Notify on new subscriptions
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="daily-summary" data-testid="checkbox-daily-summary" />
                <Label htmlFor="daily-summary" className="text-sm">
                  Daily subscriber summary
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="unsubscribe-alert" defaultChecked data-testid="checkbox-unsubscribe-alert" />
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
          data-testid="button-reset-defaults"
        >
          Reset to Defaults
        </Button>
        <Button
          data-testid="button-save-settings"
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}
