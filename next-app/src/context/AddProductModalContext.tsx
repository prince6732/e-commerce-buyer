"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface AddProductModalContextType {
  isOpen: boolean;
  openAddProductModal: () => void;
  closeAddProductModal: () => void;
}

const AddProductModalContext = createContext<AddProductModalContextType | undefined>(undefined);

export function AddProductModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openAddProductModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeAddProductModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AddProductModalContext.Provider
      value={{
        isOpen,
        openAddProductModal,
        closeAddProductModal,
      }}
    >
      {children}
    </AddProductModalContext.Provider>
  );
}

export function useAddProductModal() {
  const context = useContext(AddProductModalContext);
  if (!context) {
    throw new Error("useAddProductModal must be used within an AddProductModalProvider");
  }
  return context;
}
