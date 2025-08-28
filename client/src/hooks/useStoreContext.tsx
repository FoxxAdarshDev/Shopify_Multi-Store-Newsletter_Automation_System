import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Store {
  id: string;
  name: string;
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
  
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  // Auto-select the first store or the most recently created one
  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      // Select the first store (most recent due to ordering)
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const selectedStore = stores.find(store => store.id === selectedStoreId) || null;

  return (
    <StoreContext.Provider value={{
      selectedStoreId,
      setSelectedStoreId,
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