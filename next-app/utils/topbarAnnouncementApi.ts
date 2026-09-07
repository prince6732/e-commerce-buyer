import axios from "./axios";
import { TopbarAnnouncement } from "@/common/interface";

export interface AnnouncementFormData {
  title: string;
  icon?: string | null;
  link_url?: string | null;
  status: 'active' | 'inactive';
}

/**
 * Public API for marketing topbar:
 * Returns only active announcements.
 * Uses skipGlobalLoader: true so it doesn't block the screen on page load.
 */
export const getActiveAnnouncements = async (): Promise<TopbarAnnouncement[]> => {
  try {
    const response = await axios.get("/api/topbar-announcements", {
      skipGlobalLoader: true,
    } as any);
    if (response.data?.res === 'success' && Array.isArray(response.data?.data)) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch active announcements:", error);
    return [];
  }
};

/**
 * Admin API:
 * Returns all announcements with optional search/status query.
 */
export const getAdminAnnouncements = async (query?: { search?: string; status?: string; page?: number; per_page?: number; limit?: number }) => {
  const response = await axios.get("/api/admin/topbar-announcements", {
    params: query,
  });
  return response.data;
};

export const getAnnouncementById = async (id: number) => {
  const response = await axios.get(`/api/admin/topbar-announcements/${id}`);
  return response.data;
};

export const createAnnouncement = async (data: AnnouncementFormData) => {
  const response = await axios.post("/api/admin/topbar-announcements", data);
  return response.data;
};

export const updateAnnouncement = async (id: number | string, data: Partial<AnnouncementFormData>) => {
  const response = await axios.put(`/api/admin/topbar-announcements/${id}`, data);
  return response.data;
};

export const deleteAnnouncement = async (id: number | string) => {
  const response = await axios.delete(`/api/admin/topbar-announcements/${id}`);
  return response.data;
};

export const toggleAnnouncementStatus = async (id: number | string, status?: 'active' | 'inactive') => {
  const response = await axios.patch(`/api/admin/topbar-announcements/${id}/status`, { status });
  return response.data;
};
