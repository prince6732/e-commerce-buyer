"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import axios from "../../utils/axios";
import { useAuth } from "./AuthContext";

export interface AppNotification {
  id: number;
  userId?: number | null;
  recipientGroup: "admin" | "customer" | "global";
  title: string;
  message: string;
  type: string;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  entityType?: string | null;
  entityId?: number | null;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  referenceKey?: string | null;
  metadata?: any;
  createdAt: string;
}

export interface NotificationPreference {
  id?: number;
  userId?: number;
  inAppOrders: boolean;
  inAppPayments: boolean;
  inAppShipping: boolean;
  inAppReturns: boolean;
  inAppProducts: boolean;
  inAppMarketing: boolean;
  emailOrders: boolean;
  emailPayments: boolean;
  emailShipping: boolean;
  emailReturns: boolean;
  emailProducts: boolean;
  emailMarketing: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  page: number;
  limit: number;
  activeToast: AppNotification | null;
  preferences: NotificationPreference | null;
  fetchNotifications: (opts?: {
    category?: string;
    priority?: string;
    is_read?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    append?: boolean;
  }) => Promise<boolean>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  bulkDeleteNotifications: (opts: { ids?: number[]; allRead?: boolean }) => Promise<void>;
  updatePreferences: (dto: Partial<NotificationPreference>) => Promise<void>;
  clearActiveToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(8);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Set of already processed notification IDs to prevent duplicate processing
  const processedIdsRef = useRef<Set<number>>(new Set());

  // Audio chime player (Web Audio API synth chime)
  const playChime = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08); // G5
      gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.08);
      osc2.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Ignore audio autoplay restrictions
    }
  }, []);

  // Fetch Notifications from REST API
  const fetchNotifications = useCallback(
    async (opts?: {
      category?: string;
      priority?: string;
      is_read?: boolean;
      page?: number;
      limit?: number;
      append?: boolean;
    }): Promise<boolean> => {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const group =
          user && ["Admin", "Manager", "superadmin", "admin"].includes((user as any).role || "")
            ? "admin"
            : "customer";

        const reqLimit = opts?.limit || 10;
        const reqPage = opts?.page || 1;

        const params = new URLSearchParams();
        params.append("recipient_group", group);
        if (opts?.category && opts.category !== "ALL") params.append("category", opts.category);
        if (opts?.priority) params.append("priority", opts.priority);
        if (opts?.is_read !== undefined) params.append("is_read", String(opts.is_read));
        if ((opts as any)?.search) params.append("search", (opts as any).search);
        params.append("page", String(reqPage));
        params.append("limit", String(reqLimit));

        const res = await axios.get(`/api/notifications?${params.toString()}`, { headers });
        if (res.data) {
          const list: AppNotification[] = res.data.notifications || res.data.data || [];
          list.forEach((n) => processedIdsRef.current.add(n.id));

          if (opts?.append) {
            setNotifications((prev) => {
              const existingIds = new Set(prev.map((n) => n.id));
              const fresh = list.filter((n) => !existingIds.has(n.id));
              return [...prev, ...fresh];
            });
          } else {
            setNotifications(list);
          }

          const unreadFromList = list.filter((n) => !n.isRead).length;
          const apiUnread = typeof res.data.unreadCount === "number" ? res.data.unreadCount : unreadFromList;
          setUnreadCount(apiUnread);

          setPage(reqPage);
          setLimit(reqLimit);

          return Boolean(
            res.data.hasNextPage ??
            res.data.has_next_page ??
            res.data.has_more ??
            (list.length >= reqLimit)
          );
        }
        return false;
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const fetchPreferences = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get("/api/notifications/preferences", { headers });
      if (res.data) {
        setPreferences(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch notification preferences:", error);
    }
  }, []);

  const updatePreferences = async (dto: Partial<NotificationPreference>) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.patch("/api/notifications/preferences", dto, { headers });
      if (res.data) {
        setPreferences(res.data);
      }
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
    }
  };

  // Socket.IO Real-time Gateway Listener
  useEffect(() => {
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001")
      .replace(/\/api\/?$/, "");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const newSocket = io(`${backendUrl}/notifications`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on("connect", () => {
      console.log("🟢 Connected to Notification Gateway:", newSocket.id);
      fetchNotifications({ page: 1, limit: 8 });
    });

    const handleNewNotification = (notification: AppNotification) => {
      if (!notification || !notification.id) return;
      if (processedIdsRef.current.has(notification.id)) return;

      processedIdsRef.current.add(notification.id);
      console.log("⚡ Real-time Notification Received:", notification);

      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });

      setUnreadCount((count) => count + 1);
      setActiveToast(notification);
      playChime();
    };

    newSocket.on("notification:new", handleNewNotification);

    newSocket.on("notification:read", (data: { id: number; unreadCount: number }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === data.id ? { ...n, isRead: true } : n))
      );
      if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
    });

    newSocket.on("notification:read-all", (data: { unreadCount: number }) => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(data.unreadCount || 0);
    });

    newSocket.on("notification:deleted", (data: { id: number; unreadCount: number }) => {
      setNotifications((prev) => prev.filter((n) => n.id !== data.id));
      if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
    });

    newSocket.on("notification:bulk-deleted", (data: { unreadCount: number }) => {
      fetchNotifications({ page: 1, limit: 8 });
      if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
    });

    newSocket.on("notification:unread-count", (data: { unreadCount: number }) => {
      setUnreadCount(data.unreadCount);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.off("notification:new");
        newSocket.off("notification:read");
        newSocket.off("notification:read-all");
        newSocket.off("notification:deleted");
        newSocket.off("notification:bulk-deleted");
        newSocket.off("notification:unread-count");
        newSocket.close();
      }
    };
  }, [user, playChime, fetchNotifications]);

  useEffect(() => {
    if (user) {
      fetchNotifications({ page: 1, limit: 8 });
      fetchPreferences();
    } else {
      // Logged out -> clear notifications & unread count immediately
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [fetchNotifications, fetchPreferences, user]);

  const clearActiveToast = () => {
    setActiveToast(null);
  };

  const markAsRead = async (id: number) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.patch(`/api/notifications/${id}/read`, {}, { headers });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const group =
        user && ["Admin", "Manager", "superadmin", "admin"].includes((user as any).role || "")
          ? "admin"
          : "customer";
      await axios.patch(`/api/notifications/read-all?recipient_group=${group}`, {}, { headers });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`/api/notifications/${id}`, { headers });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const bulkDeleteNotifications = async (opts: { ids?: number[]; allRead?: boolean }) => {
    try {
      if (opts.allRead) {
        setNotifications((prev) => prev.filter((n) => !n.isRead));
      } else if (opts.ids) {
        setNotifications((prev) => prev.filter((n) => !opts.ids!.includes(n.id)));
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post("/api/notifications/bulk-delete", opts, { headers });
      if (res.data && typeof res.data.unreadCount === "number") {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to bulk delete notifications:", error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        page,
        limit,
        activeToast,
        preferences,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        bulkDeleteNotifications,
        updatePreferences,
        clearActiveToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
