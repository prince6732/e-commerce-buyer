

"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getUser, logout as apiLogout } from "../../utils/auth";
import { User } from "@/common/interface";
import AuthModal from "@/components/(frontend)/AuthModal";

export type AuthModalMode = "login" | "register" | "forgot-password" | "reset-password" | "email-verify";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  setUserDirectly: (user: User) => void;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  authModalEmail: string;
  openAuthModal: (mode?: AuthModalMode, email?: string) => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
  setAuthModalEmail: (email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>("login");
  const [authModalEmail, setAuthModalEmail] = useState<string>("");

  const openAuthModal = (mode: AuthModalMode = "login", email: string = "") => {
    setAuthModalMode(mode);
    if (email) setAuthModalEmail(email);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const refetchUser = async () => {
    try {
      const response = await getUser();
      if (response?.data?.user) {
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      } else {
        // User not found in database -> logout automatically
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    } catch {
      // User not found in database or token invalid -> logout automatically
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore API failure
    }
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const setUserDirectly = (user: User) => {
    setUser(user);
    localStorage.setItem("user", JSON.stringify(user));
    setLoading(false);
  };

  useEffect(() => {
    // Restore from localStorage first
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    const token = localStorage.getItem("token");
    if (token) {
      refetchUser();
    } else {
      setLoading(false);
    }

    const handleAuthLogout = () => {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token" && !e.newValue) {
        setUser(null);
      }
    };

    window.addEventListener("auth:logout", handleAuthLogout);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("auth:logout", handleAuthLogout);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        refetchUser,
        setUserDirectly,
        isAuthModalOpen,
        authModalMode,
        authModalEmail,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        setAuthModalEmail,
      }}
    >
      {children}
      <AuthModal />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};


