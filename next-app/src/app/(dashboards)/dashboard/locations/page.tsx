"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import {
    MapPin,
    Building2,
    Search,
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Filter,
    Layers,
    ChevronRight,
    ChevronLeft,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Eye,
    RefreshCw,
} from "lucide-react";
import {
    AdminStateItem,
    AdminCityItem,
    getAdminStates,
    getAllAdminStatesList,
    createAdminState,
    updateAdminState,
    toggleStateStatus,
    deleteAdminState,
    getAdminCities,
    createAdminCity,
    updateAdminCity,
    toggleCityStatus,
    deleteAdminCity,
} from "../../../../../utils/adminLocationApi";
import { clearLocationCache } from "../../../../../utils/locationApi";

// Validation schemas
const stateSchema = yup.object({
    name: yup
        .string()
        .trim()
        .required("State name is required")
        .min(2, "State name must be at least 2 characters")
        .max(100, "State name cannot exceed 100 characters"),
    status: yup.boolean().required(),
});

const citySchema = yup.object({
    name: yup
        .string()
        .trim()
        .required("City name is required")
        .min(2, "City name must be at least 2 characters")
        .max(100, "City name cannot exceed 100 characters"),
    state_id: yup
        .number()
        .typeError("Please select a state")
        .required("State is required")
        .positive("Please select a valid state"),
    status: yup.boolean().required(),
});

type StateFormValues = yup.InferType<typeof stateSchema>;
type CityFormValues = yup.InferType<typeof citySchema>;

