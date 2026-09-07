"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

export interface ProductEventData {
  action: "created" | "updated" | "deleted" | "status_changed" | "stock_updated";
  productId?: number;
  variantId?: number;
  stock?: number;
  totalStock?: number;
  status?: boolean;
  product?: any;
  timestamp?: string;
}

type ProductEventCallback = (data: any) => void;

interface ProductSyncContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribeToProduct: (productId: number, callback: (event: ProductEventData) => void) => () => void;
  subscribeToAll: (callback: (event: ProductEventData) => void) => () => void;
  joinProductRoom: (productId: number) => void;
  leaveProductRoom: (productId: number) => void;
}

const ProductSyncContext = createContext<ProductSyncContextType | undefined>(undefined);

export const ProductSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Global and per-product listener sets
  const globalListenersRef = useRef<Set<(event: ProductEventData) => void>>(new Set());
  const productListenersRef = useRef<Map<number, Set<(event: ProductEventData) => void>>>(new Map());

  useEffect(() => {
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    const backendUrl = rawApiUrl.replace(/\/api\/?$/, "");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const newSocket = io(`${backendUrl}/products`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on("connect", () => {
      console.log("⚡ [ProductSync] Connected to Products Real-time Socket:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("⚠️ [ProductSync] Disconnected from Products Socket:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("⚠️ [ProductSync] Socket Connection Error:", err.message);
      setIsConnected(false);
    });

    // Helper dispatcher to notify listeners & window event bus
    const dispatchEvent = (eventData: ProductEventData) => {
      // 1. Notify global subscribers
      globalListenersRef.current.forEach((cb) => {
        try {
          cb(eventData);
        } catch (e) {
          console.error("Error in global product socket listener:", e);
        }
      });

      // 2. Notify product-specific subscribers
      const pid = eventData.productId || (eventData.product?.id ? Number(eventData.product.id) : undefined);
      if (pid !== undefined) {
        const set = productListenersRef.current.get(pid);
        if (set) {
          set.forEach((cb) => {
            try {
              cb(eventData);
            } catch (e) {
              console.error(`Error in product #${pid} socket listener:`, e);
            }
          });
        }
      }

      // 3. Dispatch standard browser event for any decoupled components
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("zelton:product:sync", { detail: eventData }));
      }
    };

    // Listen to real-time events from backend
    newSocket.on("product:created", (payload: any) => {
      console.log("✨ [ProductSync] product:created received:", payload);
      dispatchEvent({
        action: "created",
        productId: payload.product?.id ? Number(payload.product.id) : undefined,
        product: payload.product,
        timestamp: payload.timestamp,
      });
    });

    newSocket.on("product:updated", (payload: any) => {
      console.log("🔄 [ProductSync] product:updated received:", payload);
      dispatchEvent({
        action: "updated",
        productId: payload.productId ? Number(payload.productId) : (payload.product?.id ? Number(payload.product.id) : undefined),
        product: payload.product,
        timestamp: payload.timestamp,
      });
    });

    newSocket.on("product:stock_updated", (payload: any) => {
      console.log("📦 [ProductSync] product:stock_updated received:", payload);
      dispatchEvent({
        action: "stock_updated",
        productId: payload.productId ? Number(payload.productId) : (payload.product?.id ? Number(payload.product.id) : undefined),
        variantId: payload.variantId ? Number(payload.variantId) : undefined,
        stock: payload.stock !== undefined ? Number(payload.stock) : undefined,
        totalStock: payload.totalStock !== undefined ? Number(payload.totalStock) : undefined,
        product: payload.product,
        timestamp: payload.timestamp,
      });
    });

    newSocket.on("product:deleted", (payload: any) => {
      console.log("🗑️ [ProductSync] product:deleted received:", payload);
      dispatchEvent({
        action: "deleted",
        productId: payload.productId ? Number(payload.productId) : undefined,
        timestamp: payload.timestamp,
      });
    });

    newSocket.on("product:status_changed", (payload: any) => {
      console.log("🚦 [ProductSync] product:status_changed received:", payload);
      dispatchEvent({
        action: "status_changed",
        productId: payload.productId ? Number(payload.productId) : undefined,
        status: payload.status,
        product: payload.product,
        timestamp: payload.timestamp,
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.off("product:created");
      newSocket.off("product:updated");
      newSocket.off("product:stock_updated");
      newSocket.off("product:deleted");
      newSocket.off("product:status_changed");
      newSocket.close();
    };
  }, [user]);

  const joinProductRoom = useCallback(
    (productId: number) => {
      if (socket && isConnected) {
        socket.emit("join_product_room", { productId });
      }
    },
    [socket, isConnected]
  );

  const leaveProductRoom = useCallback(
    (productId: number) => {
      if (socket && isConnected) {
        socket.emit("leave_product_room", { productId });
      }
    },
    [socket, isConnected]
  );

  const subscribeToAll = useCallback((callback: (event: ProductEventData) => void) => {
    globalListenersRef.current.add(callback);
    return () => {
      globalListenersRef.current.delete(callback);
    };
  }, []);

  const subscribeToProduct = useCallback(
    (productId: number, callback: (event: ProductEventData) => void) => {
      if (!productListenersRef.current.has(productId)) {
        productListenersRef.current.set(productId, new Set());
      }
      productListenersRef.current.get(productId)!.add(callback);

      joinProductRoom(productId);

      return () => {
        const set = productListenersRef.current.get(productId);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            productListenersRef.current.delete(productId);
            leaveProductRoom(productId);
          }
        }
      };
    },
    [joinProductRoom, leaveProductRoom]
  );

  return (
    <ProductSyncContext.Provider
      value={{
        socket,
        isConnected,
        subscribeToProduct,
        subscribeToAll,
        joinProductRoom,
        leaveProductRoom,
      }}
    >
      {children}
    </ProductSyncContext.Provider>
  );
};

export const useProductSync = () => {
  const context = useContext(ProductSyncContext);
  if (!context) {
    throw new Error("useProductSync must be used within a ProductSyncProvider");
  }
  return context;
};
