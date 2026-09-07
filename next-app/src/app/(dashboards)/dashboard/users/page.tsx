"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import React from "react";
import { useLoader } from "@/context/LoaderContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    FaArrowLeft,
    FaSearch,
    FaEye,
    FaBan,
    FaCheckCircle
} from "react-icons/fa";
import { Loader2, Check } from "lucide-react";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import Modal from "@/components/(sheared)/Modal";
import {
    getAllUsers,
    toggleUserStatus,
    User
} from "../../../../../utils/userApi";
import { getUserSlug } from "../../../../../utils/slugUtils";

const PAGE_SIZE = 10;

function Users() {
    const [users, setUsers] = useState<User[]>([]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { showLoader, hideLoader } = useLoader();
    const router = useRouter();

    // Infinite scroll & user list state
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalUsers, setTotalUsers] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Filter & search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
    const [isSearching, setIsSearching] = useState(false);

    // Modal state
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [userToToggle, setUserToToggle] = useState<User | null>(null);

    const uploadUrl = (`${process.env.NEXT_PUBLIC_UPLOAD_BASE}/storage`) || "https://api.zelton.co.in/storage";

    // Debounce search query
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Auto-dismiss alert toasts
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Fetch users from API
    const loadUsers = async (pageNum: number, search: string = "", status: 'all' | 'active' | 'blocked' = 'all', isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const response = await getAllUsers({
                page: pageNum,
                per_page: PAGE_SIZE,
                search: search || undefined,
                status: status,
                sort_by: 'created_at',
                sort_order: 'desc'
            });

            const list: User[] = response?.users?.data || [];
            const pag = response?.users;
            const total = pag?.total ?? list.length;
            const hasNext = Boolean(
                (pag as any)?.has_next_page ??
                (pag as any)?.hasNextPage ??
                (pag as any)?.has_more ??
                (pag?.last_page ? pageNum < pag.last_page : list.length >= PAGE_SIZE)
            );

            setTotalUsers(total);
            setHasNextPage(hasNext);
            setPage(pageNum);

            if (isAppend) {
                setUsers((prev) => {
                    const existingIds = new Set(prev.map((u) => u.id));
                    const newUnique = list.filter((u) => !existingIds.has(u.id));
                    return [...prev, ...newUnique];
                });
            } else {
                setUsers(list);
            }
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.message || "Failed to load users");
            if (!isAppend) setUsers([]);
            setHasNextPage(false);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
            setIsSearching(false);
        }
    };

    // Trigger initial fetch / reset on filter or debounced search query change
    useEffect(() => {
        setPage(1);
        setHasNextPage(true);
        loadUsers(1, debouncedSearchQuery, statusFilter, false);
    }, [debouncedSearchQuery, statusFilter]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        loadUsers(page + 1, debouncedSearchQuery, statusFilter, true);
    }, [hasNextPage, isLoadingMore, isLoadingInitial, page, debouncedSearchQuery, statusFilter]);

    // Observer for bottom sentinel
    useEffect(() => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0];
                if (target.isIntersecting) {
                    loadNextPage();
                }
            },
            {
                root: null,
                rootMargin: "300px",
                threshold: 0.1,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadNextPage]);

    const handleToggleStatus = (user: User) => {
        setUserToToggle(user);
        setIsBlockModalOpen(true);
    };

    const confirmToggleStatus = async () => {
        if (!userToToggle) return;

        showLoader();
        try {
            const response = await toggleUserStatus(userToToggle.id);
            setSuccessMessage(response.message);
            setIsBlockModalOpen(false);
            // In-place update
            setUsers((prev) =>
                prev.map((u) => (u.id === userToToggle.id ? { ...u, status: !u.status } : u))
            );
            setUserToToggle(null);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to update user status");
        } finally {
            hideLoader();
        }
    };

    const viewUserDetails = (user: User) => {
        const slug = getUserSlug(user);
        router.push(`/dashboard/users/${slug}`);
    };

    return (
        <div className="z-[999] p-3 md:p-6">
            {errorMessage && (
                <ErrorMessage
                    message={errorMessage}
                    onClose={() => setErrorMessage(null)}
                />
            )}
            {successMessage && (
                <SuccessMessage
                    message={successMessage}
                    onClose={() => setSuccessMessage(null)}
                />
            )}

            <div>
                {/* Header Controls (Title, Search, Filter, Back in a Single Line on Desktop) */}
                <div className="p-3 pb-3 md:p-5 md:pb-4 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-md mb-4 md:mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Title */}
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight flex items-baseline gap-2 flex-shrink-0">
                                User Management
                            </h2>
                            {totalUsers > 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {users.length} of {totalUsers}
                                </span>
                            )}
                        </div>

                        {/* Controls Group */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            {/* Search Input */}
                            <div className="relative flex-grow sm:flex-grow-0 sm:w-[360px]">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                    <FaSearch className="text-sm" />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search users by name, email, phone..."
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition"
                                />
                                {isSearching ? (
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#007FFF]" />
                                    </div>
                                ) : searchQuery ? (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                ) : null}
                            </div>

                            {/* Status Filter Dropdown */}
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value as "all" | "active" | "blocked")
                                }
                                className="px-3.5 py-2.5 rounded-xl text-sm border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition cursor-pointer flex-shrink-0"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="blocked">Blocked</option>
                            </select>

                            {/* Back Button */}
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm shadow-sm transition duration-200 flex-shrink-0 cursor-pointer font-semibold"
                            >
                                <FaArrowLeft className="text-xs" />
                                <span>Back</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[700px] text-sm text-left">
                        <thead className="bg-gray-50 uppercase text-xs font-semibold text-gray-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Phone Number</th>
                                <th className="px-6 py-4">Image</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-end">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 text-gray-700">
                            {isLoadingInitial && users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                            <span className="text-sm font-medium text-gray-500">Loading users...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length ? (
                                users.map((user, index) => {
                                    let primaryUrl: string | null = null;
                                    if (user.profile_picture) {
                                        if (user.profile_picture.startsWith('http://') || user.profile_picture.startsWith('https://')) {
                                            primaryUrl = user.profile_picture;
                                        } else {
                                            const cleanBase = uploadUrl.replace(/\/+$/, "");
                                            const cleanPath = user.profile_picture
                                                .replace(/^\/+/, "")
                                                .replace(/\\/g, "/");
                                            const fullUrl = `${cleanBase}/${cleanPath}`;

                                            try {
                                                new URL(fullUrl);
                                                primaryUrl = fullUrl;
                                            } catch {
                                                console.warn("Invalid image URL:", fullUrl);
                                                primaryUrl = null;
                                            }
                                        }
                                    }

                                    return (
                                        <tr
                                            key={user.id}
                                            className="bg-white hover:bg-blue-50/30 transition"
                                        >
                                            <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-4 font-semibold max-w-[200px] break-all whitespace-normal text-gray-900">{user.name}</td>
                                            <td className="px-6 py-4 max-w-[250px] break-all whitespace-normal font-medium text-gray-600">{user.email}</td>
                                            <td className="px-6 py-4 max-w-[150px] break-all whitespace-normal text-gray-600">{user.phone_number || '—'}</td>

                                            <td className="px-6 py-4">
                                                {primaryUrl ? (
                                                    <Image
                                                        src={primaryUrl}
                                                        alt={user.name || "User"}
                                                        width={44}
                                                        height={44}
                                                        className="h-11 w-11 object-cover rounded-full border border-gray-200"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-11 h-11 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm border border-blue-200">
                                                        {user.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                {user.status ? (
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                                        Blocked
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition flex items-center gap-1.5 cursor-pointer"
                                                        onClick={() => viewUserDetails(user)}
                                                    >
                                                        <FaEye />
                                                        <span>View</span>
                                                    </button>
                                                    <button
                                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${user.status
                                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            }`}
                                                        onClick={() => handleToggleStatus(user)}
                                                    >
                                                        {user.status ? (
                                                            <>
                                                                <FaBan />
                                                                <span>Block</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FaCheckCircle />
                                                                <span>Unblock</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="text-center text-gray-500 py-16"
                                    >
                                        <p className="font-semibold text-gray-700">No users found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                    {isLoadingInitial && users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading users...</span>
                        </div>
                    ) : users.length ? (
                        users.map((user, index) => {
                            let primaryUrl: string | null = null;
                            if (user.profile_picture) {
                                if (user.profile_picture.startsWith('http://') || user.profile_picture.startsWith('https://')) {
                                    primaryUrl = user.profile_picture;
                                } else {
                                    const cleanBase = uploadUrl.replace(/\/+$/, "");
                                    const cleanPath = user.profile_picture
                                        .replace(/^\/+/, "")
                                        .replace(/\\/g, "/");
                                    const fullUrl = `${cleanBase}/${cleanPath}`;

                                    try {
                                        new URL(fullUrl);
                                        primaryUrl = fullUrl;
                                    } catch {
                                        console.warn("Invalid image URL:", fullUrl);
                                        primaryUrl = null;
                                    }
                                }
                            }

                            return (
                                <div
                                    key={user.id}
                                    className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                                >
                                    <div className="flex items-start gap-4 mb-4">
                                        {primaryUrl ? (
                                            <Image
                                                src={primaryUrl}
                                                alt={user.name || "User"}
                                                width={52}
                                                height={52}
                                                className="h-13 w-13 object-cover rounded-full border border-gray-200"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-13 h-13 bg-gradient-to-br from-[#007FFF] to-[#0055CC] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                {user.name?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-1">
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{user.name}</h3>
                                                    <p className="text-xs text-gray-400 font-semibold">#{index + 1}</p>
                                                </div>
                                                {user.status ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                                        Blocked
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 mb-0.5 break-all">{user.email}</p>
                                            <p className="text-xs text-gray-500">{user.phone_number || 'No phone'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                                        <button
                                            className="flex-1 px-3 py-2 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition flex items-center justify-center gap-1.5 font-semibold cursor-pointer"
                                            onClick={() => viewUserDetails(user)}
                                        >
                                            <FaEye />
                                            <span>View</span>
                                        </button>
                                        <button
                                            className={`flex-1 px-3 py-2 text-xs rounded-lg transition flex items-center justify-center gap-1.5 font-semibold cursor-pointer ${user.status
                                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                }`}
                                            onClick={() => handleToggleStatus(user)}
                                        >
                                            {user.status ? (
                                                <>
                                                    <FaBan />
                                                    <span>Block</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FaCheckCircle />
                                                    <span>Unblock</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                            <p className="text-gray-500 font-medium">No users found</p>
                        </div>
                    )}
                </div>

                {/* Bottom Sentinel for Infinite Scroll */}
                <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

                {/* Infinite Scroll Bottom Loading State */}
                {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                        <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                        <span className="font-semibold text-gray-700">Loading more users...</span>
                    </div>
                )}

                {/* All Users Loaded End Indicator */}
                {!hasNextPage && users.length > 0 && !isLoadingInitial && (
                    <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                        <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>All {users.length} users loaded</span>
                        </span>
                    </div>
                )}
            </div>

            {/* Block/Unblock Confirmation Modal */}
            <Modal
                width="max-w-md"
                isOpen={isBlockModalOpen}
                onClose={() => {
                    setIsBlockModalOpen(false);
                    setUserToToggle(null);
                }}
                title={userToToggle?.status ? "Block User" : "Unblock User"}
            >
                <div className="space-y-4 p-4">
                    <p className="text-gray-700 text-sm">
                        Are you sure you want to {userToToggle?.status ? 'block' : 'unblock'}{' '}
                        <strong className="text-gray-900">{userToToggle?.name}</strong>?
                    </p>

                    {userToToggle?.status && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                            <p className="text-xs font-semibold text-yellow-800">
                                ⚠️ Blocking this user will:
                            </p>
                            <ul className="text-xs text-yellow-700 mt-1.5 ml-4 list-disc space-y-0.5">
                                <li>Log them out immediately</li>
                                <li>Prevent them from logging in</li>
                                <li>Revoke all their active sessions</li>
                            </ul>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => {
                                setIsBlockModalOpen(false);
                                setUserToToggle(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmToggleStatus}
                            className={`px-4 py-2 rounded-xl font-semibold text-xs transition cursor-pointer text-white ${userToToggle?.status
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-green-500 hover:bg-green-600'
                                }`}
                        >
                            {userToToggle?.status ? 'Block User' : 'Unblock User'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default Users;
