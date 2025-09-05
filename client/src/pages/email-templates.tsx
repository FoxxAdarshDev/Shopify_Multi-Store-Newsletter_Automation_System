import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, Save, Palette, Link, Image } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  userId: string;
  templateName: string;
  subject: string;
  headerLogo: string | null;
  headerText: string | null;
  bodyContent: string;
  footerText: string | null;
  socialMediaLinks: {
    website?: string;
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  primaryColor: string;
  secondaryColor: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EmailTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [templateForm, setTemplateForm] = useState({
    templateName: "Welcome Email Template",
    subject: "Thank You for Registering – Here's Your 15% Discount!",
    headerLogo: "/assets/foxx-logo.png",
    headerText: "Foxx Bioprocess",
    bodyContent: `Dear [First Name],

Thank you for registering your email with Foxx Bioprocess. We're excited to have you as part of our community!

As a token of our appreciation, here's a 15% discount code you can use on your next purchase through our website:

[DISCOUNT_CODE]

Simply apply this code at checkout on www.foxxbioprocess.com to enjoy your savings.

We look forward to supporting your Single-Use Technology needs with the world's first and largest Bioprocess SUT library.

Happy shopping!
Warm regards,
Team Foxx Bioprocess`,
    footerText: "© 2024 Foxx Bioprocess. All rights reserved.",
    socialMediaLinks: {
      website: "https://www.foxxbioprocess.com",
      linkedin: "",
      twitter: "",
      facebook: "",
      instagram: ""
    },
    primaryColor: "#0071b9",
    secondaryColor: "#00c68c"
  });

  const [previewHtml, setPreviewHtml] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const { data: template, isLoading } = useQuery<EmailTemplate>({
    queryKey: ["/api/email-template"],
  });

  const { data: clickStats } = useQuery<{clickRate: number; totalEmails: number; totalClicks: number}>({
    queryKey: ["/api/email-click-stats"],
  });

  useEffect(() => {
    if (template) {
      setTemplateForm({
        templateName: template.templateName,
        subject: template.subject,
        headerLogo: template.headerLogo || "/assets/foxx-logo.png",
        headerText: template.headerText || "Foxx Bioprocess",
        bodyContent: template.bodyContent,
        footerText: template.footerText || "© 2024 Foxx Bioprocess. All rights reserved.",
        socialMediaLinks: template.socialMediaLinks || {
          website: "https://www.foxxbioprocess.com",
          linkedin: "",
          twitter: "",
          facebook: "",
          instagram: ""
        },
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor
      });
      // Auto-generate preview when template loads
      setTimeout(() => generatePreviewMutation.mutate(), 100);
    }
  }, [template]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  const updateTemplateMutation = useMutation({
    mutationFn: async (updatedTemplate: Partial<EmailTemplate>) => {
      return apiRequest("/api/email-template", {
        method: "PUT",
        body: JSON.stringify(updatedTemplate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-template"] });
      toast({
        title: "Success",
        description: "Email template updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update email template",
        variant: "destructive",
      });
    },
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/email-template/preview", {
        method: "POST",
        body: JSON.stringify(templateForm),
      });
    },
    onSuccess: (data: { html: string }) => {
      setPreviewHtml(data.html);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate preview",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateTemplateMutation.mutate(templateForm);
  };

  const handlePreview = () => {
    generatePreviewMutation.mutate();
  };

  const debouncedPreview = useCallback(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      generatePreviewMutation.mutate();
    }, 500); // Wait 500ms after user stops typing
    setDebounceTimer(timer);
  }, [debounceTimer, generatePreviewMutation]);

  const handleInputChange = (field: string, value: any) => {
    setTemplateForm(prev => ({
      ...prev,
      [field]: value
    }));
    // Auto-generate preview with debounce
    debouncedPreview();
  };

  const handleSocialLinkChange = (platform: string, url: string) => {
    setTemplateForm(prev => ({
      ...prev,
      socialMediaLinks: {
        ...prev.socialMediaLinks,
        [platform]: url
      }
    }));
    // Auto-generate preview with debounce
    debouncedPreview();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Email Templates</h2>
        </div>
        <div className="text-center py-8">Loading template...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Email Templates</h2>
        <div className="flex space-x-2">
          <Button
            onClick={handlePreview}
            variant="outline"
            disabled={generatePreviewMutation.isPending}
            data-testid="button-preview-email"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTemplateMutation.isPending}
            data-testid="button-save-template"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Template
          </Button>
        </div>
      </div>

      {/* Analytics Stats */}
      {clickStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary" data-testid="text-click-rate">
                {clickStats.clickRate}%
              </div>
              <div className="text-sm text-muted-foreground">Click Rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" data-testid="text-total-emails">
                {clickStats.totalEmails}
              </div>
              <div className="text-sm text-muted-foreground">Total Emails Sent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-clicks">
                {clickStats.totalClicks}
              </div>
              <div className="text-sm text-muted-foreground">Total Clicks</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Email Template Editor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="social">Social</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateForm.templateName}
                    onChange={(e) => handleInputChange("templateName", e.target.value)}
                    data-testid="input-template-name"
                  />
                </div>

                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={templateForm.subject}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                    placeholder="Thank You for Registering – Here's Your 15% Discount!"
                    data-testid="input-email-subject"
                  />
                </div>

                <div>
                  <Label htmlFor="header-text">Header Text</Label>
                  <Input
                    id="header-text"
                    value={templateForm.headerText}
                    onChange={(e) => handleInputChange("headerText", e.target.value)}
                    data-testid="input-header-text"
                  />
                </div>

                <div>
                  <Label htmlFor="body-content">Email Body</Label>
                  <Textarea
                    id="body-content"
                    value={templateForm.bodyContent}
                    onChange={(e) => handleInputChange("bodyContent", e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="Use [First Name] for personalization and [DISCOUNT_CODE] for the discount code"
                    data-testid="textarea-body-content"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Available placeholders: [First Name], [DISCOUNT_CODE]
                  </div>
                </div>

                <div>
                  <Label htmlFor="footer-text">Footer Text</Label>
                  <Input
                    id="footer-text"
                    value={templateForm.footerText}
                    onChange={(e) => handleInputChange("footerText", e.target.value)}
                    data-testid="input-footer-text"
                  />
                </div>
              </TabsContent>

              <TabsContent value="design" className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Palette className="w-4 h-4" />
                  <span className="font-medium">Brand Colors</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primary-color">Primary Color</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="primary-color"
                        type="color"
                        value={templateForm.primaryColor}
                        onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                        className="w-12 h-10 p-1 border rounded"
                        data-testid="input-primary-color"
                      />
                      <Input
                        value={templateForm.primaryColor}
                        onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                        placeholder="#0071b9"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="secondary-color">Secondary Color</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="secondary-color"
                        type="color"
                        value={templateForm.secondaryColor}
                        onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                        className="w-12 h-10 p-1 border rounded"
                        data-testid="input-secondary-color"
                      />
                      <Input
                        value={templateForm.secondaryColor}
                        onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                        placeholder="#00c68c"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="header-logo">Header Logo URL</Label>
                  <div className="flex items-center space-x-2">
                    <Image className="w-4 h-4" />
                    <Input
                      id="header-logo"
                      value={templateForm.headerLogo}
                      onChange={(e) => handleInputChange("headerLogo", e.target.value)}
                      placeholder="/assets/foxx-logo.png"
                      data-testid="input-header-logo"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="social" className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Link className="w-4 h-4" />
                  <span className="font-medium">Social Media Links</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={templateForm.socialMediaLinks.website}
                      onChange={(e) => handleSocialLinkChange("website", e.target.value)}
                      placeholder="https://www.foxxbioprocess.com"
                      data-testid="input-social-website"
                    />
                  </div>

                  <div>
                    <Label>LinkedIn</Label>
                    <Input
                      value={templateForm.socialMediaLinks.linkedin}
                      onChange={(e) => handleSocialLinkChange("linkedin", e.target.value)}
                      placeholder="https://linkedin.com/company/foxx-bioprocess"
                      data-testid="input-social-linkedin"
                    />
                  </div>

                  <div>
                    <Label>Twitter</Label>
                    <Input
                      value={templateForm.socialMediaLinks.twitter}
                      onChange={(e) => handleSocialLinkChange("twitter", e.target.value)}
                      placeholder="https://twitter.com/foxxbioprocess"
                      data-testid="input-social-twitter"
                    />
                  </div>

                  <div>
                    <Label>Facebook</Label>
                    <Input
                      value={templateForm.socialMediaLinks.facebook}
                      onChange={(e) => handleSocialLinkChange("facebook", e.target.value)}
                      placeholder="https://facebook.com/foxxbioprocess"
                      data-testid="input-social-facebook"
                    />
                  </div>

                  <div>
                    <Label>Instagram</Label>
                    <Input
                      value={templateForm.socialMediaLinks.instagram}
                      onChange={(e) => handleSocialLinkChange("instagram", e.target.value)}
                      placeholder="https://instagram.com/foxxbioprocess"
                      data-testid="input-social-instagram"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Email Deliverability Features</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Badge variant="secondary" className="mr-2">✓</Badge>
                      High priority headers for better inbox delivery
                    </div>
                    <div className="flex items-center">
                      <Badge variant="secondary" className="mr-2">✓</Badge>
                      First name extraction from email prefix
                    </div>
                    <div className="flex items-center">
                      <Badge variant="secondary" className="mr-2">✓</Badge>
                      Click tracking with UTM parameters
                    </div>
                    <div className="flex items-center">
                      <Badge variant="secondary" className="mr-2">✓</Badge>
                      Unsubscribe link in footer
                    </div>
                    <div className="flex items-center">
                      <Badge variant="secondary" className="mr-2">✓</Badge>
                      Mobile-responsive email design
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Email Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewHtml ? (
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Click "Preview" to see how your email will look
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}