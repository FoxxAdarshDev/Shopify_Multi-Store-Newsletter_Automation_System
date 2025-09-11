import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, CheckCircle, Copy, Linkedin, Twitter, Youtube, Instagram, Facebook } from "lucide-react";
import { SiReddit, SiQuora } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { useState } from "react";

// Secure HTML sanitization for safe rendering
const sanitizeHtml = (html: string): string => {
  // Only allow safe formatting tags
  const allowedTags = ['strong', 'b', 'mark', 'em', 'i'];
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove any script tags or other dangerous elements
  const scripts = tempDiv.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  // Process all elements
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(element => {
    const tagName = element.tagName.toLowerCase();
    
    if (allowedTags.includes(tagName)) {
      // For allowed tags, remove ALL attributes to prevent XSS
      Array.from(element.attributes).forEach(attr => {
        element.removeAttribute(attr.name);
      });
    } else {
      // Replace disallowed tags with their text content
      element.replaceWith(document.createTextNode(element.textContent || ''));
    }
  });
  
  return tempDiv.innerHTML;
};

// Component to render sanitized HTML
const SafeHtmlText = ({ html, className = '' }: { html: string; className?: string }) => {
  const sanitizedHtml = sanitizeHtml(html);
  return (
    <span 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
    />
  );
};

interface PopupConfig {
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
  showExitIntentIfNotSubscribed?: boolean;
  suppressAfterSubscription: boolean;
  isActive: boolean;
}

interface PopupPreviewProps {
  config: PopupConfig;
  isFullscreen?: boolean;
  onClose?: () => void;
  socialLinks?: {
    linkedin: string;
    twitter: string;
    youtube: string;
    instagram: string;
    facebook: string;
    reddit: string;
    quora: string;
  };
}

