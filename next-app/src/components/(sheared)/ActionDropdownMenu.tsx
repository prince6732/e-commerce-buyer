"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MoreVertical, Loader2 } from 'lucide-react';

export interface ActionMenuItem {
  key?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
}

interface ActionDropdownMenuProps {
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  triggerIcon?: React.ComponentType<{ className?: string }>;
  triggerClassName?: string;
  ariaLabel?: string;
}

export default function ActionDropdownMenu({
  items,
  align = 'right',
  triggerIcon: TriggerIcon = MoreVertical,
  triggerClassName,
  ariaLabel = 'Action menu',
}: ActionDropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Filter visible items
  const visibleItems = items.filter(item => !item.hidden);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update fixed menu positioning based on trigger button bounding rect
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < 220 && rect.top > 220;

      const style: React.CSSProperties = {
        position: 'fixed',
        zIndex: 99999,
        width: '12rem', // 192px / w-48
      };

      if (openUpwards) {
        style.bottom = `${window.innerHeight - rect.top + 6}px`;
      } else {
        style.top = `${rect.bottom + 6}px`;
      }

      if (align === 'right') {
        style.right = `${window.innerWidth - rect.right}px`;
      } else {
        style.left = `${rect.left}px`;
      }

      setMenuStyle(style);
    }
  };

  const toggleOpen = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close menu on click outside, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  if (visibleItems.length === 0) return null;

  const getItemVariantClasses = (variant?: ActionMenuItem['variant']) => {
    switch (variant) {
      case 'primary':
        return 'text-blue-600 hover:bg-blue-50 hover:text-blue-700';
      case 'success':
        return 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700';
      case 'warning':
        return 'text-amber-600 hover:bg-amber-50 hover:text-amber-700';
      case 'info':
        return 'text-purple-600 hover:bg-purple-50 hover:text-purple-700';
      case 'danger':
        return 'text-rose-600 hover:bg-rose-50 hover:text-rose-700';
      default:
        return 'text-gray-700 hover:bg-gray-100 hover:text-gray-900';
    }
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      style={menuStyle}
      className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="py-1 divide-y divide-gray-100">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const variantClasses = getItemVariantClasses(item.variant);

          const content = (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold">
              {item.loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
              ) : Icon ? (
                <Icon className="w-4 h-4 shrink-0" />
              ) : null}
              <span className="truncate">{item.label}</span>
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={item.key || index}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`block w-full transition-colors cursor-pointer ${variantClasses} ${item.disabled ? 'opacity-50 pointer-events-none' : ''
                  }`}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.key || index}
              type="button"
              disabled={item.disabled || item.loading}
              onClick={() => {
                if (item.onClick) item.onClick();
                setIsOpen(false);
              }}
              className={`w-full text-left transition-colors cursor-pointer ${variantClasses} ${item.disabled || item.loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="inline-block text-left">
      {/* 3-Dot Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label={ariaLabel}
        className={
          triggerClassName ||
          `p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer flex items-center justify-center ${isOpen ? 'bg-gray-100 ring-2 ring-[#ff9903]/30 text-gray-900 border-gray-300' : ''
          }`
        }
      >
        <TriggerIcon className="w-4 h-4" />
      </button>

      {/* Render popover via React Portal directly into body to bypass table overflow clipping */}
      {isOpen && mounted ? createPortal(popoverContent, document.body) : null}
    </div>
  );
}

