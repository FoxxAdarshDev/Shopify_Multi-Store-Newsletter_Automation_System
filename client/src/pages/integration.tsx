import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, CheckCircle, Code, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Store {
  id: string;
  name: string;
  isVerified: boolean;
  shopifyUrl?: string;
}

export default function Integration() {
  const { storeId } = useParams<{ storeId: string }>();
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [copiedScript, setCopiedScript] = useState(false);
  const { toast } = useToast();

  // Auto-select current store from URL
  useEffect(() => {
    if (storeId) {
      setSelectedStoreId(storeId);
    }
  }, [storeId]);

  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  // Get current store info
  const currentStore = stores.find(store => store.id === selectedStoreId);

  const { data: integrationScript } = useQuery<string>({
    queryKey: [`integration-script-${selectedStoreId}`],
    queryFn: () => selectedStoreId ? apiRequest(`/api/stores/${selectedStoreId}/integration-script`) : Promise.reject('No store selected'),
    enabled: !!selectedStoreId,
  });

  const { data: installationStatus } = useQuery({
    queryKey: [`/api/stores/${selectedStoreId}/verify-installation`],
    enabled: !!selectedStoreId,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handleDownloadFile = async () => {
    if (!selectedStoreId) return;
    
    try {
      const response = await fetch(`/api/stores/${selectedStoreId}/download-file`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'webpushr-sw.js';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Service worker file downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const handleVerifyInstallation = async () => {
    if (!selectedStoreId) return;
    
    try {
      const response = await fetch(`/api/stores/${selectedStoreId}/verify-installation`);
      const result = await response.json();
      
      if (result.installed) {
        toast({
          title: "Success", 
          description: "Newsletter script is properly installed!",
        });
      } else {
        toast({
          title: "Warning",
          description: result.message || "Script not detected on your site",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify installation",
        variant: "destructive",
      });
    }
  };

  const handleCopyScript = async () => {
    if (!integrationScript) return;
    
    try {
      await navigator.clipboard.writeText(integrationScript);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
      
      toast({
        title: "Success",
        description: "Integration script copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy script to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateScript = async () => {
    if (!selectedStoreId) return;
    
    try {
      // Force refetch by invalidating the query
      queryClient.invalidateQueries({ 
        queryKey: [`integration-script-${selectedStoreId}`] 
      });
      
      toast({
        title: "Success",
        description: "Integration script regenerated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to regenerate script",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="integration-page">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Integration Setup</h2>
          <p className="text-sm text-muted-foreground">
            Set up newsletter popup integration for your Shopify store
          </p>
        </div>
        <div className="flex space-x-2">
          <div className="flex items-center bg-muted px-3 py-2 rounded-md">
            <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {currentStore?.name || 'Loading store...'}
            </span>
          </div>
          <Button 
            onClick={handleVerifyInstallation}
            disabled={!selectedStoreId}
            variant="outline"
            data-testid="button-verify-install"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Verify Installation
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <span className="ml-3 text-sm font-medium text-foreground">Add Your Site</span>
            </div>
            <div className="flex-1 mx-4 h-px bg-border"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <span className="ml-3 text-sm font-medium text-foreground">Integrate Newsletter</span>
            </div>
            <div className="flex-1 mx-4 h-px bg-border"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="ml-3 text-sm text-muted-foreground">Verify Installation</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Step 1: Upload File */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Step 1: Upload File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Download this file, unzip it and copy it to the root directory of your website. 
              Please do not proceed forward until it is accessible on this link:
            </p>
            <div className="mb-4">
              <code className="text-sm text-primary bg-primary/10 px-2 py-1 rounded">
                {currentStore ? `https://${new URL(currentStore.shopifyUrl || 'https://yourdomain.com').hostname}/webpushr-sw.js` : 'https://yourdomain.com/webpushr-sw.js'}
              </code>
            </div>
            <Button 
              onClick={handleDownloadFile} 
              className="w-full"
              data-testid="button-download-step1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download File
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Add Code */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Step 2: Add Code</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add this code to the bottom of your site just before the end of the body tag.
            </p>
            
            {selectedStoreId ? (
              <>
                <div className="bg-muted p-4 rounded-md mb-4 max-h-32 overflow-y-auto">
                  <code className="text-xs text-foreground break-all whitespace-pre-wrap">
                    {integrationScript ? (
                      `<script>\n${integrationScript}\n</script>`
                    ) : (
                      "Loading integration script..."
                    )}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCopyScript} 
                    variant="outline" 
                    className="flex-1"
                    disabled={!integrationScript}
                    data-testid="button-copy-script"
                  >
                    {copiedScript ? (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copiedScript ? "Copied!" : "Copy to Clipboard"}
                  </Button>
                  <Button 
                    onClick={handleRegenerateScript} 
                    variant="outline" 
                    disabled={!selectedStoreId}
                    data-testid="button-regenerate-script"
                  >
                    ↻
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-muted p-4 rounded-md mb-4 text-center">
                <Code className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select a store to generate the integration script
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Step 3: Verification */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Step 3: Verify Installation</h3>
          
          {selectedStoreId && stores.find(s => s.id === selectedStoreId)?.isVerified ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Welcome to Newsletter Manager!
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                If you've installed it correctly, your website should now prompt visitors to subscribe. 
                If you don't see an optin prompt on your site, contact us for help.
              </p>
              <Button 
                className="bg-primary text-primary-foreground"
                data-testid="button-continue-dashboard"
              >
                Continue To Dashboard
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Code className="h-8 w-8 text-yellow-600" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Installation Pending
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Complete steps 1 and 2 above, then we'll automatically verify your installation.
              </p>
              <Button 
                variant="outline"
                data-testid="button-check-installation"
              >
                Check Installation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
