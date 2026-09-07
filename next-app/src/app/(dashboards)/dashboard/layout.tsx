"use client";

import Sidebar from "@/components/(dashboards)/Sidebar";
import Header from "@/components/(dashboards)/Header";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import { useState, useEffect } from "react";
import { AddProductModalProvider } from "@/context/AddProductModalContext";
import AddProductSelectionModal from "@/components/(dashboards)/AddProductSelectionModal";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile); // Close sidebar on mobile, open on desktop
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <ProtectedRoute role="Admin">
      <AddProductModalProvider>
        <div className="lg:flex min-h-screen max-w-[200rem] mx-auto relative">
          {/* Backdrop for mobile */}
          {isMobile && isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1198] lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar - only render on desktop or when open on mobile */}
          {(!isMobile || isSidebarOpen) && (
            <Sidebar isOpen={isSidebarOpen} isMobile={isMobile} onClose={() => setIsSidebarOpen(false)} />
          )}

          <div className="flex-1 flex flex-col w-full min-w-0">
            <Header onToggleSidebar={toggleSidebar} />
            <main className="flex-1 pt-[10px] px-2 sm:px-5 min-w-0">
              {children}
            </main>
          </div>
        </div>

        {/* Global Smart Add Product Modal */}
        <AddProductSelectionModal />
      </AddProductModalProvider>
    </ProtectedRoute>
  );
}
