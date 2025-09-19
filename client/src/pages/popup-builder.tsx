import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Save, Linkedin, Twitter, Youtube, Instagram, Facebook, MessageCircle, Bold, Highlighter } from "lucide-react";
import { SiReddit, SiQuora } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useStoreContext } from "@/hooks/useStoreContext";
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
  cartValidation: {
    enabled: boolean;
    validationType: string; // "none", "minimum", "maximum", "below_threshold"
    minimumAmount: number;
    maximumAmount: number;
    belowThreshold: number;
  };
  discountCode: string;
  discountPercentage: number;
  displayTrigger: string;
  animation: string;
  showExitIntentIfNotSubscribed?: boolean;
  suppressAfterSubscription: boolean;
  isActive: boolean;
}

interface SocialLinks {
  linkedin: string;
  twitter: string;
  youtube: string;
  instagram: string;
  facebook: string;
  reddit: string;
  quora: string;
}

interface Store {
  id: string;
  name: string;
  socialLinks?: SocialLinks;
}

export default function PopupBuilder() {
  // Get URL parameters for preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const previewMode = urlParams.get('preview') === 'true';
  
  // Use store context and URL params
  const { storeId } = useParams<{ storeId?: string }>();
  const [, setLocation] = useLocation();
  const { stores, selectedStoreId, setSelectedStoreId, selectedStore } = useStoreContext();
  
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const [showPreview, setShowPreview] = useState(previewMode);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state for cart validation (to prevent auto-save)
  const [localCartValidation, setLocalCartValidation] = useState({
    enabled: false,
    validationType: 'none',
    minimumAmount: 0,
    maximumAmount: 1000,
    belowThreshold: 100
  });

  // Sync context from URL param when it changes
  useEffect(() => {
    if (storeId && storeId !== selectedStoreId) {
      setSelectedStoreId(storeId);
    }
  }, [storeId, selectedStoreId, setSelectedStoreId]);

  // Sync local cart validation with config when config loads
  useEffect(() => {
    if (config?.cartValidation) {
      setLocalCartValidation(config.cartValidation);
    }
  }, [config]);

  // Use selectedStoreId as single source of truth after URL sync
  const currentStoreId = selectedStoreId;

  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    linkedin: '',
    twitter: '',
    youtube: '',
    instagram: '',
    facebook: '',
    reddit: '',
    quora: ''
  });

  const { data: popupConfig, isLoading } = useQuery({
    queryKey: [`/api/stores/${currentStoreId}/popup`],
    enabled: !!currentStoreId,
  });

  const updateConfigMutation = useMutation({
    mutationFn: (updates: Partial<PopupConfig>) =>
      apiRequest(`/api/stores/${currentStoreId}/popup`, { method: "PUT", body: JSON.stringify(updates) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/popup`] });
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
    if (currentStoreId) {
      const currentStore = stores.find(store => store.id === currentStoreId);
      if (currentStore?.socialLinks) {
        setSocialLinks(currentStore.socialLinks);
      } else {
        // Reset to empty social links if store doesn't have them
        setSocialLinks({
          linkedin: '',
          twitter: '',
          youtube: '',
          instagram: '',
          facebook: '',
          reddit: '',
          quora: ''
        });
      }
    }
  }, [currentStoreId, stores]);

  const handleConfigUpdate = (updates: Partial<PopupConfig>) => {
    if (!config) return;
    
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    
    // Add a small delay to prevent race conditions with rapid checkbox clicks
    setTimeout(() => {
      updateConfigMutation.mutate(updates);
    }, 100);
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

  // Local cart validation change handler (no auto-save)
  const handleLocalCartValidationChange = (field: keyof PopupConfig["cartValidation"], value: any) => {
    setLocalCartValidation(prev => ({ ...prev, [field]: value }));
  };

  // Save cart validation settings
  const handleSaveCartValidation = () => {
    if (!config) return;
    handleConfigUpdate({ cartValidation: localCartValidation });
  };

  const updateStoreSocialLinksMutation = useMutation({
    mutationFn: (socialLinks: SocialLinks) =>
      apiRequest(`/api/stores/${currentStoreId}`, { method: "PUT", body: JSON.stringify({ socialLinks }) }),
    onSuccess: () => {
      // Invalidate both stores list and specific store queries
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}`] });
      toast({
        title: "Success",
        description: "Social media links updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update social media links",
        variant: "destructive",
      });
    },
  });

  const handleSocialLinkChange = (platform: string, url: string) => {
    setSocialLinks(prev => ({ ...prev, [platform]: url }));
  };

  const handleSaveSocialLinks = () => {
    updateStoreSocialLinksMutation.mutate(socialLinks);
  };

  const addFormatting = (field: 'title' | 'subtitle', tag: 'strong' | 'mark') => {
    if (!config) return;
    
    const textarea = document.getElementById(field === 'title' ? 'title' : 'subtitle') as HTMLInputElement | HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const currentValue = config[field];
    
    if (start === end) {
      // No selection, insert placeholder
      const beforeText = currentValue.substring(0, start);
      const afterText = currentValue.substring(end);
      const placeholder = tag === 'strong' ? 'bold text' : 'highlighted text';
      const newValue = `${beforeText}<${tag}>${placeholder}</${tag}>${afterText}`;
      handleConfigUpdate({ [field]: newValue });
      
      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + `<${tag}>${placeholder}</${tag}>`.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else {
      // Text is selected, wrap it
      const beforeText = currentValue.substring(0, start);
      const selectedText = currentValue.substring(start, end);
      const afterText = currentValue.substring(end);
      const newValue = `${beforeText}<${tag}>${selectedText}</${tag}>${afterText}`;
      handleConfigUpdate({ [field]: newValue });
      
      // Restore selection after the tags
      setTimeout(() => {
        textarea.focus();
        const newStart = start + `<${tag}>`.length;
        const newEnd = newStart + selectedText.length;
        textarea.setSelectionRange(newStart, newEnd);
      }, 0);
    }
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
          <Select value={selectedStoreId || undefined} onValueChange={(newStoreId) => {
            // Navigate to the store-specific URL to update both URL and context
            setLocation(`/store/${newStoreId}/popup-builder`);
          }}>
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
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="title">Popup Title</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFormatting('title', 'strong')}
                        className="h-8 px-2"
                        data-testid="button-format-title-bold"
                      >
                        <Bold className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFormatting('title', 'mark')}
                        className="h-8 px-2"
                        data-testid="button-format-title-highlight"
                      >
                        <Highlighter className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="title"
                    value={config.title}
                    onChange={(e) => handleConfigUpdate({ title: e.target.value })}
                    data-testid="input-popup-title"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Select text and use formatting buttons to add <strong>bold</strong> or <mark className="bg-yellow-200 px-1 rounded">highlight</mark> styling
                  </p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="subtitle">Subtitle</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFormatting('subtitle', 'strong')}
                        className="h-8 px-2"
                        data-testid="button-format-subtitle-bold"
                      >
                        <Bold className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFormatting('subtitle', 'mark')}
                        className="h-8 px-2"
                        data-testid="button-format-subtitle-highlight"
                      >
                        <Highlighter className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="subtitle"
                    rows={3}
                    value={config.subtitle}
                    onChange={(e) => handleConfigUpdate({ subtitle: e.target.value })}
                    data-testid="textarea-popup-subtitle"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Select text and use formatting buttons to add <strong>bold</strong> or <mark className="bg-yellow-200 px-1 rounded">highlight</mark> styling
                  </p>
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

          {/* Cart Validation Configuration */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">Cart Value Validation</h3>
                <Button 
                  onClick={handleSaveCartValidation}
                  disabled={updateConfigMutation.isPending}
                  size="sm"
                  data-testid="button-save-cart-validation"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Cart Settings
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableCartValidation"
                    checked={localCartValidation.enabled}
                    onCheckedChange={(checked) => 
                      handleLocalCartValidationChange('enabled', !!checked)
                    }
                    data-testid="checkbox-enable-cart-validation"
                  />
                  <Label htmlFor="enableCartValidation" className="text-sm">
                    Enable cart value validation for discount eligibility
                  </Label>
                </div>
                
                {localCartValidation.enabled && (
                  <>
                    <div>
                      <Label htmlFor="validationType">Validation Type</Label>
                      <Select 
                        value={localCartValidation.validationType} 
                        onValueChange={(value) => handleLocalCartValidationChange('validationType', value)}
                      >
                        <SelectTrigger data-testid="select-validation-type">
                          <SelectValue placeholder="Select validation type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Validation</SelectItem>
                          <SelectItem value="minimum">Minimum Cart Value</SelectItem>
                          <SelectItem value="maximum">Maximum Cart Value</SelectItem>
                          <SelectItem value="below_threshold">Below Threshold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {localCartValidation.validationType === 'minimum' && (
                      <div>
                        <Label htmlFor="minimumAmount">Minimum Cart Amount ($)</Label>
                        <Input
                          id="minimumAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={localCartValidation.minimumAmount}
                          onChange={(e) => handleLocalCartValidationChange('minimumAmount', Number(e.target.value))}
                          data-testid="input-minimum-amount"
                          placeholder="e.g., 100.00"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Discount is only valid when cart total is above this amount
                        </p>
                      </div>
                    )}

                    {localCartValidation.validationType === 'maximum' && (
                      <div>
                        <Label htmlFor="maximumAmount">Maximum Cart Amount ($)</Label>
                        <Input
                          id="maximumAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={localCartValidation.maximumAmount}
                          onChange={(e) => handleLocalCartValidationChange('maximumAmount', Number(e.target.value))}
                          data-testid="input-maximum-amount"
                          placeholder="e.g., 1000.00"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Discount is only valid when cart total is below this amount
                        </p>
                      </div>
                    )}

                    {localCartValidation.validationType === 'below_threshold' && (
                      <div>
                        <Label htmlFor="belowThreshold">Below Threshold Amount ($)</Label>
                        <Input
                          id="belowThreshold"
                          type="number"
                          min="0"
                          step="0.01"
                          value={localCartValidation.belowThreshold}
                          onChange={(e) => handleLocalCartValidationChange('belowThreshold', Number(e.target.value))}
                          data-testid="input-below-threshold"
                          placeholder="e.g., 500.00"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Discount is only valid when cart total is below this threshold
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Social Media Links */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">Social Media Links</h3>
                <Button 
                  onClick={handleSaveSocialLinks}
                  disabled={updateStoreSocialLinksMutation.isPending}
                  size="sm"
                  data-testid="button-save-social-links"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateStoreSocialLinksMutation.isPending ? 'Saving...' : 'Save Links'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Add your social media URLs to display clickable icons in your popup
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-3">
                    <Linkedin className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <Label htmlFor="linkedin" className="text-sm font-medium">LinkedIn</Label>
                      <Input
                        id="linkedin"
                        placeholder="https://linkedin.com/company/your-company"
                        value={socialLinks.linkedin}
                        onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                        data-testid="input-social-linkedin"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Twitter className="h-5 w-5 text-blue-400" />
                    <div className="flex-1">
                      <Label htmlFor="twitter" className="text-sm font-medium">Twitter</Label>
                      <Input
                        id="twitter"
                        placeholder="https://twitter.com/your-handle"
                        value={socialLinks.twitter}
                        onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                        data-testid="input-social-twitter"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Youtube className="h-5 w-5 text-red-600" />
                    <div className="flex-1">
                      <Label htmlFor="youtube" className="text-sm font-medium">YouTube</Label>
                      <Input
                        id="youtube"
                        placeholder="https://youtube.com/c/your-channel"
                        value={socialLinks.youtube}
                        onChange={(e) => handleSocialLinkChange('youtube', e.target.value)}
                        data-testid="input-social-youtube"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Instagram className="h-5 w-5 text-pink-600" />
                    <div className="flex-1">
                      <Label htmlFor="instagram" className="text-sm font-medium">Instagram</Label>
                      <Input
                        id="instagram"
                        placeholder="https://instagram.com/your-handle"
                        value={socialLinks.instagram}
                        onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                        data-testid="input-social-instagram"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Facebook className="h-5 w-5 text-blue-700" />
                    <div className="flex-1">
                      <Label htmlFor="facebook" className="text-sm font-medium">Facebook</Label>
                      <Input
                        id="facebook"
                        placeholder="https://facebook.com/your-page"
                        value={socialLinks.facebook}
                        onChange={(e) => handleSocialLinkChange('facebook', e.target.value)}
                        data-testid="input-social-facebook"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <SiReddit className="h-5 w-5 text-orange-600" />
                    <div className="flex-1">
                      <Label htmlFor="reddit" className="text-sm font-medium">Reddit</Label>
                      <Input
                        id="reddit"
                        placeholder="https://reddit.com/r/your-subreddit"
                        value={socialLinks.reddit}
                        onChange={(e) => handleSocialLinkChange('reddit', e.target.value)}
                        data-testid="input-social-reddit"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <SiQuora className="h-5 w-5 text-red-700" />
                    <div className="flex-1">
                      <Label htmlFor="quora" className="text-sm font-medium">Quora</Label>
                      <Input
                        id="quora"
                        placeholder="https://quora.com/profile/your-profile"
                        value={socialLinks.quora}
                        onChange={(e) => handleSocialLinkChange('quora', e.target.value)}
                        data-testid="input-social-quora"
                      />
                    </div>
                  </div>
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
              <PopupPreview 
                config={config} 
                socialLinks={socialLinks}
              />
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
        socialLinks={socialLinks}
        isFullscreen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
}
