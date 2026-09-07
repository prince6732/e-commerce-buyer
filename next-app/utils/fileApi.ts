import { ApiResponse } from "@/common/interface";
import axios from "./axios";

const apiUrl = "/api/images";

export const getImages = async (directory: string): Promise<string[]> => {
  const response = await axios.get<string[]>(`${apiUrl}/get-files/${directory}`);
  return response.data;
};

export const uploadImage = async (data: FormData): Promise<ApiResponse<string>> => {
  const response = await axios.post<ApiResponse<string>>(`${apiUrl}/upload`, data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const deleteImage = async (path: string): Promise<ApiResponse<null>> => {
  const response = await axios.delete<ApiResponse<null>>(apiUrl, {
    data: { path },
  });
  return response.data;
};