export default function LocationsManagementPage() {
    // Tab state: "states" | "cities"
    const [activeTab, setActiveTab] = useState<"states" | "cities">("states");

    // Notifications
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // ==========================================
    // STATES TAB STATE
    // ==========================================
    const [statesList, setStatesList] = useState<AdminStateItem[]>([]);
    const [statesLoading, setStatesLoading] = useState(true);
    const [statesSearch, setStatesSearch] = useState("");
    const [debouncedStatesSearch, setDebouncedStatesSearch] = useState("");
    const [statesStatusFilter, setStatesStatusFilter] = useState("all");
    const [statesPage, setStatesPage] = useState(1);
    const [statesTotalPages, setStatesTotalPages] = useState(1);
    const [statesTotalCount, setStatesTotalCount] = useState(0);
    const [statesStats, setStatesStats] = useState({ total: 0, active: 0, inactive: 0 });

    // State Modals
    const [isStateModalOpen, setIsStateModalOpen] = useState(false);
    const [selectedState, setSelectedState] = useState<AdminStateItem | null>(null);
    const [isStateDeleteModalOpen, setIsStateDeleteModalOpen] = useState(false);
    const [stateToDelete, setStateToDelete] = useState<AdminStateItem | null>(null);
    const [isSubmittingState, setIsSubmittingState] = useState(false);

    // ==========================================
    // CITIES TAB STATE
    // ==========================================
    const [citiesList, setCitiesList] = useState<AdminCityItem[]>([]);
    const [citiesLoading, setCitiesLoading] = useState(true);
    const [citiesSearch, setCitiesSearch] = useState("");
    const [debouncedCitiesSearch, setDebouncedCitiesSearch] = useState("");
    const [citiesStateFilter, setCitiesStateFilter] = useState<string>("all");
    const [citiesStatusFilter, setCitiesStatusFilter] = useState("all");
    const [citiesPage, setCitiesPage] = useState(1);
    const [citiesTotalPages, setCitiesTotalPages] = useState(1);
    const [citiesTotalCount, setCitiesTotalCount] = useState(0);
    const [citiesStats, setCitiesStats] = useState({ total: 0, active: 0, inactive: 0 });

    // Dropdown list of all states for cities filter & city modal
    const [allStatesDropdown, setAllStatesDropdown] = useState<{ id: number; name: string; status: boolean }[]>([]);

    // City Modals
    const [isCityModalOpen, setIsCityModalOpen] = useState(false);
    const [selectedCity, setSelectedCity] = useState<AdminCityItem | null>(null);
    const [isCityDeleteModalOpen, setIsCityDeleteModalOpen] = useState(false);
    const [cityToDelete, setCityToDelete] = useState<AdminCityItem | null>(null);
    const [isSubmittingCity, setIsSubmittingCity] = useState(false);

    // Toggle loading states
    const [togglingStateId, setTogglingStateId] = useState<number | null>(null);
    const [togglingCityId, setTogglingCityId] = useState<number | null>(null);

    // ==========================================
    // REACT HOOK FORMS
    // ==========================================
    const stateForm = useForm<StateFormValues>({
        resolver: yupResolver(stateSchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            status: true,
        },
    });

    const cityForm = useForm<CityFormValues>({
        resolver: yupResolver(citySchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            state_id: 0,
            status: true,
        },
    });

    // Auto-dismiss alert toasts
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Debounce search states
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedStatesSearch(statesSearch);
            setStatesPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [statesSearch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCitiesSearch(citiesSearch);
            setCitiesPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [citiesSearch]);

    // Load states dropdown for city filter & city modal
    const loadAllStatesDropdown = useCallback(async () => {
        try {
            const res = await getAllAdminStatesList();
            if (res.success) {
                setAllStatesDropdown(res.data);
            }
        } catch (error: any) {
            console.error("Failed to load states list:", error);
        }
    }, []);

    useEffect(() => {
        loadAllStatesDropdown();
    }, [loadAllStatesDropdown]);

    // ==========================================
    // FETCH STATES
    // ==========================================
    const fetchStatesData = useCallback(async () => {
        setStatesLoading(true);
        try {
            const res = await getAdminStates({
                search: debouncedStatesSearch || undefined,
                status: statesStatusFilter === "all" ? undefined : statesStatusFilter,
                page: statesPage,
                limit: 15,
            });
            if (res.success) {
                setStatesList(res.data || []);
                setStatesTotalCount(res.meta.total || 0);
                setStatesTotalPages(res.meta.total_pages || 1);
                if (res.meta.stats) {
                    setStatesStats(res.meta.stats);
                }
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Failed to load states");
        } finally {
            setStatesLoading(false);
        }
    }, [debouncedStatesSearch, statesStatusFilter, statesPage]);

    useEffect(() => {
        if (activeTab === "states") {
            fetchStatesData();
        }
    }, [activeTab, fetchStatesData]);

    // ==========================================
    // FETCH CITIES
    // ==========================================
    const fetchCitiesData = useCallback(async () => {
        setCitiesLoading(true);
        try {
            const res = await getAdminCities({
                state_id: citiesStateFilter === "all" ? undefined : citiesStateFilter,
                search: debouncedCitiesSearch || undefined,
                status: citiesStatusFilter === "all" ? undefined : citiesStatusFilter,
                page: citiesPage,
                limit: 25,
            });
            if (res.success) {
                setCitiesList(res.data || []);
                setCitiesTotalCount(res.meta.total || 0);
                setCitiesTotalPages(res.meta.total_pages || 1);
                if (res.meta.stats) {
                    setCitiesStats(res.meta.stats);
                }
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Failed to load cities");
        } finally {
            setCitiesLoading(false);
        }
    }, [citiesStateFilter, debouncedCitiesSearch, citiesStatusFilter, citiesPage]);

    useEffect(() => {
        if (activeTab === "cities") {
            fetchCitiesData();
        }
    }, [activeTab, fetchCitiesData]);

    // ==========================================
    // STATE ACTIONS
    // ==========================================
    const handleOpenCreateStateModal = () => {
        setSelectedState(null);
        stateForm.reset({
            name: "",
            status: true,
        });
        setIsStateModalOpen(true);
    };

    const handleOpenEditStateModal = (state: AdminStateItem) => {
        setSelectedState(state);
        stateForm.reset({
            name: state.name,
            status: state.status,
        });
        setIsStateModalOpen(true);
    };

    const handleSubmitState = async (data: StateFormValues) => {
        setIsSubmittingState(true);
        try {
            if (selectedState) {
                const res = await updateAdminState(selectedState.id, data);
                if (res.success) {
                    setSuccessMessage(`State "${data.name}" updated successfully`);
                    setIsStateModalOpen(false);
                    clearLocationCache();
                    fetchStatesData();
                    loadAllStatesDropdown();
                }
            } else {
                const res = await createAdminState(data);
                if (res.success) {
                    setSuccessMessage(`State "${data.name}" created successfully`);
                    setIsStateModalOpen(false);
                    clearLocationCache();
                    fetchStatesData();
                    loadAllStatesDropdown();
                }
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Operation failed");
        } finally {
            setIsSubmittingState(false);
        }
    };

    const handleToggleStateStatus = async (state: AdminStateItem) => {
        setTogglingStateId(state.id);
        // Optimistic UI update
        const updatedStatus = !state.status;
        setStatesList((prev) =>
            prev.map((s) => (s.id === state.id ? { ...s, status: updatedStatus } : s))
        );

        try {
            const res = await toggleStateStatus(state.id);
            if (res.success) {
                setSuccessMessage(res.message || `State status changed to ${updatedStatus ? "Active" : "Inactive"}`);
                clearLocationCache();
                // Update stats
                setStatesStats((prev) => ({
                    ...prev,
                    active: updatedStatus ? prev.active + 1 : Math.max(0, prev.active - 1),
                    inactive: updatedStatus ? Math.max(0, prev.inactive - 1) : prev.inactive + 1,
                }));
                loadAllStatesDropdown();
            }
        } catch (error: any) {
            // Revert on error
            setStatesList((prev) =>
                prev.map((s) => (s.id === state.id ? { ...s, status: state.status } : s))
            );
            setErrorMessage(error?.response?.data?.message || "Failed to update state status");
        } finally {
            setTogglingStateId(null);
        }
    };

    const handleDeleteState = async () => {
        if (!stateToDelete) return;
        setIsSubmittingState(true);
        try {
            const res = await deleteAdminState(stateToDelete.id);
            if (res.success) {
                setSuccessMessage(res.message || "State deleted successfully");
                setIsStateDeleteModalOpen(false);
                setStateToDelete(null);
                clearLocationCache();
                fetchStatesData();
                loadAllStatesDropdown();
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Failed to delete state");
        } finally {
            setIsSubmittingState(false);
        }
    };

    const handleViewCitiesForState = (stateId: number) => {
        setCitiesStateFilter(String(stateId));
        setActiveTab("cities");
        setCitiesPage(1);
    };

    // ==========================================
    // CITY ACTIONS
    // ==========================================
    const handleOpenCreateCityModal = () => {
        setSelectedCity(null);
        cityForm.reset({
            name: "",
            state_id: citiesStateFilter !== "all" ? Number(citiesStateFilter) : (allStatesDropdown[0]?.id || 0),
            status: true,
        });
        setIsCityModalOpen(true);
    };

    const handleOpenEditCityModal = (city: AdminCityItem) => {
        setSelectedCity(city);
        cityForm.reset({
            name: city.name,
            state_id: city.state_id,
            status: city.status,
        });
        setIsCityModalOpen(true);
    };

    const handleSubmitCity = async (data: CityFormValues) => {
        setIsSubmittingCity(true);
        try {
            if (selectedCity) {
                const res = await updateAdminCity(selectedCity.id, data);
                if (res.success) {
                    setSuccessMessage(`City "${data.name}" updated successfully`);
                    setIsCityModalOpen(false);
                    clearLocationCache();
                    fetchCitiesData();
                }
            } else {
                const res = await createAdminCity(data);
                if (res.success) {
                    setSuccessMessage(`City "${data.name}" created successfully`);
                    setIsCityModalOpen(false);
                    clearLocationCache();
                    fetchCitiesData();
                }
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Operation failed");
        } finally {
            setIsSubmittingCity(false);
        }
    };

    const handleToggleCityStatus = async (city: AdminCityItem) => {
        setTogglingCityId(city.id);
        // Optimistic UI update
        const updatedStatus = !city.status;
        setCitiesList((prev) =>
            prev.map((c) => (c.id === city.id ? { ...c, status: updatedStatus } : c))
        );

        try {
            const res = await toggleCityStatus(city.id);
            if (res.success) {
                setSuccessMessage(res.message || `City status changed to ${updatedStatus ? "Active" : "Inactive"}`);
                clearLocationCache();
                setCitiesStats((prev) => ({
                    ...prev,
                    active: updatedStatus ? prev.active + 1 : Math.max(0, prev.active - 1),
                    inactive: updatedStatus ? Math.max(0, prev.inactive - 1) : prev.inactive + 1,
                }));
            }
        } catch (error: any) {
            // Revert on error
            setCitiesList((prev) =>
                prev.map((c) => (c.id === city.id ? { ...c, status: city.status } : c))
            );
            setErrorMessage(error?.response?.data?.message || "Failed to update city status");
        } finally {
            setTogglingCityId(null);
        }
    };

    const handleDeleteCity = async () => {
        if (!cityToDelete) return;
        setIsSubmittingCity(true);
        try {
            const res = await deleteAdminCity(cityToDelete.id);
            if (res.success) {
                setSuccessMessage(res.message || "City deleted successfully");
                setIsCityDeleteModalOpen(false);
                setCityToDelete(null);
                clearLocationCache();
                fetchCitiesData();
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Failed to delete city");
        } finally {
            setIsSubmittingCity(false);
        }
    };

    return (
        <ProtectedRoute role="Admin">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
                {/* Notification Alerts */}
                {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}
                {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#007FFF] uppercase tracking-wider mb-1">
                            <MapPin className="w-4 h-4" />
                            <span>Delivery & Geolocation</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                            States & Cities Management
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                            Configure deliverable states and cities, toggle active status for checkout availability, and manage location catalogs.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {activeTab === "states" ? (
                            <button
                                onClick={handleOpenCreateStateModal}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] text-white text-sm font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add New State</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleOpenCreateCityModal}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] text-white text-sm font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add New City</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <button
                        onClick={() => {
                            setActiveTab("states");
                            setStatesPage(1);
                        }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                            activeTab === "states"
                                ? "bg-[#007FFF] text-white shadow-sm"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        }`}
                    >
                        <MapPin className="w-4 h-4" />
                        <span>States Catalog</span>
                        <span
                            className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeTab === "states" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                            }`}
                        >
                            {statesStats.total}
                        </span>
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab("cities");
                            setCitiesPage(1);
                        }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                            activeTab === "cities"
                                ? "bg-[#007FFF] text-white shadow-sm"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        }`}
                    >
                        <Building2 className="w-4 h-4" />
                        <span>Cities Catalog</span>
                        <span
                            className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeTab === "cities" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                            }`}
                        >
                            {citiesStats.total}
                        </span>
                    </button>
                </div>

                {/* ========================================== */}
                {/* TAB 1: STATES MANAGEMENT                  */}
                {/* ========================================== */}
                {activeTab === "states" && (
                    <div className="space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-gray-400">Total States</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{statesStats.total}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007FFF] flex items-center justify-center">
                                    <MapPin className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-emerald-600">Active in Checkout</p>
                                    <p className="text-2xl font-bold text-emerald-700 mt-1">{statesStats.active}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-rose-600">Inactive / Disabled</p>
                                    <p className="text-2xl font-bold text-rose-700 mt-1">{statesStats.inactive}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                                    <XCircle className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={statesSearch}
                                    onChange={(e) => setStatesSearch(e.target.value)}
                                    placeholder="Search state name..."
                                    className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50/70 border border-gray-200 rounded-xl focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 outline-none transition"
                                />
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-1">
                                    <Filter className="w-3.5 h-3.5" />
                                    <span>Status:</span>
                                </div>
                                <select
                                    value={statesStatusFilter}
                                    onChange={(e) => {
                                        setStatesStatusFilter(e.target.value);
                                        setStatesPage(1);
                                    }}
                                    className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#007FFF] cursor-pointer"
                                >
                                    <option value="all">All States</option>
                                    <option value="true">Active Only</option>
                                    <option value="false">Inactive Only</option>
                                </select>

                                <button
                                    onClick={() => fetchStatesData()}
                                    title="Refresh States"
                                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition active:scale-95 cursor-pointer"
                                >
                                    <RefreshCw className={`w-4 h-4 ${statesLoading ? "animate-spin text-[#007FFF]" : ""}`} />
                                </button>
                            </div>
                        </div>

                        {/* States Table */}
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-700">
                                    <thead className="bg-gray-50/70 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 w-20">#ID</th>
                                            <th className="px-6 py-4">State Name</th>
                                            <th className="px-6 py-4 text-center">Total Cities</th>
                                            <th className="px-6 py-4 text-center">Checkout Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {statesLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#007FFF] mb-2" />
                                                    <span>Loading states catalog...</span>
                                                </td>
                                            </tr>
                                        ) : statesList.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                    <MapPin className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                                    <p className="font-semibold text-gray-600">No states found</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">Try refining your search query or add a new state.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            statesList.map((state) => {
                                                const isToggling = togglingStateId === state.id;
                                                return (
                                                    <tr key={state.id} className="hover:bg-gray-50/60 transition">
                                                        <td className="px-6 py-4 font-mono text-xs text-gray-400">
                                                            #{state.id}
                                                        </td>
                                                        <td className="px-6 py-4 font-semibold text-gray-900">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center flex-shrink-0">
                                                                    <MapPin className="w-3.5 h-3.5" />
                                                                </div>
                                                                <span>{state.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => handleViewCitiesForState(state.id)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-blue-50 hover:text-[#007FFF] text-gray-700 text-xs font-semibold rounded-lg transition border border-gray-200 hover:border-blue-200 cursor-pointer"
                                                                title="View Cities in this state"
                                                            >
                                                                <span>{state.cities_count} Cities</span>
                                                                <ChevronRight className="w-3 h-3" />
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleStateStatus(state)}
                                                                disabled={isToggling}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400/50 ${
                                                                    state.status ? "bg-[#0CCA4A]" : "bg-gray-300"
                                                                } ${isToggling ? "opacity-60 cursor-wait" : ""}`}
                                                                title={`Click to ${state.status ? "deactivate" : "activate"} state`}
                                                            >
                                                                <span
                                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                                                                        state.status ? "translate-x-5" : "translate-x-0"
                                                                    }`}
                                                                />
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="inline-flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleViewCitiesForState(state.id)}
                                                                    title="View cities"
                                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-[#007FFF] hover:bg-blue-50 transition cursor-pointer"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenEditStateModal(state)}
                                                                    title="Edit state"
                                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-[#007FFF] hover:bg-blue-50 transition cursor-pointer"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setStateToDelete(state);
                                                                        setIsStateDeleteModalOpen(true);
                                                                    }}
                                                                    title="Delete state"
                                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {statesTotalPages > 1 && (
                                <div className="px-6 py-3.5 bg-gray-50/60 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                                    <span>
                                        Showing Page <strong className="text-gray-900">{statesPage}</strong> of{" "}
                                        <strong className="text-gray-900">{statesTotalPages}</strong> ({statesTotalCount} total states)
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setStatesPage((p) => Math.max(1, p - 1))}
                                            disabled={statesPage === 1}
                                            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition cursor-pointer"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5 inline" /> Previous
                                        </button>
                                        <button
                                            onClick={() => setStatesPage((p) => Math.min(statesTotalPages, p + 1))}
                                            disabled={statesPage === statesTotalPages}
                                            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition cursor-pointer"
                                        >
                                            Next <ChevronRight className="w-3.5 h-3.5 inline" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================== */}
                {/* TAB 2: CITIES MANAGEMENT                  */}
                {/* ========================================== */}
                {activeTab === "cities" && (
                    <div className="space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-gray-400">Total Cities</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{citiesStats.total}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007FFF] flex items-center justify-center">
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-emerald-600">Active in Checkout</p>
                                    <p className="text-2xl font-bold text-emerald-700 mt-1">{citiesStats.active}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-rose-600">Inactive / Disabled</p>
                                    <p className="text-2xl font-bold text-rose-700 mt-1">{citiesStats.inactive}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                                    <XCircle className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
                            <div className="relative w-full lg:w-72">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={citiesSearch}
                                    onChange={(e) => setCitiesSearch(e.target.value)}
                                    placeholder="Search city name..."
                                    className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50/70 border border-gray-200 rounded-xl focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 outline-none transition"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                                {/* State Filter */}
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>State:</span>
                                </div>
                                <select
                                    value={citiesStateFilter}
                                    onChange={(e) => {
                                        setCitiesStateFilter(e.target.value);
                                        setCitiesPage(1);
                                    }}
                                    className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#007FFF] cursor-pointer max-w-[200px]"
                                >
                                    <option value="all">All States</option>
                                    {allStatesDropdown.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} {!s.status ? "(Inactive State)" : ""}
                                        </option>
                                    ))}
                                </select>

                                {/* Status Filter */}
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-1">
                                    <Filter className="w-3.5 h-3.5" />
                                    <span>Status:</span>
                                </div>
                                <select
                                    value={citiesStatusFilter}
                                    onChange={(e) => {
                                        setCitiesStatusFilter(e.target.value);
                                        setCitiesPage(1);
                                    }}
                                    className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#007FFF] cursor-pointer"
                                >
                                    <option value="all">All Status</option>
                                    <option value="true">Active Only</option>
                                    <option value="false">Inactive Only</option>
                                </select>

                                <button
                                    onClick={() => fetchCitiesData()}
                                    title="Refresh Cities"
                                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition active:scale-95 cursor-pointer"
                                >
                                    <RefreshCw className={`w-4 h-4 ${citiesLoading ? "animate-spin text-[#007FFF]" : ""}`} />
                                </button>
                            </div>
                        </div>

                        {/* Cities Table */}
                        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-700">
                                    <thead className="bg-gray-50/70 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 w-20">#ID</th>
                                            <th className="px-6 py-4">City Name</th>
                                            <th className="px-6 py-4">Parent State</th>
                                            <th className="px-6 py-4 text-center">Checkout Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {citiesLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#007FFF] mb-2" />
                                                    <span>Loading cities catalog...</span>
                                                </td>
                                            </tr>
                                        ) : citiesList.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                    <Building2 className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                                    <p className="font-semibold text-gray-600">No cities found</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">Try selecting a different state or add a new city.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            citiesList.map((city) => {
                                                const isToggling = togglingCityId === city.id;
                                                return (
                                                    <tr key={city.id} className="hover:bg-gray-50/60 transition">
                                                        <td className="px-6 py-4 font-mono text-xs text-gray-400">
                                                            #{city.id}
                                                        </td>
                                                        <td className="px-6 py-4 font-semibold text-gray-900">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                                                    <Building2 className="w-3.5 h-3.5" />
                                                                </div>
                                                                <span>{city.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-semibold text-gray-800">
                                                                    {city.state_name}
                                                                </span>
                                                                {!city.state_status && (
                                                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded text-[10px] font-bold" title="Parent State is inactive">
                                                                        State Inactive
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleCityStatus(city)}
                                                                disabled={isToggling}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400/50 ${
                                                                    city.status ? "bg-[#0CCA4A]" : "bg-gray-300"
                                                                } ${isToggling ? "opacity-60 cursor-wait" : ""}`}
                                                                title={`Click to ${city.status ? "deactivate" : "activate"} city`}
                                                            >
                                                                <span
                                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                                                                        city.status ? "translate-x-5" : "translate-x-0"
                                                                    }`}
                                                                />
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="inline-flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleOpenEditCityModal(city)}
                                                                    title="Edit city"
                                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-[#007FFF] hover:bg-blue-50 transition cursor-pointer"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setCityToDelete(city);
                                                                        setIsCityDeleteModalOpen(true);
                                                                    }}
                                                                    title="Delete city"
                                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {citiesTotalPages > 1 && (
                                <div className="px-6 py-3.5 bg-gray-50/60 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                                    <span>
                                        Showing Page <strong className="text-gray-900">{citiesPage}</strong> of{" "}
                                        <strong className="text-gray-900">{citiesTotalPages}</strong> ({citiesTotalCount} total cities)
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setCitiesPage((p) => Math.max(1, p - 1))}
                                            disabled={citiesPage === 1}
                                            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition cursor-pointer"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5 inline" /> Previous
                                        </button>
                                        <button
                                            onClick={() => setCitiesPage((p) => Math.min(citiesTotalPages, p + 1))}
                                            disabled={citiesPage === citiesTotalPages}
                                            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition cursor-pointer"
                                        >
                                            Next <ChevronRight className="w-3.5 h-3.5 inline" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================== */}
                {/* CREATE / EDIT STATE MODAL                  */}
                {/* ========================================== */}
                <Modal
                    isOpen={isStateModalOpen}
                    onClose={() => setIsStateModalOpen(false)}
                    title={selectedState ? `Edit State: ${selectedState.name}` : "Create New State"}
                >
                    <form onSubmit={stateForm.handleSubmit(handleSubmitState)} className="space-y-4 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                State Name *
                            </label>
                            <input
                                type="text"
                                {...stateForm.register("name")}
                                placeholder="e.g. Punjab, Maharashtra, Karnataka"
                                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 outline-none transition"
                            />
                            {stateForm.formState.errors.name && (
                                <p className="text-xs text-red-500 mt-1 font-medium">
                                    {stateForm.formState.errors.name.message}
                                </p>
                            )}
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-xs font-bold text-gray-800">Active in Checkout</p>
                                <p className="text-[11px] text-gray-500">
                                    When disabled, customers cannot select this state during checkout.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...stateForm.register("status")}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007FFF]"></div>
                            </label>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsStateModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmittingState}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-semibold shadow-sm transition disabled:opacity-60 cursor-pointer"
                            >
                                {isSubmittingState && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>{selectedState ? "Save Changes" : "Create State"}</span>
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* ========================================== */}
                {/* CREATE / EDIT CITY MODAL                   */}
                {/* ========================================== */}
                <Modal
                    isOpen={isCityModalOpen}
                    onClose={() => setIsCityModalOpen(false)}
                    title={selectedCity ? `Edit City: ${selectedCity.name}` : "Create New City"}
                >
                    <form onSubmit={cityForm.handleSubmit(handleSubmitCity)} className="space-y-4 pt-2">
                        {/* Parent State Dropdown */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Select State *
                            </label>
                            <select
                                {...cityForm.register("state_id", { valueAsNumber: true })}
                                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
                            >
                                <option value={0}>-- Select a state --</option>
                                {allStatesDropdown.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} {!s.status ? "(Inactive State)" : ""}
                                    </option>
                                ))}
                            </select>
                            {cityForm.formState.errors.state_id && (
                                <p className="text-xs text-red-500 mt-1 font-medium">
                                    {cityForm.formState.errors.state_id.message}
                                </p>
                            )}
                        </div>

                        {/* City Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                City Name *
                            </label>
                            <input
                                type="text"
                                {...cityForm.register("name")}
                                placeholder="e.g. Ludhiana, Mumbai, Bengaluru"
                                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 outline-none transition"
                            />
                            {cityForm.formState.errors.name && (
                                <p className="text-xs text-red-500 mt-1 font-medium">
                                    {cityForm.formState.errors.name.message}
                                </p>
                            )}
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-xs font-bold text-gray-800">Active in Checkout</p>
                                <p className="text-[11px] text-gray-500">
                                    When disabled, customers cannot select this city during checkout.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...cityForm.register("status")}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007FFF]"></div>
                            </label>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsCityModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmittingCity}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-semibold shadow-sm transition disabled:opacity-60 cursor-pointer"
                            >
                                {isSubmittingCity && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>{selectedCity ? "Save Changes" : "Create City"}</span>
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* ========================================== */}
                {/* DELETE STATE CONFIRMATION MODAL            */}
                {/* ========================================== */}
                <Modal
                    isOpen={isStateDeleteModalOpen}
                    onClose={() => setIsStateDeleteModalOpen(false)}
                    title="Confirm State Deletion"
                >
                    <div className="space-y-4 pt-2">
                        <div className="flex items-start gap-3 p-3.5 bg-red-50 text-red-800 rounded-xl border border-red-200">
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed">
                                <p className="font-bold">Warning: High Impact Action</p>
                                <p className="mt-0.5">
                                    Deleting state <strong>"{stateToDelete?.name}"</strong> will also permanently delete all its{" "}
                                    <strong>{stateToDelete?.cities_count || 0} associated cities</strong> from the database.
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-gray-600">
                            Are you sure you want to delete this state? This action cannot be undone.
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsStateDeleteModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteState}
                                disabled={isSubmittingState}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60 cursor-pointer"
                            >
                                {isSubmittingState && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>Delete State & Cities</span>
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* ========================================== */}
                {/* DELETE CITY CONFIRMATION MODAL             */}
                {/* ========================================== */}
                <Modal
                    isOpen={isCityDeleteModalOpen}
                    onClose={() => setIsCityDeleteModalOpen(false)}
                    title="Confirm City Deletion"
                >
                    <div className="space-y-4 pt-2">
                        <p className="text-xs text-gray-600">
                            Are you sure you want to delete city <strong>"{cityToDelete?.name}"</strong> from{" "}
                            <strong>{cityToDelete?.state_name}</strong>?
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsCityDeleteModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteCity}
                                disabled={isSubmittingCity}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60 cursor-pointer"
                            >
                                {isSubmittingCity && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>Delete City</span>
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </ProtectedRoute>
    );
}