export default function PopupPreview({ config, isFullscreen = false, onClose, socialLinks }: PopupPreviewProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({ email: '', name: '', phone: '', company: '', address: '' });
  const fireConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Create confetti from both sides of the screen
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    
    // Check for temporary email domains
    const tempDomains = [
      'temp-mail.org', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
      'yopmail.com', 'throwaway.email', 'tempmail.com', 'gettemp.mail',
      'temp-mail.io', 'mohmal.com', 'maildrop.cc', 'mailnesia.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (tempDomains.includes(domain)) {
      return 'Temporary email addresses are not allowed. Please use your permanent email.';
    }
    
    if (config.emailValidation.companyEmailsOnly) {
      if (config.emailValidation.blockedDomains.includes(domain)) {
        return 'Please use your company email address.';
      }
      
      if (config.emailValidation.allowedDomains.length > 0 && !config.emailValidation.allowedDomains.includes(domain)) {
        return 'Please use an approved company email domain.';
      }
    }
    
    return '';
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const errors: Record<string, string> = {};
    
    // Validate email
    if (!formData.email) {
      errors.email = 'Email address is required';
    } else {
      const emailError = validateEmail(formData.email);
      if (emailError) {
        errors.email = emailError;
      }
    }
    
    // Validate other required fields
    if (config.fields.name && !formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    fireConfetti();
  };

  const handleCopyCode = () => {
    const discountCode = config.discountCode;
    navigator.clipboard.writeText(discountCode).then(() => {
      toast({
        title: "Copied!",
        description: `Discount code "${discountCode}" copied to clipboard`,
        duration: 3000,
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Please copy the discount code manually",
        variant: "destructive",
        duration: 3000,
      });
    });
  };

  const renderSocialIcons = () => {
    if (!socialLinks) return null;
    
    const icons = [
      { key: 'linkedin', icon: Linkedin, url: socialLinks.linkedin, color: 'text-blue-600 hover:text-blue-700' },
      { key: 'twitter', icon: Twitter, url: socialLinks.twitter, color: 'text-blue-400 hover:text-blue-500' },
      { key: 'youtube', icon: Youtube, url: socialLinks.youtube, color: 'text-red-600 hover:text-red-700' },
      { key: 'instagram', icon: Instagram, url: socialLinks.instagram, color: 'text-pink-600 hover:text-pink-700' },
      { key: 'facebook', icon: Facebook, url: socialLinks.facebook, color: 'text-blue-700 hover:text-blue-800' },
      { key: 'reddit', icon: SiReddit, url: socialLinks.reddit, color: 'text-orange-600 hover:text-orange-700' },
      { key: 'quora', icon: SiQuora, url: socialLinks.quora, color: 'text-red-700 hover:text-red-800' },
    ];
    
    const activeIcons = icons.filter(icon => icon.url && icon.url.trim() !== '');
    
    if (activeIcons.length === 0) return null;
    
    return (
      <div className="flex justify-center gap-3 mt-4">
        {activeIcons.map(({ key, icon: Icon, url, color }) => (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-2 rounded-full border border-gray-200 hover:border-gray-300 transition-all duration-200 ${color} hover:bg-gray-50`}
            data-testid={`social-icon-${key}`}
          >
            <Icon className="h-5 w-5" />
          </a>
        ))}
      </div>
    );
  };

  const renderFormFields = () => {
    if (isSubmitted) return null;
    
    const fields = [];
    
    if (config.fields.email) {
      fields.push(
        <div key="email" className="space-y-2">
          <Input
            type="email"
            placeholder="Enter your business email address"
            className={`w-full transition-all duration-200 border-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 ${formErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 hover:border-gray-300'}`}
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            data-testid="preview-input-email"
          />
          {formErrors.email && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-md border border-red-200">
              <div className="w-1 h-4 bg-red-500 rounded-full"></div>
              {formErrors.email}
            </div>
          )}
        </div>
      );
    }
    
    if (config.fields.name) {
      fields.push(
        <div key="name" className="space-y-2">
          <Input
            type="text"
            placeholder="Full Name"
            className={`w-full transition-all duration-200 border-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 ${formErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 hover:border-gray-300'}`}
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            data-testid="preview-input-name"
          />
          {formErrors.name && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-md border border-red-200">
              <div className="w-1 h-4 bg-red-500 rounded-full"></div>
              {formErrors.name}
            </div>
          )}
        </div>
      );
    }
    
    if (config.fields.phone) {
      fields.push(
        <div key="phone" className="space-y-2">
          <Input
            type="tel"
            placeholder="Phone Number"
            className="w-full transition-all duration-200 border-2 border-gray-200 hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            data-testid="preview-input-phone"
          />
        </div>
      );
    }
    
    if (config.fields.company) {
      fields.push(
        <div key="company" className="space-y-2">
          <Input
            type="text"
            placeholder="Company Name"
            className="w-full transition-all duration-200 border-2 border-gray-200 hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            value={formData.company}
            onChange={(e) => handleInputChange('company', e.target.value)}
            data-testid="preview-input-company"
          />
        </div>
      );
    }
    
    if (config.fields.address) {
      fields.push(
        <div key="address" className="space-y-2">
          <Textarea
            placeholder="Address"
            className="w-full min-h-20 resize-none transition-all duration-200 border-2 border-gray-200 hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            data-testid="preview-textarea-address"
          />
        </div>
      );
    }
    
    return fields;
  };

  const PopupContent = () => {
    if (isSubmitted) {
      return (
        <div className="bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 rounded-3xl p-6 lg:p-8 w-[92vw] lg:w-auto max-w-[720px] lg:max-w-[820px] xl:max-w-[880px] max-h-[70vh] overflow-y-auto shadow-2xl relative" data-testid="popup-success">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-200"></div>
          </div>
          
          <div className="relative z-10">
            {/* Header Row with Success Icon and Welcome */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-8 mb-6">
              <div className="flex-shrink-0 text-center lg:text-left">
                <div className="inline-flex w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full items-center justify-center shadow-lg transform scale-110 animate-pulse mb-4 lg:mb-0">
                  <CheckCircle className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
                </div>
              </div>
              
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-2">
                  Welcome to the Family!
                </h2>
                <div className="text-gray-600 text-base lg:text-lg">
                  <span>Confirmation sent to </span>
                  <span className="text-gray-800 font-semibold break-all">{formData.email}</span>
                </div>
              </div>
            </div>
            
            {/* Main Content Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Discount Code Section */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-white/50 shadow-inner">
                <p className="text-xs lg:text-sm font-medium text-gray-600 mb-3 uppercase tracking-wide text-center">
                  Your Exclusive Discount
                </p>
                <div className="text-center">
                  <div className="text-3xl lg:text-4xl font-bold text-primary mb-3">
                    {config.discountCode}
                  </div>
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    size="sm"
                    className="hover:bg-primary/10 border-primary/20 text-primary hover:text-primary"
                    data-testid="button-copy-code"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Tap to copy • Save {config.discountPercentage}%
                  </Button>
                </div>
              </div>
              
              {/* Email Notification Section */}
              <div className="flex items-center justify-center">
                <div className="bg-gradient-to-r from-blue-100/80 to-indigo-100/80 rounded-xl p-4 border border-blue-200/50 w-full">
                  <div className="flex items-center justify-center gap-2 text-blue-700 text-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-center">Email with discount code is on its way!</span>
                  </div>
                  <div className="text-center mt-2 text-xs text-blue-600">
                    Check your inbox in the next few minutes!
                  </div>
                  {renderSocialIcons()}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="fpw-popup-root bg-white rounded-3xl p-6 lg:p-8 w-[92vw] lg:w-auto max-w-[520px] lg:max-w-[600px] max-h-[70vh] overflow-y-auto shadow-2xl relative" data-testid="popup-preview">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/50 rounded-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div></div>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 p-2 rounded-full transition-all duration-200"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="text-center mb-8">
            <div className="w-16 h-1 bg-gradient-to-r from-primary to-blue-500 rounded-full mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
              <SafeHtmlText html={config.title} />
            </h2>
            <p className="text-gray-600 text-base leading-relaxed">
              <SafeHtmlText html={config.subtitle} />
            </p>
          </div>

          <div className="space-y-5 mb-8">
            {renderFormFields()}
            
            {!isSubmitted && (
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-primary to-blue-600 text-white hover:from-primary/90 hover:to-blue-500 h-12 rounded-xl font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  config.buttonText
                )}
              </Button>
            )}
          </div>

          {!isSubmitted && (
            <div className="mt-6 space-y-4">
              <label className="fpw-checkbox-container flex items-start text-sm text-gray-600 leading-relaxed">
                <Checkbox className="fpw-checkbox mr-3 mt-0.5" />
                <span className="fpw-checkbox-text">
                  Stay Connected For: <strong>Exclusive Product Launches</strong> • <strong>Special Promotions</strong> • <strong>Bioprocess Insights & Updates</strong>
                </span>
              </label>
              {renderSocialIcons()}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isFullscreen) {
    return (
      <Dialog open={isFullscreen} onOpenChange={onClose}>
        <DialogContent className="fpw-dialog-content">
          <div className="max-h-full overflow-y-auto w-[92vw] lg:w-auto max-w-[720px] lg:max-w-[820px] xl:max-w-[880px] max-h-[70vh]">
            <PopupContent />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 min-h-96 border border-gray-200">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-xl flex items-center justify-center p-4">
        <PopupContent />
      </div>
    </div>
  );
}
