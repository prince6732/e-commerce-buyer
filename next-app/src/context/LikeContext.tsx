"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import axios from '../../utils/axios';

interface LikeContextType {
    likedProducts: number[];
    likesLoading: boolean;
    toggleLike: (productId: number) => Promise<boolean>;
    isLiked: (productId: number) => boolean;
    refreshLikes: () => Promise<void>;
    getLikesCount: (productId: number) => number;
}

const LikeContext = createContext<LikeContextType | undefined>(undefined);

export const useLike = () => {
    const context = useContext(LikeContext);
    if (!context) {
        throw new Error('useLike must be used within a LikeProvider');
    }
    return context;
};

interface LikeProviderProps {
    children: ReactNode;
}

export const LikeProvider: React.FC<LikeProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const [likedProducts, setLikedProducts] = useState<number[]>([]);
    const [likesLoading, setLikesLoading] = useState(false);
    const [likesCount, setLikesCount] = useState<{ [productId: number]: number }>({});

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.zelton.co.in/api";

    // Get token from localStorage
    const getToken = () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('token');
        }
        return null;
    };

    // Fetch user's liked products on login
    useEffect(() => {
        const token = getToken();
        if (user && token) {
            refreshLikes();
        } else {
            setLikedProducts([]);
            setLikesCount({});
        }
    }, [user]);

    const refreshLikes = async () => {
        const token = getToken();
        if (!user || !token) return;

        try {
            setLikesLoading(true);
            const response = await axios.get(`/api/likes`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (response.data.res === 'success') {
                const productIds = response.data.liked_products.map((product: any) => product.id);
                setLikedProducts(productIds);

                // Update likes count for each product
                const countsMap: { [productId: number]: number } = {};
                response.data.liked_products.forEach((product: any) => {
                    countsMap[product.id] = product.likes_count || 0;
                });
                setLikesCount(countsMap);
            }
        } catch (error) {
            console.error('Error fetching liked products:', error);
        } finally {
            setLikesLoading(false);
        }
    };

    const toggleLike = async (productId: number): Promise<boolean> => {
        const token = getToken();
        if (!user || !token) {
            return false;
        }

        try {
            setLikesLoading(true);

            const response = await axios.post(`/api/likes/toggle`,
                { product_id: productId },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (response.data.res === 'success') {
                const { liked, likes_count } = response.data;

                if (liked) {
                    setLikedProducts(prev => [...prev, productId]);
                } else {
                    setLikedProducts(prev => prev.filter(id => id !== productId));
                }

                // Update likes count for this product
                setLikesCount(prev => ({
                    ...prev,
                    [productId]: likes_count
                }));

                return true;
            }
            return false;
        } catch (error) {
            console.error('Error toggling like:', error);
            return false;
        } finally {
            setLikesLoading(false);
        }
    };

    const isLiked = (productId: number): boolean => {
        return likedProducts.includes(productId);
    };

    const getLikesCount = (productId: number): number => {
        return likesCount[productId] || 0;
    };

    // Fetch likes count for products when needed
    const fetchLikesCount = async (productIds: number[]) => {
        const token = getToken();
        if (!user || !token || productIds.length === 0) return;

        try {
            const response = await axios.post(`/api/likes/bulk-check`,
                { product_ids: productIds },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (response.data.res === 'success') {
                const { likes_data } = response.data;
                const countsMap: { [productId: number]: number } = {};
                const likedIds: number[] = [];

                Object.entries(likes_data).forEach(([productId, data]: [string, any]) => {
                    const id = parseInt(productId);
                    countsMap[id] = data.likes_count || 0;
                    if (data.is_liked) {
                        likedIds.push(id);
                    }
                });

                setLikesCount(prev => ({ ...prev, ...countsMap }));
                setLikedProducts(prev => {
                    const newLiked = [...prev];
                    likedIds.forEach(id => {
                        if (!newLiked.includes(id)) {
                            newLiked.push(id);
                        }
                    });
                    return newLiked;
                });
            }
        } catch (error) {
            console.error('Error fetching likes count:', error);
        }
    };

    const value: LikeContextType = {
        likedProducts,
        likesLoading,
        toggleLike,
        isLiked,
        refreshLikes,
        getLikesCount,
    };

    return (
        <LikeContext.Provider value={value}>
            {children}
        </LikeContext.Provider>
    );
};