import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';

interface Store {
  id: string;
  name: string;
  shopifyUrl: string;
  shopifyAccessToken?: string;
  isConnected: boolean;
  isVerified: boolean;
}

interface StoreContextType {
  selectedStoreId: string | null;
  setSelectedStoreId: (storeId: string) => void;
  stores: Store[];
  selectedStore: Store | null;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const params = useParams<{ storeId: string }>();
  
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  // Auto-select based on URL parameter or first store
  useEffect(() => {
    if (params?.storeId && stores.find(s => s.id === params.storeId)) {
      // URL has valid store ID, use it
      setSelectedStoreId(params.storeId);
    } else if (stores.length > 0 && !selectedStoreId) {
      // No URL store ID, select the first store
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, params?.storeId]); // Remove selectedStoreId dependency to prevent loop

  const selectedStore = stores.find(store => store.id === selectedStoreId) || null;

  // Enhanced setSelectedStoreId that updates URL
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    
    // Update URL to include store context
    if (location === '/' || location === '/dashboard') {
      setLocation(`/store/${storeId}/dashboard`);
    } else if (location.startsWith('/store/')) {
      // Replace store ID in existing store-specific route
      const pathAfterStore = location.split('/').slice(3).join('/');
      setLocation(`/store/${storeId}/${pathAfterStore}`);
    } else {
      // Convert general route to store-specific route
      const page = location.substring(1); // Remove leading slash
      if (['popup-builder', 'subscribers', 'integration', 'settings', 'email-templates'].includes(page)) {
        setLocation(`/store/${storeId}/${page}`);
      } else {
        // Default to dashboard for any other page
        setLocation(`/store/${storeId}/dashboard`);
      }
    }
  };

  return (
    <StoreContext.Provider value={{
      selectedStoreId,
      setSelectedStoreId: handleStoreChange,
      stores,
      selectedStore
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  return context;
};