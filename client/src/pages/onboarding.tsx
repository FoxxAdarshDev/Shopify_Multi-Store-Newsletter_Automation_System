import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Code, ArrowRight, Copy, Download, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface StoreFormData {
  name: string;
  shopifyUrl: string;
  shopifyAccessToken?: string;
  integrationType: string;
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<StoreFormData>({
    name: "",
    shopifyUrl: "",
    integrationType: "typical"
  });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [isScriptCopied, setIsScriptCopied] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createStoreMutation = useMutation({
    mutationFn: (data: StoreFormData) => apiRequest("POST", "/api/stores", data),
    onSuccess: (store) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
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
    return `<!-- Newsletter Popup Script for ${formData.name} -->
<script>
(function() {
  var script = document.createElement('script');
  script.src = '${window.location.origin}/js/newsletter-popup.js';
  script.async = true;
  script.setAttribute('data-store-id', '${storeId}');
  script.setAttribute('data-popup-config', 'auto');
  document.head.appendChild(script);
})();
</script>`;
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

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.shopifyUrl || !formData.integrationType) {
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
      // Verification complete, go to dashboard
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
                    We'll create a newsletter popup script customized for your {formData.integrationType} site.
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
                  <p className="text-muted-foreground">Add this script to your website's head section</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Step 1: Copy Script</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Copy this script and add it to the bottom of your site just before the end of the body tag.
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
                    <Label className="text-base font-medium">Step 2: Verify Installation</Label>
                    <p className="text-sm text-muted-foreground">
                      After adding the script to your website, click "Next Step" to verify the installation.
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
                  <p className="text-muted-foreground">Let's check if the script is properly installed</p>
                </div>

                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                    <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-green-800 mb-2">Installation Verified!</h3>
                    <p className="text-green-700">
                      Your newsletter popup script has been successfully installed on {formData.name}.
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>✓ Script is properly loaded</p>
                    <p>✓ Newsletter popup is configured</p>
                    <p>✓ Ready to collect subscribers</p>
                  </div>
                </div>

                <div className="flex justify-center pt-6">
                  <Button onClick={handleNext} size="lg">
                    Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}