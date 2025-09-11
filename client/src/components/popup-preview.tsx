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
        <div className="text-center p-8 relative rounded-3xl text-white overflow-hidden max-w-[680px] max-h-[90vh] overflow-y-auto" style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #2563eb 100%)',
          boxShadow: '0 20px 40px rgba(30, 64, 175, 0.3), 0 0 0 1px rgba(255,255,255,0.15)'
        }} data-testid="popup-success">
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 rounded-3xl pointer-events-none z-0" style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)'
          }}></div>
          
          <div className="relative z-10 pb-5">
            {/* Animated Success Icon */}
            <div className="w-30 h-30 mx-auto mb-8 rounded-full flex items-center justify-center text-white text-6xl font-bold relative" style={{
              width: '120px',
              height: '120px',
              background: 'linear-gradient(135deg, #00c68c, #00e699)',
              boxShadow: '0 15px 40px rgba(0, 198, 140, 0.4), 0 0 0 8px rgba(255,255,255,0.1)'
            }}>
              ✓
              {/* Pulse ring */}
              <div className="absolute border-3 rounded-full animate-pulse" style={{
                width: '140px',
                height: '140px',
                border: '3px solid rgba(0, 198, 140, 0.3)'
              }}></div>
            </div>
            
            {/* Success Message */}
            <h2 className="text-white mb-4 text-3xl font-extrabold">
              Welcome to the Family!
            </h2>
            
            {/* Email confirmation */}
            <div className="rounded-2xl p-5 mb-6 border" style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255,255,255,0.2)'
            }}>
              <div className="text-sm text-white/80 mb-2 uppercase tracking-wide font-semibold">
                Confirmation sent to
              </div>
              <div className="text-lg font-bold text-white mb-3 break-all">
                {formData.email}
              </div>
              <div className="text-sm text-white/70 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.1 3.89 23 5 23H11V21H5V3H13V9H21Z"/>
                </svg>
                Email with discount code is on its way!
              </div>
            </div>
            {/* Discount Code Section */}
            <div className="rounded-2xl p-6 mb-8 border-2 border-dashed cursor-pointer transition-all duration-300 hover:scale-105" style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(15px)',
              borderColor: 'rgba(255,255,255,0.3)'
            }} onClick={handleCopyCode}>
              <div className="text-sm text-white/80 mb-2 uppercase tracking-wide font-semibold text-center">
                Your Exclusive Discount
              </div>
              <div className="text-3xl font-black text-white mb-2 text-center tracking-wider">
                {config.discountCode}
              </div>
              <div className="text-sm text-white/70 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 21H8V7H19M19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1Z"/>
                </svg>
                Tap to copy • Save {config.discountPercentage}%
              </div>
            </div>
            
            {/* Email notification note */}
            <div className="rounded-2xl p-4 mb-6 border text-white" style={{
              background: 'rgba(0, 198, 140, 0.15)',
              borderColor: 'rgba(0, 198, 140, 0.3)'
            }}>
              <div className="flex items-center gap-2 mb-2 font-semibold">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"/>
                </svg>
                Email Notification
              </div>
              We're sending you a welcome email with your discount code and exclusive updates. Check your inbox in the next few minutes!
            </div>
            
            {/* Continue button */}
            <button className="text-white border-2 px-8 py-4 rounded-full font-bold text-base cursor-pointer transition-all duration-300 hover:scale-105 min-w-[140px] mt-6" style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255,255,255,0.3)'
            }} onClick={() => setIsSubmitted(false)}>
              Continue Shopping
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="fpw-popup-root bg-white rounded-3xl p-7 w-[92vw] lg:w-auto max-w-[680px] max-h-[90vh] overflow-y-auto shadow-2xl relative border border-white/20" style={{backdropFilter: 'blur(20px)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8)'}} data-testid="popup-preview">
        
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
          
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-3 leading-tight" style={{color: '#0071b9'}}>
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
                className="w-full text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none rounded-xl"
                style={{
                  background: '#0071b9',
                  height: '48px',
                  padding: '16px 24px'
                }}
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
    <div className="relative bg-black/50 rounded-xl p-6 min-h-96 flex items-center justify-center" style={{backdropFilter: 'blur(4px)'}}>
      <PopupContent />
    </div>
  );
}
