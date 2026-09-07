import { RegisterUser, ResetPasswordPayload } from "@/common/interface";
import axios from "./axios";

export const verifyEmailCode = async (data: { email: string; code: string; }) => {
  const response = await axios.post("/api/verify-email-code", data);
  return response.data;
};

export const registerUser = async (data: RegisterUser) => {
  const response = await axios.post("/api/register", data);
  return response.data;
};

export const login = async (email: string, password: string) => {
  const response = await axios.post("/api/login", { email, password });
  return response.data;
};

export const forgotPassword = async (email: string) => {
  const response = await axios.post("/api/forgot-password", { email });
  return response.data;
};

export const logout = async () => {
  localStorage.removeItem("user");
  return axios.post("/api/logout");
};

export const resetPassword = async (data: ResetPasswordPayload) => {
  const response = await axios.post("/api/reset-password", data);
  return response.data;
};

export const getUser = () => axios.get("/api/user");

export const getAllUsers = async () => {
  try {
    const response = await axios.get("/api/all_users");
    return response.data;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
};