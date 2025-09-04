import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

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
}

export default function PopupPreview({ config, isFullscreen = false, onClose }: PopupPreviewProps) {
  const renderFormFields = () => {
    const fields = [];
    
    if (config.fields.email) {
      fields.push(
        <Input
          key="email"
          type="email"
          placeholder="Enter your email address"
          className="w-full"
          data-testid="preview-input-email"
        />
      );
    }
    
    if (config.fields.name) {
      fields.push(
        <Input
          key="name"
          type="text"
          placeholder="Full Name"
          className="w-full"
          data-testid="preview-input-name"
        />
      );
    }
    
    if (config.fields.phone) {
      fields.push(
        <Input
          key="phone"
          type="tel"
          placeholder="Phone Number"
          className="w-full"
          data-testid="preview-input-phone"
        />
      );
    }
    
    if (config.fields.company) {
      fields.push(
        <Input
          key="company"
          type="text"
          placeholder="Company Name"
          className="w-full"
          data-testid="preview-input-company"
        />
      );
    }
    
    if (config.fields.address) {
      fields.push(
        <Textarea
          key="address"
          placeholder="Address"
          className="w-full min-h-20 resize-none"
          data-testid="preview-textarea-address"
        />
      );
    }
    
    return fields;
  };

  const PopupContent = () => (
    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl relative" data-testid="popup-preview">
      <div className="flex justify-between items-start mb-4">
        <div></div>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-600 p-1"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-primary mb-2">
          {config.title}
        </h2>
        <p className="text-sm text-gray-600">
          {config.subtitle}
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {renderFormFields()}
        
        <Button className="w-full bg-primary text-white hover:bg-primary/90">
          {config.buttonText}
        </Button>
      </div>

      <div className="flex justify-center space-x-4 mb-4 text-gray-400">
        <span>📘</span>
        <span>📷</span>
        <span>📌</span>
        <span>🎥</span>
        <span>🐦</span>
      </div>

      <div className="mt-4">
        <label className="flex items-start text-xs text-gray-600 leading-relaxed">
          <Checkbox className="mr-2 mt-0.5" />
          Stay Connected For: ✓ Exclusive Product Launches ✓ Special Promotions ✓ Bioprocess Insights & Updates
        </label>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <Dialog open={isFullscreen} onOpenChange={onClose}>
        <DialogContent className="max-w-none w-full h-full bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
          <PopupContent />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="relative bg-gray-100 rounded-lg p-8 min-h-96">
      <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center">
        <PopupContent />
      </div>
    </div>
  );
}
