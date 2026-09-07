import { AttributeValuePayload } from "@/common/interface";
import axios from "./axios";

export const fetchAttributeValues = async (
    attributeIdentifier: number | string,
    params?: { page?: number; limit?: number; per_page?: number; search?: string; status?: string }
) => {
    const isNum = typeof attributeIdentifier === 'number' || (/^\d+$/.test(String(attributeIdentifier)) && !isNaN(Number(attributeIdentifier)));
    const queryParam = isNum
        ? { attribute_id: Number(attributeIdentifier) }
        : { attribute_slug: String(attributeIdentifier) };

    const response = await axios.get(`/api/attribute-values`, {
        params: { ...queryParam, ...params }
    });
    return response.data;
};

export const createAttributeValue = async (data: AttributeValuePayload & { attribute_slug?: string }) => {
    const payload = { ...data, description: data.description ?? undefined, status: Boolean(data.status) };
    const response = await axios.post("/api/create-attribute-value", payload);
    return response.data;
};

export const updateAttributeValue = async (id: number, data: AttributeValuePayload & { attribute_slug?: string }) => {
    const payload = { ...data, description: data.description ?? undefined, status: Boolean(data.status) };
    const response = await axios.put(`/api/update-attribute-value/${id}`, payload);
    return response.data;
};

export const deleteAttributeValue = async (id: number) => {
    const response = await axios.delete(`/api/delete-attribute-value/${id}`);
    return response.data;
};

export const toggleAttributeValueStatus = async (id: number) => {
    const response = await axios.patch(`/api/attribute-value/${id}/status`);
    return response.data;
};
