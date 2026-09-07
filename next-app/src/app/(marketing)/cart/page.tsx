"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import {
    Minus,
    Plus,
    Trash2,
    ShoppingBag,
    X,
    AlertCircle,
    AlertTriangle
} from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { getProductSlug } from "../../../../utils/slugUtils";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import { useLoader } from "@/context/LoaderContext";
const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

const CartPage = () => {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const router = useRouter();
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const {
        items,
        count,
        total,
        loading,
        hasOutOfStockItems,
        hasInsufficientStockItems,
        getItemStockStatus,
        updateQuantity,
        removeFromCart,
        clearCart
    } = useCart();
    const { showLoader, hideLoader } = useLoader();
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);
    const [itemToRemove, setItemToRemove] = useState<number | null>(null);
    const [itemToRemoveName, setItemToRemoveName] = useState<string>("");

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="text-center">
                        <ShoppingBag className="w-24 h-24 text-gray-400 mx-auto mb-6" />
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Please Login</h1>
                        <p className="text-gray-600 mb-8">You need to login to view your cart</p>
                        <button
                            onClick={() => openAuthModal('login')}
                            style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                            className="px-8 py-3 font-semibold rounded-full hover:bg-[#0066CC] hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                            Login Now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="text-center">
                        <ShoppingBag className="w-24 h-24 text-gray-400 mx-auto mb-6" />
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Your Cart is Empty</h1>
                        <p className="text-gray-600 mb-8">Add some products to get started</p>
                        <button
                            onClick={() => router.push('/')}
                            style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                            className="px-8 py-3 font-semibold rounded-full hover:bg-[#0066CC] hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                            Continue Shopping
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const handleQuantityUpdate = async (cartItemId: number, newQuantity: number) => {
        if (newQuantity < 1) return;
        showLoader();
        try {
            await updateQuantity(cartItemId, newQuantity);
            setSuccessMessage("Cart quantity updated successfully!");
        } catch (error) {
            setErrorMessage("Failed to update cart quantity. Please try again.");
        } finally {
            hideLoader();
        }
    };

    const handleRemoveItemClick = (cartItemId: number, itemName: string) => {
        setItemToRemove(cartItemId);
        setItemToRemoveName(itemName);
        setShowRemoveModal(true);
    };

    const confirmRemoveItem = async () => {
        if (itemToRemove) {
            showLoader();
            try {
                await removeFromCart(itemToRemove);
                setSuccessMessage(`${itemToRemoveName} removed from cart successfully!`);
            } catch (error) {
                setErrorMessage("Failed to remove item from cart. Please try again.");
            } finally {
                hideLoader();
            }
            setShowRemoveModal(false);
            setItemToRemove(null);
            setItemToRemoveName("");
        }
    };

    const handleClearCartClick = () => {
        setShowClearModal(true);
    };

    const confirmClearCart = async () => {
        showLoader();
        try {
            await clearCart();
            setSuccessMessage("Cart cleared successfully!");
        } catch (error) {
            setErrorMessage("Failed to clear cart. Please try again.");
        } finally {
            hideLoader();
        }
        setShowClearModal(false);
    };

    const handleCheckoutClick = () => {
        if (hasInsufficientStockItems) {
            setErrorMessage("Please remove or update out-of-stock items in your cart before proceeding to checkout.");
            return;
        }
        router.push('/checkout');
    };

    const handleSingleItemCheckout = (item: any) => {
        const status = getItemStockStatus(item);
        if (status.isUnavailable) {
            setErrorMessage(status.message || "This item is currently unavailable.");
            return;
        }
        // Navigate to single item checkout with item details
        router.push(`/checkout/single?cartItemId=${item.id}&productId=${item.product.id}&variantId=${item.variant.id}&quantity=${item.quantity}`);
    };

    return (
        <div className="min-h-screen bg-[#f3f3f3]">
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Global out-of-stock warning banner */}
                {hasInsufficientStockItems && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3 shadow-sm">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-red-900">Items in Your Cart Are Currently Unavailable</h4>
                            <p className="text-xs text-red-700 mt-1 leading-relaxed">
                                One or more items in your cart are currently out of stock or have insufficient inventory. Please remove unavailable items or adjust quantities to proceed with checkout.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-4 items-start">
                    <div className="flex-1 min-w-0">
                        <div className="bg-white rounded border border-gray-200 px-6 pt-5 pb-3 mb-3">
                            <div className="flex items-end justify-between">
                                <div>
                                    <h1 className="text-3xl font-normal text-gray-900">Shopping Cart</h1>
                                </div>
                                <span className="text-sm text-gray-500 pb-1">Price</span>
                            </div>
                            <hr className="mt-3 border-gray-200" />
                        </div>

                        <div className="bg-white rounded border border-gray-200 px-6 py-4 mb-3">
                            {items.map((item, index) => {
                                const stockInfo = getItemStockStatus(item);

                                return (
                                    <div key={item.id}>
                                        <div className={`flex gap-4 py-5 rounded-lg transition-colors ${stockInfo.isOutOfStock ? 'bg-red-50/40 p-3 -mx-3 border border-red-100' : ''}`}>
                                            <div className="flex-shrink-0">
                                                <div
                                                    className="relative cursor-pointer"
                                                    style={{ width: 160, height: 160 }}
                                                    onClick={() => router.push(`/products/${getProductSlug(item.product)}?variantId=${item.variant.id}`)}
                                                >
                                                    <Image
                                                        src={`${basePath}${item.variant?.image_url || item.product?.image_url || imgPlaceholder.src}`}
                                                        alt={item.product?.name || 'Product'}
                                                        fill
                                                        unoptimized
                                                        className={`object-contain ${stockInfo.isOutOfStock ? 'opacity-60 grayscale-[40%]' : ''}`}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h3
                                                        className="text-lg font-medium text-gray-900 line-clamp-3 cursor-pointer hover:text-[#c45500] mb-1"
                                                        onClick={() => router.push(`/products/${getProductSlug(item.product)}?variantId=${item.variant.id}`)}
                                                    >
                                                        {item.product?.name}
                                                    </h3>

                                                    <p className="text-sm text-gray-500 mb-1">
                                                        {item.variant?.title}{item.variant?.sku ? ` · SKU: ${item.variant.sku}` : ""}
                                                    </p>

                                                    {item.selected_attributes && Object.keys(item.selected_attributes).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {Object.entries(item.selected_attributes).map(([key, value]) => (
                                                                <span key={key} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                                                    {key}: {value}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Real-time Dynamic Stock Status */}
                                                    {stockInfo.isOutOfStock ? (
                                                        <div className="mb-2">
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-md border border-red-200">
                                                                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                                                Out of Stock
                                                            </span>
                                                            <p className="text-xs text-red-600 font-medium mt-1">
                                                                {stockInfo.message || "This product is currently out of stock."}
                                                            </p>
                                                        </div>
                                                    ) : stockInfo.isInsufficientStock ? (
                                                        <div className="mb-2">
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200">
                                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                                                                Insufficient Stock
                                                            </span>
                                                            <p className="text-xs text-amber-700 font-medium mt-1">
                                                                {stockInfo.message}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="text-sm text-green-700 font-medium mb-1">In stock</p>
                                                            <p className="text-sm text-gray-700 mb-3">
                                                                <span className="font-medium">FREE delivery</span> available
                                                            </p>
                                                        </>
                                                    )}

                                                    <div className="flex items-center gap-0 mb-3 mt-1">
                                                        <div className="flex items-center border border-gray-300 rounded bg-gray-50">
                                                            <button
                                                                onClick={() => handleQuantityUpdate(item.id, item.quantity - 1)}
                                                                disabled={item.quantity <= 1 || loading}
                                                                className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed border-r border-gray-300 transition-colors"
                                                            >
                                                                <Minus className="w-3 h-3" />
                                                            </button>
                                                            <span className="w-10 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                                                            <button
                                                                onClick={() => handleQuantityUpdate(item.id, item.quantity + 1)}
                                                                disabled={item.quantity >= stockInfo.availableStock || stockInfo.availableStock <= 0 || loading}
                                                                className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed border-l border-gray-300 transition-colors"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <span className={`text-xs ml-2 ${stockInfo.isOutOfStock ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                                            {stockInfo.availableStock} available
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center flex-wrap gap-x-0 text-sm">
                                                        <button
                                                            onClick={() => handleRemoveItemClick(item.id, item.product?.name || 'Item')}
                                                            disabled={loading}
                                                            className="text-[#007185] hover:text-[#c45500] hover:underline disabled:opacity-50 transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                        <span className="text-gray-300 mx-2">|</span>
                                                        <button
                                                            onClick={() => handleSingleItemCheckout(item)}
                                                            disabled={loading || stockInfo.isUnavailable}
                                                            className={`text-[#007185] hover:text-[#c45500] hover:underline transition-colors ${stockInfo.isUnavailable ? 'opacity-40 cursor-not-allowed line-through text-gray-400' : ''}`}
                                                        >
                                                            Buy this now
                                                        </button>
                                                        <span className="text-gray-300 mx-2">|</span>
                                                        <button
                                                            onClick={() => router.push(`/products/${getProductSlug(item.product)}?variantId=${item.variant.id}`)}
                                                            className="text-[#007185] hover:text-[#c45500] hover:underline transition-colors"
                                                        >
                                                            See more like this
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="text-right flex-shrink-0 sm:min-w-[90px]">
                                                    <p className="text-lg font-bold text-gray-900">₹{item.total}</p>
                                                    <p className="text-xs text-gray-500">₹{item.price} × {item.quantity}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {index < items.length - 1 && <hr className="border-gray-200" />}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-white rounded border border-gray-200 px-6 py-4 text-right">
                            <p className="text-lg">
                                Subtotal ({count} {count === 1 ? 'item' : 'items'}):&nbsp;
                                <span className="font-bold text-gray-900">₹{total}</span>
                            </p>
                        </div>

                        <div className="mt-3 text-right">
                            <button
                                onClick={handleClearCartClick}
                                className="text-sm text-[#007185] hover:text-[#c45500] hover:underline flex items-center gap-1 ml-auto"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear entire cart
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                            The price and availability of items are subject to change. The shopping cart is a temporary place to store items and reflects each item&apos;s most recent price and real-time inventory.
                        </p>
                    </div>

                    <div className="w-full lg:w-72 flex-shrink-0 sticky top-4">
                        <div className="bg-white rounded border border-gray-200 p-5">
                            <p className="text-lg mb-3">
                                Subtotal ({count} {count === 1 ? 'item' : 'items'}):&nbsp;
                                <span className="font-bold text-gray-900">₹{total}</span>
                            </p>

                            <div className="flex justify-between text-sm text-gray-600 mb-4">
                                <span>Shipping</span>
                                <span className="text-green-700 font-medium">FREE</span>
                            </div>

                            <hr className="border-gray-200 mb-4" />

                            <div className="flex justify-between font-bold text-gray-900 text-base mb-4">
                                <span>Order Total</span>
                                <span>₹{total}</span>
                            </div>

                            {/* Warning message inside order summary box */}
                            {hasInsufficientStockItems && (
                                <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                    <span>Checkout is disabled because one or more items are out of stock or have insufficient inventory.</span>
                                </div>
                            )}

                            <button
                                onClick={handleCheckoutClick}
                                disabled={loading || items.length === 0 || hasInsufficientStockItems}
                                style={{
                                    backgroundColor: hasInsufficientStockItems ? '#9CA3AF' : 'var(--theme-blue)',
                                    color: '#FFFAFB'
                                }}
                                className="w-full py-2.5 text-sm font-medium rounded-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:bg-[#0066CC] active:brightness-95"
                            >
                                {hasInsufficientStockItems ? 'Unavailable Items in Cart' : 'Proceed to Checkout'}
                            </button>

                            <button
                                onClick={() => router.push('/')}
                                className="w-full mt-3 py-2.5 text-sm font-medium rounded-full border border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100 transition-colors duration-200"
                            >
                                Continue Shopping
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showRemoveModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">

                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Remove Item</h3>
                            <button
                                onClick={() => setShowRemoveModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to remove <span className="font-semibold">"{itemToRemoveName}"</span> from your cart?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowRemoveModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRemoveItem}
                                disabled={loading}
                                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showClearModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Clear Cart</h3>
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to clear your entire cart? This action cannot be undone and all {count} items will be removed.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmClearCart}
                                disabled={loading}
                                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                            >
                                Clear Cart
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartPage;