"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLike } from "@/context/LikeContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import CelebrationEffect from "@/components/(frontend)/CelebrationEffect";
import { getOrderSlug } from "../../../../utils/slugUtils";
import {
  RiUserLine,
  RiMailLine,
  RiPhoneLine,
  RiEditLine,
  RiSaveLine,
  RiCloseLine,
  RiShoppingBagLine,
  RiHeartLine,
  RiMapPinLine,
  RiCameraLine,
  RiEyeLine,
  RiEyeOffLine,
  RiDeleteBinLine,
  RiArrowLeftLine,
  RiBox3Line,
  RiArrowRightLine,
  RiLockPasswordLine,
  RiLogoutBoxRLine,
  RiShieldCheckLine,
  RiTruckLine,
} from "react-icons/ri";
import axios from "../../../../utils/axios";
import { useLoader } from "@/context/LoaderContext";
import { getOrders, formatCurrency, formatDate, getOrderStatusColor, formatOrderStatus } from "../../../../utils/orderApi";
import ZeltonLoader from "@/components/ui/ZeltonLoader";

// Validation schemas
const profileSchema = yup.object({
  name: yup
    .string()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  email: yup
    .string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .max(100, "Email must not exceed 100 characters"),
  phone_number: yup
    .string()
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : value)),
  address: yup
    .string()
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : value))
    .max(250, "Address must not exceed 250 characters"),
});

const passwordSchema = yup.object({
  current_password: yup
    .string()
    .required("Current password is required")
    .min(1, "Current password is required"),
  new_password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters"),
  new_password_confirmation: yup
    .string()
    .required("Please confirm your new password")
    .oneOf([yup.ref("new_password")], "Passwords do not match"),
}).required();

type ProfileFormData = {
  name: string;
  email: string;
  phone_number?: string | null;
  address?: string | null;
};
type PasswordFormData = yup.InferType<typeof passwordSchema>;

