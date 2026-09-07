import axios from './axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const getCart = async () => {
  try {
    const response = await axios.get(`/api/cart`);
    return response.data;
  } catch (error) {
    console.error('Error fetching cart:', error);
    throw error;
  }
};

export const addToCart = async (productId: number, variantId: number, quantity: number, selectedAttributes?: Record<string, string>) => {
  try {
    const response = await axios.post(`/api/cart/add`, {
      product_id: productId,
      variant_id: variantId,
      quantity,
      selected_attributes: selectedAttributes,
    });
    return response.data;
  } catch (error) {
    console.error('Error adding to cart:', error);
    throw error;
  }
};

export const updateCartQuantity = async (cartItemId: number, quantity: number) => {
  try {
    const response = await axios.put(`/api/cart/${cartItemId}`, {
      quantity,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating cart quantity:', error);
    throw error;
  }
};

export const removeFromCart = async (cartItemId: number) => {
  try {
    const response = await axios.delete(`/api/cart/${cartItemId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing from cart:', error);
    throw error;
  }
};

export const clearCart = async () => {
  try {
    const response = await axios.delete(`/api/cart`);
    return response.data;
  } catch (error) {
    console.error('Error clearing cart:', error);
    throw error;
  }
};

export const getCartCount = async () => {
  try {
    const response = await axios.get(`/api/cart/count`);
    return response.data;
  } catch (error) {
    console.error('Error getting cart count:', error);
    throw error;
  }
};