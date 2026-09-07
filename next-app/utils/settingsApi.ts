import axios from "./axios";

export type Setting = {
    key: string;
    value: string | null;
    status?: number | boolean;
};

/** Fetch all settings */
export const fetchSettings = async (): Promise<Setting[]> => {
    const response = await axios.get("/api/settings");
    return response.data;
};

/** Fetch a single setting by key (public) */
export const fetchSettingByKey = async (key: string): Promise<Setting | null> => {
    const response = await axios.get(`/api/settings/${key}`);
    return response.data;
};

/** Create or update a setting (admin only) */
export const upsertSetting = async (key: string, value: string): Promise<Setting> => {
    const response = await axios.post("/api/settings", { key, value });
    return response.data.setting;
};
