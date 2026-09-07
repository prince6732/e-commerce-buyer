"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useProductSync, ProductEventData } from "./ProductSyncContext";
import axios from "../../utils/axios";

export interface CartItem {
  id: number;
  product_id: number;
  variant_id: number;
  quantity: number;
  price: number;
  total: number;
  selected_attributes?: Record<string, string>;
  product: {
    id: number;
    name: string;
    image_url: string | null;
    brand?: string | null;
    category_name?: string | null;
    status?: boolean;
  };
  variant: {
    id: number;
    title: string;
    sku: string;
    stock: number;
    image_url: string | null;
    bs?: number | null;
    mrp?: number | null;
    sp?: number | null;
    status?: boolean;
  };
}

export interface ItemStockStatus {
  isOutOfStock: boolean;
  isInsufficientStock: boolean;
  isUnavailable: boolean;
  message: string | null;
  availableStock: number;
}

interface CartContextType {
  items: CartItem[];
  count: number;
  total: number;
  loading: boolean;
  hasOutOfStockItems: boolean;
  hasInsufficientStockItems: boolean;
  outOfStockItems: CartItem[];
  getItemStockStatus: (item: CartItem) => ItemStockStatus;
  addToCart: (productId: number, variantId: number, quantity: number, selectedAttributes?: Record<string, string>) => Promise<boolean>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<boolean>;
  removeFromCart: (cartItemId: number) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const { subscribeToAll } = useProductSync();

  const getItemStockStatus = useCallback((item: CartItem): ItemStockStatus => {
    const isInactive = item.product?.status === false || item.variant?.status === false;
    const availableStock = item.variant ? Number(item.variant.stock ?? 0) : 0;
    const isOutOfStock = isInactive || availableStock <= 0;
    const isInsufficientStock = !isOutOfStock && item.quantity > availableStock;
    const isUnavailable = isOutOfStock || isInsufficientStock;

    let message: string | null = null;
    if (isInactive) {
      message = "This product is currently unavailable.";
    } else if (availableStock <= 0) {
      message = "This product is currently out of stock.";
    } else if (isInsufficientStock) {
      message = `Only ${availableStock} available in stock. Please reduce quantity.`;
    }

    return {
      isOutOfStock,
      isInsufficientStock,
      isUnavailable,
      message,
      availableStock,
    };
  }, []);

  const hasOutOfStockItems = items.some((item) => {
    const status = getItemStockStatus(item);
    return status.isOutOfStock;
  });

  const hasInsufficientStockItems = items.some((item) => {
    const status = getItemStockStatus(item);
    return status.isUnavailable;
  });

  const outOfStockItems = items.filter((item) => {
    const status = getItemStockStatus(item);
    return status.isUnavailable;
  });

