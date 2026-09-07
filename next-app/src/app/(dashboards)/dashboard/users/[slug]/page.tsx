"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLoader } from "@/context/LoaderContext";
import {
    FaArrowLeft,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaCalendar,
    FaShoppingBag,
    FaStar,
    FaHeart,
    FaRupeeSign,
    FaBan,
    FaCheckCircle,
    FaChevronDown,
    FaChevronUp
} from "react-icons/fa";
import Image from "next/image";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import Modal from "@/components/(sheared)/Modal";
import {
    getUserDetails,
    toggleUserStatus,
    User,
    UserStats,
    UserOrder,
    UserReview,
    LikedProduct
} from "../../../../../../utils/userApi";

export default function UserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { showLoader, hideLoader } = useLoader();
    const userId = (params?.slug || params?.id || "") as string;
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [orders, setOrders] = useState<UserOrder[]>([]);
    const [reviews, setReviews] = useState<UserReview[]>([]);
    const [likedProducts, setLikedProducts] = useState<LikedProduct[]>([]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

    const uploadUrl = `${process.env.NEXT_PUBLIC_UPLOAD_BASE}` || "https://api.zelton.co.in";

    useEffect(() => {
        if (userId) {
            fetchUserDetails();
        }
    }, [userId]);

    const fetchUserDetails = async () => {
        showLoader();
        try {
            const response = await getUserDetails(userId);
            setUser(response.user);
            setStats(response.stats);
            setOrders(response.recent_orders);
            setReviews(response.recent_reviews);
            setLikedProducts(response.liked_products);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load user details");
        } finally {
            hideLoader();
        }
    };

    const handleToggleStatus = async () => {
        if (!user) return;

        showLoader();
        try {
            const response = await toggleUserStatus(user.id);
            setSuccessMessage(response.message);
            setIsBlockModalOpen(false);
            fetchUserDetails(); // Refresh data
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to update user status");
        } finally {
            hideLoader();
        }
    };

    const toggleOrder = (orderId: number) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
        } else {
            setExpandedOrderId(orderId);
        }
    };

    const getImageUrl = (imagePath: string | null) => {
        if (!imagePath) return null;
        const cleanBase = uploadUrl.replace(/\/+$/, "");
        const cleanPath = imagePath.replace(/^\/+/, "").replace(/\\/g, "/");
        return `${cleanBase}/${cleanPath}`;
    };

    const getUserImageUrl = (imagePath: string | null) => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        const cleanBase = uploadUrl.replace(/\/+$/, "");
        const cleanPath = imagePath.replace(/^\/+/, "").replace(/\\/g, "/");
        return `${cleanBase}/storage/${cleanPath}`;
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Loading user details...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-3 md:p-6">
            {errorMessage && (
                <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
            )}
            {successMessage && (
                <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />
            )}

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">User Details</h1>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition cursor-pointer"
                    >
                        <FaArrowLeft />
                        <span>Back</span>
                    </button>
                </div>

                {/* User Info Card */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Profile Picture */}
                    <div className="flex-shrink-0">
                        {user.profile_picture ? (
                            <Image
                                src={getUserImageUrl(user.profile_picture) || ''}
                                alt={user.name}
                                width={150}
                                height={150}
                                className="rounded-full object-cover border-4 border-gray-200"
                                unoptimized
                            />
                        ) : (
                            <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl md:text-5xl font-bold">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* User Details */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                                <p className="text-sm text-gray-500">User ID: #{user.id}</p>
                            </div>
                            <div className="flex gap-2">
                                {user.status ? (
                                    <span className="px-4 py-2 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-2">
                                        <FaCheckCircle />
                                        Active
                                    </span>
                                ) : (
                                    <span className="px-4 py-2 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-2">
                                        <FaBan />
                                        Blocked
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 text-gray-700">
                                <FaEnvelope className="text-blue-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="font-medium">{user.email}</p>
                                </div>
                            </div>

                            {user.phone_number && (
                                <div className="flex items-center gap-3 text-gray-700">
                                    <FaPhone className="text-green-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Phone</p>
                                        <p className="font-medium">{user.phone_number}</p>
                                    </div>
                                </div>
                            )}

                            {user.address && (
                                <div className="flex items-center gap-3 text-gray-700">
                                    <FaMapMarkerAlt className="text-red-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Address</p>
                                        <p className="font-medium">{user.address}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 text-gray-700">
                                <FaCalendar className="text-purple-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Member Since</p>
                                    <p className="font-medium">{stats?.member_since}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={() => setIsBlockModalOpen(true)}
                                className={`px-6 py-2.5 rounded-lg font-medium transition cursor-pointer ${user.status
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                            >
                                {user.status ? 'Block User' : 'Unblock User'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Orders</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total_orders}</p>
                            </div>
                            <FaShoppingBag className="text-3xl text-blue-500" />
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Reviews</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total_reviews}</p>
                            </div>
                            <FaStar className="text-3xl text-yellow-500" />
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Wishlist Items</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total_likes}</p>
                            </div>
                            <FaHeart className="text-3xl text-red-500" />
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Spent</p>
                                <p className="text-2xl font-bold text-gray-900">₹{stats.total_spent.toFixed(2)}</p>
                            </div>
                            <FaRupeeSign className="text-2xl text-green-500" />
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Orders */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Orders ({orders.length})</h3>
                {orders.length > 0 ? (
                    <div className="overflow-x-auto pb-2 scrollbar">
                        <table className="w-full min-w-[600px] text-sm">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                                <tr>
                                    <th className="px-4 py-3 text-left">Order #</th>
                                    <th className="px-4 py-3 text-left">Date</th>
                                    <th className="px-4 py-3 text-left">Items</th>
                                    <th className="px-4 py-3 text-left">Amount</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Payment</th>
                                    <th className="px-4 py-3 text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {orders.map((order) => (
                                    <React.Fragment key={order.id}>
                                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleOrder(order.id)}>
                                            <td className="px-4 py-3 font-medium">{order.order_number}</td>
                                            <td className="px-4 py-3">{order.formatted_date}</td>
                                            <td className="px-4 py-3">{order.items_count}</td>
                                            <td className="px-4 py-3 font-semibold">₹{order.total_amount}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs ${order.payment_status === 'paid'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {order.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button className="text-gray-500 hover:text-gray-700 cursor-pointer">
                                                    {expandedOrderId === order.id ? <FaChevronUp /> : <FaChevronDown />}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedOrderId === order.id && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={7} className="px-4 py-4">
                                                    <div className="space-y-3">
                                                        <h4 className="font-semibold text-gray-700 text-xs uppercase">Order Items</h4>
                                                        <div className="grid gap-3">
                                                            {order.items?.map((item) => (
                                                                <div key={item.id} className="flex items-center gap-4 bg-white p-3 rounded border border-gray-200">
                                                                    {item.product_image && (
                                                                        <Image
                                                                            src={getImageUrl(item.product_image) || ''}
                                                                            alt={item.product_name}
                                                                            width={50}
                                                                            height={50}
                                                                            className="rounded object-cover"
                                                                            unoptimized
                                                                        />
                                                                    )}
                                                                    <div className="flex-1">
                                                                        <p className="font-medium text-gray-900">{item.product_name}</p>
                                                                        <p className="text-sm text-gray-500">Qty: {item.quantity} × ₹{item.price}</p>
                                                                    </div>
                                                                    <p className="font-semibold text-gray-900">₹{item.total}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No orders yet</p>
                )}
            </div>

            {/* Recent Reviews */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Reviews ({reviews.length})</h3>
                {reviews.length > 0 ? (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start gap-4">
                                    {review.product_image && (
                                        <Image
                                            src={getImageUrl(review.product_image) || ''}
                                            alt={review.product_name}
                                            width={60}
                                            height={60}
                                            className="rounded object-cover"
                                            unoptimized
                                        />
                                    )}
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-900">{review.product_name}</h4>
                                        <div className="flex items-center gap-2 my-1">
                                            <div className="flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                                                <span>{review.rating}</span>
                                                <FaStar />
                                            </div>
                                            <span className="text-xs text-gray-500">{review.formatted_date}</span>
                                        </div>
                                        {review.title && (
                                            <p className="font-medium text-sm text-gray-800 mt-2">{review.title}</p>
                                        )}
                                        {review.review_text && (
                                            <p className="text-sm text-gray-600 mt-1">{review.review_text}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className={`text-xs px-2 py-1 rounded ${review.is_approved
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {review.is_approved ? 'Approved' : 'Pending'}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {review.helpful_count} helpful
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No reviews yet</p>
                )}
            </div>

            {/* Liked Products */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Wishlist ({likedProducts.length})</h3>
                {likedProducts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {likedProducts.map((product) => (
                            <div key={product.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
                                {product.image_url && (
                                    <Image
                                        src={getImageUrl(product.image_url) || ''}
                                        alt={product.name}
                                        width={120}
                                        height={120}
                                        className="w-full h-32 object-cover rounded mb-2"
                                        unoptimized
                                    />
                                )}
                                <h4 className="text-sm font-medium text-gray-900 truncate">{product.name}</h4>
                                <p className="text-sm font-bold text-blue-600">₹{product.price}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No liked products yet</p>
                )}
            </div>

            {/* Block/Unblock Modal */}
            <Modal
                width="max-w-md"
                isOpen={isBlockModalOpen}
                onClose={() => setIsBlockModalOpen(false)}
                title={user.status ? "Block User" : "Unblock User"}
            >
                <div className="space-y-4 p-4">
                    <p className="text-gray-700">
                        Are you sure you want to {user.status ? 'block' : 'unblock'}{' '}
                        <span className="font-semibold">{user.name}</span>?
                    </p>

                    {user.status && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-sm text-yellow-800 font-medium">⚠️ This will:</p>
                            <ul className="text-sm text-yellow-700 mt-2 ml-4 list-disc">
                                <li>Log them out immediately</li>
                                <li>Prevent them from logging in</li>
                                <li>Revoke all their active sessions</li>
                            </ul>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setIsBlockModalOpen(false)}
                            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            className={`px-4 py-2 rounded-lg transition text-white cursor-pointer ${user.status
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-green-500 hover:bg-green-600'
                                }`}
                        >
                            {user.status ? 'Block User' : 'Unblock User'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
