import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Upload, Code, ArrowRight, Copy, Download, Check, Plus, ChevronDown, User, Shield, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import foxxLogo from "@/assets/foxx-logo.png";

interface StoreFormData {
  name: string;
  shopifyUrl: string;
  shopifyStoreName?: string;
  customDomain?: string;
  shopifyAccessToken?: string;
  integrationType: string;
}

function OnboardingHeader({ existingStores }: { existingStores: Array<{id: string, name: string}> }) {
  const { user, logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const userInitials = user.email.substring(0, 2).toUpperCase();

  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="onboarding-header">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img 
            src={foxxLogo} 
            alt="Foxx Bioprocess Logo" 
            className="h-8 w-auto"
          />
          
          <Select defaultValue="add-new" onValueChange={(value) => {
            if (value === 'add-new') {
              // Stay on onboarding page
              return;
            } else {
              // Navigate to selected store's dashboard
              setLocation(`/store/${value}/dashboard`);
            }
          }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-xs text-muted-foreground">
                filter by name...
              </div>
              {existingStores.map((store: {id: string, name: string}) => (
                <SelectItem key={store.id} value={store.id}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    {store.name}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="add-new">
                <div className="flex items-center text-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Site
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-user-menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none" data-testid="user-email">
                  {user.email}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs" data-testid="user-role">
                    {user.role === 'admin' ? (
                      <><Shield className="w-3 h-3 mr-1" />Admin</>
                    ) : (
                      <><User className="w-3 h-3 mr-1" />Member</>
                    )}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              disabled={isLoggingOut}
              data-testid="logout-button"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoggingOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<StoreFormData>({
    name: "",
    shopifyUrl: "",
    integrationType: "shopify"
  });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [isScriptCopied, setIsScriptCopied] = useState(false);
  const [urlEditMode, setUrlEditMode] = useState<'myshopify' | 'domain'>('myshopify');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for existing stores
  const { data: existingStores = [] } = useQuery<Array<{id: string, name: string}>>({    
    queryKey: ["/api/stores"],
  });

  // Always show header in onboarding
  const shouldShowHeader = true;
  const displayStores = existingStores.length > 0 ? existingStores : [];

  // Helper to normalize URLs like in Settings page
  const normalizeUrl = (url: string, isCustomDomain: boolean = false) => {
    if (!url) return url;
    
    if (isCustomDomain) {
      // For custom domains, ensure https protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      return url.replace(/\/$/, ''); // Remove trailing slash
    } else {
      // For Shopify store names, just clean and add .myshopify.com
      const cleanName = url.replace(/[^a-zA-Z0-9-]/g, '');
      return `${cleanName}.myshopify.com`;
    }
  };

  const createStoreMutation = useMutation({
    mutationFn: (data: StoreFormData) => {
      // Prepare the store data based on the URL mode and integration type
      let normalizedShopifyUrl = data.shopifyUrl;
      let normalizedCustomDomain = data.customDomain;
      let normalizedShopifyStoreName = data.shopifyStoreName;
      
      if (data.integrationType === "shopify") {
        if (data.shopifyStoreName) {
          normalizedShopifyStoreName = data.shopifyStoreName.replace(/[^a-zA-Z0-9-]/g, '');
          normalizedShopifyUrl = normalizeUrl(normalizedShopifyStoreName, false);
        } else if (data.customDomain) {
          normalizedCustomDomain = normalizeUrl(data.customDomain, true);
          normalizedShopifyUrl = normalizedCustomDomain;
        }
      }
      
      const storeData = {
        name: data.name,
        shopifyAccessToken: data.shopifyAccessToken,
        shopifyStoreName: normalizedShopifyStoreName,
        customDomain: normalizedCustomDomain,
        shopifyUrl: normalizedShopifyUrl
      };
      
      return apiRequest("/api/stores", { method: "POST", body: JSON.stringify(storeData) });
    },
    onSuccess: async (store) => {
      // Invalidate and refetch the stores query to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      await queryClient.refetchQueries({ queryKey: ["/api/stores"] });
      // Generate the script for the created store
      const script = generateScript(store.id);
      setGeneratedScript(script);
      setStep(3);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add store",
        variant: "destructive",
      });
    },
  });

  const generateScript = (storeId: string) => {
    if (formData.integrationType === 'shopify') {
      return `<!-- Newsletter Popup Script for ${formData.name} -->
<script>
(function() {
  var script = document.createElement('script');
  script.src = '${window.location.origin}/js/newsletter-popup.js';
  script.async = true;
  script.setAttribute('data-store-id', '${storeId}');
  script.setAttribute('data-popup-config', 'auto');
  script.setAttribute('data-integration-type', 'shopify');
  document.head.appendChild(script);
})();
</script>`;
    } else {
      return `<!-- Newsletter Popup Script for ${formData.name} -->
<script>
(function() {
  var script = document.createElement('script');
  script.src = '${window.location.origin}/js/newsletter-popup.js';
  script.async = true;
  script.setAttribute('data-store-id', '${storeId}');
  script.setAttribute('data-popup-config', 'auto');
  script.setAttribute('data-integration-type', 'website');
  document.head.appendChild(script);
})();
</script>`;
    }
  };

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      // Check validation based on integration type
      let hasValidUrl = false;
      
      if (formData.integrationType === "shopify") {
        // For Shopify, check if either shopifyStoreName or customDomain is provided based on selected mode
        hasValidUrl = urlEditMode === 'myshopify' 
          ? !!formData.shopifyStoreName?.trim()
          : !!formData.customDomain?.trim();
      } else {
        // For typical websites, check if shopifyUrl is provided
        hasValidUrl = !!formData.shopifyUrl?.trim();
      }
        
      if (!formData.name || !hasValidUrl || !formData.integrationType) {
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
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      // Verification complete, ensure stores are loaded then go to dashboard
      await queryClient.refetchQueries({ queryKey: ["/api/stores"] });
      setLocation('/dashboard');
    }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setIsScriptCopied(true);
    toast({
      title: "Copied!",
      description: "Script copied to clipboard",
    });
    setTimeout(() => setIsScriptCopied(false), 2000);
  };

  const integrationTypes = [
    { 
      id: "typical", 
      name: "Typical Site", 
      icon: Code, 
      description: "For general websites and custom sites"
    },
    { 
      id: "shopify", 
      name: "Shopify", 
      icon: Code, 
      description: "For Shopify online stores"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {shouldShowHeader && <OnboardingHeader existingStores={displayStores} />}
      <div className="flex items-center justify-center p-4" style={{minHeight: shouldShowHeader ? 'calc(100vh - 80px)' : '100vh'}}>
      <div className="w-full max-w-4xl">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[
            { step: 1, title: "Add Your Site" },
            { step: 2, title: "Integrate Newsletter" },
            { step: 3, title: "Install Script" },
            { step: 4, title: "Verify Installation" }
          ].map((item, index) => (
            <div key={item.step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= item.step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {item.step}
              </div>
              <span className={`ml-3 text-sm font-medium ${
                step >= item.step ? "text-foreground" : "text-muted-foreground"
              }`}>
                {item.title}
              </span>
              {index < 3 && <div className="w-16 h-px bg-border mx-4"></div>}
            </div>
          ))}
        </div>

        <Card className="w-full">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-semibold mb-2">Add Your Site</h2>
                  <p className="text-muted-foreground">Let's get started by adding your website details</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {/* Icon Upload */}
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-24 h-24 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center bg-muted/50">
                        {iconPreview ? (
                          <img src={iconPreview} alt="Site icon" className="w-20 h-20 object-cover rounded" />
                        ) : (
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-sm mb-1">UPLOAD ICON</h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          Recommended 192px x 192px<br />
                          Must be square in size
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('icon-upload')?.click()}
                          className="bg-green-500 hover:bg-green-600 text-white border-green-500"
                        >
                          Choose File
                        </Button>
                        <input
                          id="icon-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleIconUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Integration Type Selection */}
                    <div>
                      <Label className="text-base font-medium mb-4 block">Select Integration Type:</Label>
                      <div className="grid grid-cols-2 gap-4">
                        {integrationTypes.map((type) => (
                          <Card
                            key={type.id}
                            className={`cursor-pointer transition-all ${
                              formData.integrationType === type.id
                                ? "ring-2 ring-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => setFormData({ ...formData, integrationType: type.id })}
                          >
                            <CardContent className="p-4 text-center">
                              <Code className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                              <h3 className="font-medium text-sm">{type.name}</h3>
                              <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Site Details */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="siteName">Site Name:</Label>
                        <Input
                          id="siteName"
                          placeholder="Enter a name to remember your website by..."
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      {formData.integrationType === "shopify" && (
                        <div className="space-y-4">
                          <div className="flex gap-2 mb-3">
                            <Button
                              type="button"
                              variant={urlEditMode === 'myshopify' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setUrlEditMode('myshopify')}
                              data-testid="button-mode-myshopify"
                            >
                              .myshopify.com Format
                            </Button>
                            <Button
                              type="button"
                              variant={urlEditMode === 'domain' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setUrlEditMode('domain')}
                              data-testid="button-mode-domain"
                            >
                              Custom Domain
                            </Button>
                          </div>

                          {urlEditMode === 'myshopify' ? (
                            <div>
                              <Label htmlFor="shopifyStoreName">Shopify Store Name (.myshopify.com)</Label>
                              <Input
                                id="shopifyStoreName"
                                placeholder="your-store-name"
                                value={formData.shopifyStoreName || ""}
                                onChange={(e) => {
                                  const storeName = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
                                  setFormData({ ...formData, shopifyStoreName: storeName, customDomain: undefined });
                                }}
                                data-testid="input-shopify-store-name"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Enter your Shopify store name (e.g., "my-store" becomes "my-store.myshopify.com")
                              </p>
                            </div>
                          ) : (
                            <div>
                              <Label htmlFor="customDomain">Custom Domain</Label>
                              <Input
                                id="customDomain"
                                placeholder="https://shop.yourstore.com"
                                value={formData.customDomain || ""}
                                onChange={(e) => {
                                  setFormData({ ...formData, customDomain: e.target.value, shopifyStoreName: undefined });
                                }}
                                data-testid="input-custom-domain"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                For custom domains (e.g., "https://shop.yourstore.com")
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {formData.integrationType === "typical" && (
                        <div>
                          <Label htmlFor="siteUrl">
                            URL: <span className="text-xs text-muted-foreground">(Enter full site url. Example: http://www.sitename.com)</span>
                          </Label>
                          <Input
                            id="siteUrl"
                            placeholder="enter your website url here..."
                            value={formData.shopifyUrl}
                            onChange={(e) => setFormData({ ...formData, shopifyUrl: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <Button onClick={handleNext} className="px-8">
                    Next Step <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-semibold mb-2">Integrate Newsletter</h2>
                  <p className="text-muted-foreground">Configure your newsletter settings</p>
                </div>

                {formData.integrationType === "shopify" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="shopifyToken">Shopify Access Token (Optional):</Label>
                      <Input
                        id="shopifyToken"
                        type="password"
                        placeholder="Enter your Shopify access token for advanced features..."
                        value={formData.shopifyAccessToken || ""}
                        onChange={(e) => setFormData({ ...formData, shopifyAccessToken: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required for discount code integration and advanced Shopify features
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    We'll create a newsletter popup script customized for your {formData.integrationType === 'shopify' ? 'Shopify' : 'website'}.
                  </p>
                </div>

                <div className="flex justify-between pt-6">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={handleNext} disabled={createStoreMutation.isPending}>
                    {createStoreMutation.isPending ? "Creating..." : "Create Integration"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-semibold mb-2">Install Script</h2>
                  <p className="text-muted-foreground">
                    {formData.integrationType === 'shopify' 
                      ? 'Add this script to your Shopify theme.liquid file in the <head> section'
                      : 'Add this script to your website\'s head section'
                    }
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">
                      {formData.integrationType === 'shopify' ? 'Copy and paste this script into your theme.liquid' : 'Step 1: Copy Script'}
                    </Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      {formData.integrationType === 'shopify' 
                        ? 'Go to Online Store → Themes → Actions → Edit Code → Layout → theme.liquid. Paste this script in the <head> section.'
                        : 'Copy this script and add it to the header of your site just before the end of the head tag.'
                      }
                    </p>
                    <div className="relative">
                      <textarea
                        readOnly
                        value={generatedScript}
                        className="w-full h-32 p-3 text-sm font-mono bg-muted border rounded-md resize-none"
                      />
                      <Button
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={copyScript}
                      >
                        {isScriptCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {isScriptCopied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-medium">
                      {formData.integrationType === 'shopify' ? 'Save your theme changes' : 'Step 2: Verify Installation'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {formData.integrationType === 'shopify' 
                        ? 'After adding the script to your theme.liquid file, save the changes and click "Next Step" to verify the installation.'
                        : 'After adding the script to your website, click "Next Step" to verify the installation.'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex justify-between pt-6">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button onClick={handleNext}>
                    Next Step <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-semibold mb-2">Verify Installation</h2>
                  <p className="text-muted-foreground">
                    Welcome to {formData.integrationType === 'shopify' ? 'Shopify Integration' : 'Website Integration'}!
                  </p>
                </div>

                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                    <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-green-800 mb-2">
                      Welcome to {formData.integrationType === 'shopify' ? 'Shopify' : 'Website Integration'}!
                    </h3>
                    <p className="text-green-700">
                      If you've installed it correctly, your website should now prompt visitors to subscribe. 
                      If you don't see an optin prompt on your site, contact us for help.
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>✓ Script is ready for deployment</p>
                    <p>✓ Newsletter popup is configured</p>
                    <p>✓ Ready to collect subscribers</p>
                  </div>
                </div>

                <div className="flex justify-center pt-6">
                  <Button onClick={handleNext} size="lg">
                    Continue To Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}