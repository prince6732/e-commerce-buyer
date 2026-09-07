"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  LayoutDashboard,
  Users,
  FolderTree,
  Images,
  Tag,
  Layers,
  Palette,
  Mail,
  Package,
  Settings,
  Sparkles,
  Bell,
  FileSpreadsheet,
  RotateCcw,
  Undo2,
  Megaphone,
  MapPin,
  CircleDollarSign,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import logoText from "@/public/ZeltonHorizontalBlack.png";
import logo from "@/public/ZeltonIconBlack.png";

// 🔹 Grouped nav links
const navSections = [
  {
    title: "Overview",
    links: [
      { href: "/", label: "Home", icon: Home, roles: ["Admin"] },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin"] },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell, roles: ["Admin"] },
    ]
  },
  {
    title: "Sales",
    links: [
      { href: "/dashboard/orders", label: "Orders", icon: FolderTree, roles: ["Admin"] },
      { href: "/dashboard/returns", label: "Returns & Exchanges", icon: RotateCcw, roles: ["Admin"] },
      { href: "/dashboard/rto-orders", label: "RTO & NDR Orders", icon: Undo2, roles: ["Admin"] },
      { href: "/dashboard/sales-summary", label: "Financial & Sales", icon: CircleDollarSign, roles: ["Admin"] },
      { href: "/dashboard/users", label: "Customers", icon: Users, roles: ["Admin"] },
      { href: "/dashboard/contact-messages", label: "Contact Messages", icon: Mail, roles: ["Admin"] },
      { href: "/dashboard/gst-report", label: "GST Report", icon: FileSpreadsheet, roles: ["Admin"] },
    ]
  },
  {
    title: "Catalog",
    links: [
      { href: "/dashboard/products", label: "Products", icon: Package, roles: ["Admin"] },
      { href: "/dashboard/categories", label: "Categories", icon: FolderTree, roles: ["Admin"] },
      { href: "/dashboard/brands", label: "Brands", icon: Tag, roles: ["Admin"] },
      { href: "/dashboard/attributes", label: "Attributes", icon: Layers, roles: ["Admin"] },
    ]
  },
  {
    title: "Marketing",
    links: [
      { href: "/dashboard/topbar-announcements", label: "Topbar Management", icon: Megaphone, roles: ["Admin"] },
      { href: "/dashboard/sliders", label: "Sliders", icon: Images, roles: ["Admin"] },
      { href: "/dashboard/new-arrival-sliders", label: "New Arrival Posters", icon: Sparkles, roles: ["Admin"] },
    ]
  },
  {
    title: "System",
    links: [
      { href: "/dashboard/locations", label: "States & Cities", icon: MapPin, roles: ["Admin"] },
      { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["Admin"] },
    ]
  }
];

interface SidebarProps {
  isOpen: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, isMobile = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.role || "Visitor";

  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`transition-all duration-300 ease-in-out z-[1199]
        ${isMobile
          ? `fixed left-0 top-0 h-screen ps-2 ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-[260px]`
          : `sticky top-0 ps-2 ${isOpen ? "w-[260px]" : "w-[4.9375rem]"} h-screen`
        } 
        text-gray-800 flex flex-col justify-between 
       `}
    >
      {/* Logo */}
      <div
        className={`flex items-center px-4 py-3 rounded-2xl border border-gray-200 bg-white shadow-sm mt-2 
    ${isOpen || isMobile ? "justify-center" : "justify-center"}`}
      >
        <Link href="/" className="logo italic font-bold h-[1.5rem] text-4xl text-gray-800 flex items-center">
          {(isOpen || isMobile) ? (
            <Image src={logoText} unoptimized alt="Logo Text" className="h-[1.5rem] w-auto object-contain" />
          ) : (
            <Image src={logo} unoptimized alt="Logo Icon" className="h-[2rem] w-auto object-contain" />
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="my-2 flex-1 overflow-y-auto scrollHide rounded-2xl border border-gray-200 bg-white p-2 shadow-sm space-y-3">
        {navSections.map((section) => {
          const validLinks = section.links.filter(
            (link) => userRole === "Admin" || link.roles.includes(userRole)
          );
          if (validLinks.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              {(isOpen || isMobile) && (
                <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                  {section.title}
                </p>
              )}
              {validLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== '/' && href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <Link key={href} href={href} className="block" onClick={handleLinkClick}>
                    <div
                      className={`flex items-center py-2 rounded-xl cursor-pointer transition-all duration-200
                        ${isOpen || isMobile ? "justify-between px-3" : "justify-center px-3 py-2.5"} 
                        ${isActive
                          ? "bg-[#eff6ff] border-l-4 border-[#007FFF] text-[#007FFF] font-semibold shadow-xs"
                          : "text-gray-700 hover:bg-gray-50 hover:text-[#007FFF]"
                        }`}
                      title={!isOpen && !isMobile ? label : undefined}
                    >
                      <div className="flex items-center flex-1">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span
                          className={`text-sm text-nowrap transition-all duration-300 overflow-hidden 
                            ${isOpen || isMobile ? "ml-3 w-auto" : "w-0 hidden"}`}
                        >
                          {label}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer - Optional branding or info */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm mb-2 p-3">
        <div className="flex items-center justify-center">
          <p className={`text-xs text-gray-500 transition-all duration-300 ${isOpen || isMobile ? "block" : "hidden"}`}>
            © 2025 Admin Panel
          </p>
        </div>
      </div>
    </aside>
  );
}