const ProfilePage = () => {
  const { user, loading: authLoading, refetchUser, logout, openAuthModal } = useAuth();
  const { likedProducts } = useLike();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoader();

  const [activeTab, setActiveTab] = useState<"profile" | "password" | "orders">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Orders state
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(true);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "orders" || tab === "recent_orders") {
      setActiveTab("orders");
    } else if (tab === "password" || tab === "security") {
      setActiveTab("password");
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams?.get("celebrate") === "true") {
      setShowCelebration(true);
      const timer = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("celebrate");
        const queryString = params.toString();
        const newPath = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", newPath);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    setImageError(false);
  }, [profilePictureUrl]);

  // Profile form
  const profileForm = useForm<any>({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      phone_number: "",
      address: "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: yupResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      new_password_confirmation: "",
    },
  });

  // Fetch Orders
  useEffect(() => {
    if (user) {
      setOrdersLoading(true);
      getOrders()
        .then((res: any) => {
          const list = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.data)
              ? res.data.data
              : Array.isArray(res?.result)
                ? res.result
                : Array.isArray(res)
                  ? res
                  : [];
          setOrdersList(list);
        })
        .catch((err) => {
          console.error("Error fetching orders:", err);
          setOrdersList([]);
        })
        .finally(() => setOrdersLoading(false));
    }
  }, [user]);

  // Sync user data to form
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
      return;
    }

    if (user) {
      profileForm.reset({
        name: user.name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        address: user.address || "",
      });

      if (user.profile_picture) {
        const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";
        if (user.profile_picture.startsWith("http://") || user.profile_picture.startsWith("https://")) {
          setProfilePictureUrl(user.profile_picture);
        } else {
          setProfilePictureUrl(`${baseUrl}/storage/${user.profile_picture}`);
        }
      }
    }
  }, [user, authLoading, router, profileForm]);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("File size must be less than 2MB.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/jpg", "image/gif"].includes(file.type)) {
      setErrorMessage("File must be an image (JPEG, PNG, JPG, GIF).");
      return;
    }

    setUploadingPicture(true);
    showLoader();
    try {
      const formData = new FormData();
      formData.append("profile_picture", file);

      const response = await axios.post("/api/profile/upload-picture", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setProfilePictureUrl(response.data.data.profile_picture_url);
        setSuccessMessage("Profile photo updated successfully!");
        await refetchUser();
      }
    } catch (error: any) {
      console.error("Profile picture upload error:", error);
      setErrorMessage(error.response?.data?.message || "Failed to upload profile picture.");
    } finally {
      setUploadingPicture(false);
      hideLoader();
      e.target.value = "";
    }
  };

  const handleProfilePictureDelete = async () => {
    setUploadingPicture(true);
    showLoader();
    try {
      const response = await axios.delete("/api/profile/delete-picture");
      if (response.data.success) {
        setProfilePictureUrl(null);
        setSuccessMessage("Profile picture removed!");
        await refetchUser();
      }
    } catch (error: any) {
      console.error("Profile picture delete error:", error);
      setErrorMessage("Failed to remove profile picture.");
    } finally {
      setUploadingPicture(false);
      hideLoader();
    }
  };

  const handleProfileUpdate = async (data: ProfileFormData) => {
    setSubmitting(true);
    showLoader();
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await axios.put("/api/profile", data);
      if (response.data.success || response.data.res === "success") {
        setSuccessMessage("Personal details updated successfully!");
        setIsEditing(false);
        await refetchUser();
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      setErrorMessage(error.response?.data?.message || "Failed to update profile.");
    } finally {
      setSubmitting(false);
      hideLoader();
    }
  };

  const handlePasswordUpdate = async (data: PasswordFormData) => {
    setSubmitting(true);
    showLoader();
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await axios.put("/api/change-password", {
        current_password: data.current_password,
        new_password: data.new_password,
        new_password_confirmation: data.new_password_confirmation,
        password: data.new_password,
        password_confirmation: data.new_password_confirmation,
      });
      if (response.data.success || response.data.res === "success") {
        setSuccessMessage("Password changed successfully!");
        passwordForm.reset({
          current_password: "",
          new_password: "",
          new_password_confirmation: "",
        });
      }
    } catch (error: any) {
      console.error("Password update error:", error);
      const serverErrors = error.response?.data?.errors;
      if (serverErrors?.current_password) {
        passwordForm.setError("current_password", {
          type: "manual",
          message: serverErrors.current_password[0] || "The current password you entered is incorrect.",
        });
      }
      if (serverErrors?.new_password) {
        passwordForm.setError("new_password", {
          type: "manual",
          message: serverErrors.new_password[0],
        });
      }
      setErrorMessage(
        error.response?.data?.message ||
        serverErrors?.current_password?.[0] ||
        "Failed to update password. Please verify your current password."
      );
    } finally {
      setSubmitting(false);
      hideLoader();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <ZeltonLoader size="lg" variant="brand" className="mx-auto mb-3" />
          <p className="text-gray-500 text-xs font-bold">Loading Account Details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const ordersCount = ordersList.length;
  const wishlistCount = likedProducts?.length || 0;
  const activeOrdersCount = ordersList.filter(
    (o) =>
      o.status?.toLowerCase() !== "delivered" &&
      o.status?.toLowerCase() !== "completed" &&
      o.status?.toLowerCase() !== "cancelled"
  ).length;

  return (
    <div className="min-h-screen bg-white pb-24">
      {showCelebration && <CelebrationEffect duration={6000} />}
      {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
      {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

      {/* ── 1. Page Header (Clean Centered Style matching Categories & Orders) ── */}
      <section className="py-6 sm:py-8 bg-white border-b border-gray-100 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer border border-gray-200/60"
            >
              <RiArrowLeftLine className="text-base" />
              <span className="hidden sm:inline">Home</span>
            </button>

            <div className="text-center">
              <h1 className="text-xl sm:text-3xl font-serif font-black tracking-widest text-[#0A0908] uppercase">
                My Account
              </h1>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Manage personal profile &amp; security
              </p>
            </div>

            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer border border-rose-200/60"
              title="Logout"
            >
              <RiLogoutBoxRLine className="text-base" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 2. Content Container ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">

        {/* ── Account Summary & User Profile Card ── */}
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xs p-5 sm:p-7">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">

            {/* User Info & Avatar */}
            <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 sm:gap-5 w-full md:w-auto">
              <div className="relative group flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center shadow-xs">
                  {!imageError && (profilePictureUrl || user?.profile_picture) ? (
                    <img
                      src={
                        profilePictureUrl ||
                        (user?.profile_picture?.startsWith("http://") || user?.profile_picture?.startsWith("https://")
                          ? user.profile_picture
                          : `${process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in"}/storage/${user?.profile_picture}`)
                      }
                      alt={user.name}
                      onError={() => setImageError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-white text-2xl sm:text-3xl font-black">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>

                {/* Edit Avatar Overlay */}
                <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
                  <input
                    type="file"
                    id="profile-picture-upload"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                    className="hidden"
                    disabled={uploadingPicture}
                  />
                  <label
                    htmlFor="profile-picture-upload"
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors cursor-pointer"
                    title="Change Photo"
                  >
                    {uploadingPicture ? (
                      <ZeltonLoader size="xs" variant="white" />
                    ) : (
                      <RiCameraLine className="text-base" />
                    )}
                  </label>

                  {(profilePictureUrl || user?.profile_picture) && (
                    <button
                      onClick={handleProfilePictureDelete}
                      disabled={uploadingPicture}
                      className="p-2 bg-red-500/80 hover:bg-red-600 rounded-xl text-white transition-colors cursor-pointer"
                      title="Remove Photo"
                    >
                      <RiDeleteBinLine className="text-base" />
                    </button>
                  )}
                </div>
              </div>

              {/* Name, Email, Info */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">{user.name}</h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <RiShieldCheckLine className="text-xs" />
                    <span>Verified</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-gray-500 font-medium">{user.email}</p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  {user.phone_number && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                      <RiPhoneLine className="text-gray-400" />
                      <span>{user.phone_number}</span>
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                    Member since {new Date(user.created_at || Date.now()).getFullYear()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics (3 clickable tiles on right) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full md:w-auto">
              {/* Orders Tile */}
              <button
                onClick={() => router.push("/orders")}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 hover:bg-blue-50 border border-gray-200/80 hover:border-blue-200 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <RiShoppingBagLine className="text-base" />
                </div>
                <span className="text-sm sm:text-base font-black text-gray-900">{ordersCount}</span>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Orders</span>
              </button>

              {/* Wishlist Tile */}
              <button
                onClick={() => router.push("/wishlist")}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 hover:bg-rose-50 border border-gray-200/80 hover:border-rose-200 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <RiHeartLine className="text-base" />
                </div>
                <span className="text-sm sm:text-base font-black text-gray-900">{wishlistCount}</span>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Wishlist</span>
              </button>

              {/* In Transit Tile */}
              <button
                onClick={() => router.push("/orders")}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 hover:bg-amber-50 border border-gray-200/80 hover:border-amber-200 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <RiTruckLine className="text-base" />
                </div>
                <span className="text-sm sm:text-base font-black text-gray-900">{activeOrdersCount}</span>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">In Transit</span>
              </button>
            </div>

          </div>
        </div>

        {/* ── 3. Tab Navigation Strip (Mobile App Style) ── */}
        <div className="flex items-center gap-2 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/80">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "profile"
                ? "bg-white text-gray-900 shadow-xs border border-gray-200/60"
                : "text-gray-600 hover:text-gray-900"
              }`}
          >
            <RiUserLine className="text-base" />
            <span>Personal Info</span>
          </button>

          <button
            onClick={() => setActiveTab("password")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "password"
                ? "bg-white text-gray-900 shadow-xs border border-gray-200/60"
                : "text-gray-600 hover:text-gray-900"
              }`}
          >
            <RiLockPasswordLine className="text-base" />
            <span>Security</span>
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "orders"
                ? "bg-white text-gray-900 shadow-xs border border-gray-200/60"
                : "text-gray-600 hover:text-gray-900"
              }`}
          >
            <RiBox3Line className="text-base" />
            <span>Recent Orders</span>
            {ordersCount > 0 && (
              <span className="bg-gray-200 text-gray-800 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {ordersCount}
              </span>
            )}
          </button>
        </div>

        {/* ── 4. Tab Content Panels ── */}

        {/* Tab 1: Personal Info */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xs p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Personal Information</h3>
                <p className="text-xs text-gray-500 mt-0.5">Your contact information and default shipping details</p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${isEditing
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "bg-[#007FFF] hover:bg-[#0066CC] text-white shadow-2xs"
                  }`}
              >
                {isEditing ? (
                  <>
                    <RiCloseLine className="text-base" />
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <RiEditLine className="text-base" />
                    <span>Edit Info</span>
                  </>
                )}
              </button>
            </div>

            <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <RiUserLine className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
                    <input
                      type="text"
                      disabled={!isEditing}
                      {...profileForm.register("name")}
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition ${!isEditing ? "bg-gray-50 text-gray-600 cursor-not-allowed" : "bg-white text-gray-900"
                        } ${profileForm.formState.errors.name ? "border-red-500" : "border-gray-200"}`}
                      placeholder="Enter full name"
                    />
                  </div>
                  {profileForm.formState.errors.name?.message && (
                    <p className="text-red-500 text-xs mt-1">{String(profileForm.formState.errors.name.message)}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <RiMailLine className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
                    <input
                      type="email"
                      disabled={!isEditing}
                      {...profileForm.register("email")}
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition ${!isEditing ? "bg-gray-50 text-gray-600 cursor-not-allowed" : "bg-white text-gray-900"
                        } ${profileForm.formState.errors.email ? "border-red-500" : "border-gray-200"}`}
                      placeholder="Enter email address"
                    />
                  </div>
                  {profileForm.formState.errors.email?.message && (
                    <p className="text-red-500 text-xs mt-1">{String(profileForm.formState.errors.email.message)}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <RiPhoneLine className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
                    <input
                      type="text"
                      disabled={!isEditing}
                      {...profileForm.register("phone_number")}
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition ${!isEditing ? "bg-gray-50 text-gray-600 cursor-not-allowed" : "bg-white text-gray-900"
                        } ${profileForm.formState.errors.phone_number ? "border-red-500" : "border-gray-200"}`}
                      placeholder="Enter phone number"
                    />
                  </div>
                  {profileForm.formState.errors.phone_number?.message && (
                    <p className="text-red-500 text-xs mt-1">{String(profileForm.formState.errors.phone_number.message)}</p>
                  )}
                </div>

                {/* Delivery Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Default Delivery Address
                  </label>
                  <div className="relative">
                    <RiMapPinLine className="absolute left-3.5 top-3.5 text-gray-400 text-base" />
                    <textarea
                      rows={3}
                      disabled={!isEditing}
                      {...profileForm.register("address")}
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition ${!isEditing ? "bg-gray-50 text-gray-600 cursor-not-allowed" : "bg-white text-gray-900"
                        } ${profileForm.formState.errors.address ? "border-red-500" : "border-gray-200"}`}
                      placeholder="Enter full shipping address, city, state, and pincode"
                    />
                  </div>
                  {profileForm.formState.errors.address?.message && (
                    <p className="text-red-500 text-xs mt-1">{String(profileForm.formState.errors.address.message)}</p>
                  )}
                </div>

              </div>

              {isEditing && (
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <ZeltonLoader size="xs" variant="white" />
                    ) : (
                      <RiSaveLine className="text-base" />
                    )}
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Tab 2: Security */}
        {activeTab === "password" && (
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xs p-6 sm:p-8">
            <div className="mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Change Password</h3>
              <p className="text-xs text-gray-500 mt-0.5">Keep your account secure with a strong password</p>
            </div>

            <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)}>
              <div className="space-y-4 max-w-lg">

                {/* Current Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Current Password <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => openAuthModal("forgot-password", user?.email || "")}
                      className="text-xs font-bold text-[#007FFF] hover:text-[#0066CC] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      {...passwordForm.register("current_password")}
                      className={`w-full px-4 py-3 pr-12 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition ${passwordForm.formState.errors.current_password ? "border-red-500" : "border-gray-200"
                        }`}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showCurrentPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.current_password && (
                    <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.current_password.message}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      {...passwordForm.register("new_password")}
                      className={`w-full px-4 py-3 pr-12 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition ${passwordForm.formState.errors.new_password ? "border-red-500" : "border-gray-200"
                        }`}
                      placeholder="Enter new password (8+ chars)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showNewPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.new_password && (
                    <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.new_password.message}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      {...passwordForm.register("new_password_confirmation")}
                      className={`w-full px-4 py-3 pr-12 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition ${passwordForm.formState.errors.new_password_confirmation ? "border-red-500" : "border-gray-200"
                        }`}
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.new_password_confirmation && (
                    <p className="text-red-500 text-xs mt-1">
                      {passwordForm.formState.errors.new_password_confirmation.message}
                    </p>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <ZeltonLoader size="xs" variant="white" />
                    ) : (
                      <RiSaveLine className="text-base" />
                    )}
                    <span>Update Password</span>
                  </button>
                </div>

              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Recent Orders */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xs p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Recent Orders</h3>
                <p className="text-xs text-gray-500 mt-0.5">Quick access to your recent purchase activity</p>
              </div>

              <Link
                href="/orders"
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#007FFF] hover:text-[#0066CC] transition"
              >
                <span>All Orders ({ordersCount})</span>
                <RiArrowRightLine />
              </Link>
            </div>

            {ordersLoading ? (
              <div className="py-12 text-center">
                <ZeltonLoader size="md" variant="brand" className="mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">Loading orders...</p>
              </div>
            ) : ordersList.length > 0 ? (
              <div className="space-y-3.5">
                {ordersList.slice(0, 4).map((order: any) => (
                  <div
                    key={order.id}
                    onClick={() => router.push(`/orders/${getOrderSlug(order)}`)}
                    className="p-4 rounded-2xl border border-gray-200/90 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer bg-[#FBFBFB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold flex-shrink-0">
                        <RiBox3Line className="text-xl" />
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-gray-900 font-mono">
                          Order #{order.order_number || order.orderNumber || order.id}
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium">
                          Placed on {formatDate(order.created_at || order.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getOrderStatusColor(order.status)}`}>
                        {formatOrderStatus(order.status || "Pending")}
                      </span>
                      <span className="font-black text-xs sm:text-sm text-gray-900">
                        {formatCurrency(order.total || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                  <RiShoppingBagLine className="text-xl" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">No Orders Yet</h4>
                <p className="text-xs text-gray-500 mb-4">Start exploring our collections and place your first order!</p>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
                >
                  <span>Start Shopping</span>
                  <RiArrowRightLine />
                </Link>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={null}>
      <ProfilePage />
    </Suspense>
  );
}