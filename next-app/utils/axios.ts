import axiosLib from "axios";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.zelton.co.in";

const axios = axiosLib.create({
  baseURL: API_URL,
  withCredentials: false,
  headers: {
    "Accept": "application/json",
  },    
});

axios.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const status = error.response?.status;
      const data = error.response?.data;
      const msg = typeof data?.message === "string" ? data.message.toLowerCase() : "";

      // Only log out if it is an actual authentication failure on our own backend auth guard
      // Do NOT log out on 400/500 errors or third-party service errors that mention "unauthorized"!
      const isAuthError =
        status === 401 ||
        (status === 404 && (msg.includes("user not found") || error.config?.url?.includes("/api/user"))) ||
        data?.error === "account_blocked";

      if (isAuthError && (localStorage.getItem("token") || localStorage.getItem("user"))) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        window.dispatchEvent(new Event("auth:logout"));
        if (window.location.pathname.startsWith("/dashboard")) {
          window.location.href = "/";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axios;