  const refreshCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      setCount(0);
      setTotal(0);
      return;
    }

    try {
      const response = await axios.get('/api/cart');

      if (response.data.success) {
        const cartData = response.data.data;
        setItems(cartData.items || []);
        setCount(cartData.count || 0);
        setTotal(cartData.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
      setItems([]);
      setCount(0);
      setTotal(0);
    }
  }, [user]);

  // Real-time synchronization for Cart items
  useEffect(() => {
    const unsubscribe = subscribeToAll((event: ProductEventData) => {
      if (!user) return;

      const updatedProd = event.product;
      const pid = event.productId || (updatedProd?.id ? Number(updatedProd.id) : undefined);
      if (!pid) return;

      if (event.action === "stock_updated") {
        console.log(`⚡ [CartSync] Stock updated event received for product #${pid}, variant #${event.variantId} -> stock: ${event.stock}`);
        setItems((prevItems) => {
          let changed = false;
          const updated = prevItems.map((item) => {
            const matchVariant = event.variantId !== undefined && Number(item.variant_id) === Number(event.variantId);
            const matchProduct = Number(item.product_id) === Number(pid);

            if (matchVariant || (event.variantId === undefined && matchProduct)) {
              changed = true;
              const newStock = event.stock !== undefined ? Number(event.stock) : item.variant.stock;
              return {
                ...item,
                variant: {
                  ...item.variant,
                  stock: newStock,
                },
              };
            }
            return item;
          });
          return changed ? updated : prevItems;
        });

        // Trigger background refresh to keep in complete sync
        refreshCart();
      } else if (event.action === "updated" && updatedProd) {
        console.log(`⚡ [CartSync] Product updated event received for product #${pid}`);
        setItems((prevItems) => {
          const hasItem = prevItems.some((item) => Number(item.product_id) === Number(pid));
          if (!hasItem) return prevItems;

          const updated = prevItems.map((item) => {
            if (Number(item.product_id) !== Number(pid)) return item;

            // Find matching variant
            const matchingVar = (updatedProd.variants || []).find(
              (v: any) => Number(v.id) === Number(item.variant_id)
            );

            const newPrice = matchingVar
              ? Number(matchingVar.sp ?? matchingVar.price ?? item.price)
              : Number(updatedProd.sp ?? item.price);

            const newTotal = newPrice * item.quantity;

            return {
              ...item,
              price: newPrice,
              total: newTotal,
              product: {
                ...item.product,
                name: updatedProd.name ?? item.product.name,
                image_url: updatedProd.image_url ?? item.product.image_url,
                brand: updatedProd.brand_name ?? updatedProd.brand?.name ?? item.product.brand,
                category_name: updatedProd.category_name ?? updatedProd.category?.name ?? item.product.category_name,
                status: updatedProd.status !== undefined ? Boolean(updatedProd.status) : item.product?.status,
              },
              variant: matchingVar
                ? {
                    ...item.variant,
                    title: matchingVar.title ?? item.variant.title,
                    sku: matchingVar.sku ?? item.variant.sku,
                    stock: Number(matchingVar.stock ?? item.variant.stock),
                    image_url: matchingVar.image_url ?? item.variant.image_url,
                    mrp: matchingVar.mrp !== undefined ? Number(matchingVar.mrp) : item.variant.mrp,
                    sp: matchingVar.sp !== undefined ? Number(matchingVar.sp) : item.variant.sp,
                    status: matchingVar.status !== undefined ? Boolean(matchingVar.status) : item.variant?.status,
                  }
                : item.variant,
            };
          });

          // Recalculate totals immediately
          const newTotal = updated.reduce((sum, i) => sum + (i.total || 0), 0);
          setTotal(newTotal);

          return updated;
        });

        refreshCart();
      } else if (event.action === "status_changed") {
        console.log(`⚡ [CartSync] Product status changed event for product #${pid} -> ${event.status}`);
        setItems((prevItems) => {
          const hasItem = prevItems.some((item) => Number(item.product_id) === Number(pid));
          if (!hasItem) return prevItems;

          return prevItems.map((item) => {
            if (Number(item.product_id) !== Number(pid)) return item;
            return {
              ...item,
              product: {
                ...item.product,
                status: event.status !== undefined ? Boolean(event.status) : item.product?.status,
              },
            };
          });
        });
        refreshCart();
      } else if (event.action === "deleted") {
        console.log(`⚡ [CartSync] Product deleted event for product #${pid}`);
        refreshCart();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeToAll, user, refreshCart]);

  const addToCart = async (
    productId: number,
    variantId: number,
    quantity: number = 1,
    selectedAttributes?: Record<string, string>
  ): Promise<boolean> => {
    if (!user) {
      alert("Please login to add items to cart");
      return false;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/cart/add', {
        product_id: productId,
        variant_id: variantId,
        quantity,
        selected_attributes: selectedAttributes,
      });

      if (response.data.success) {
        await refreshCart(); // Refresh cart to get updated data
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Failed to add item to cart:", error);

      // Handle specific error messages
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessage = Object.values(errors).flat().join(', ');
        alert(errorMessage);
      } else if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("Failed to add item to cart");
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (cartItemId: number, quantity: number): Promise<boolean> => {
    if (!user) return false;

    try {
      setLoading(true);
      const response = await axios.put(`/api/cart/${cartItemId}`, {
        quantity,
      });

      if (response.data.success) {
        await refreshCart();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Failed to update cart item:", error);

      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessage = Object.values(errors).flat().join(', ');
        alert(errorMessage);
      } else if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("Failed to update cart item");
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (cartItemId: number): Promise<boolean> => {
    if (!user) return false;

    try {
      setLoading(true);
      const response = await axios.delete(`/api/cart/${cartItemId}`);

      if (response.data.success) {
        await refreshCart();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to remove item from cart:", error);
      alert("Failed to remove item from cart");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setLoading(true);
      const response = await axios.delete('/api/cart');

      if (response.data.success) {
        setItems([]);
        setCount(0);
        setTotal(0);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to clear cart:", error);
      alert("Failed to clear cart");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Refresh cart when user changes
  useEffect(() => {
    refreshCart();
  }, [user]);

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        total,
        loading,
        hasOutOfStockItems,
        hasInsufficientStockItems,
        outOfStockItems,
        getItemStockStatus,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
};