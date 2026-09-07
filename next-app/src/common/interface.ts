export interface LoginFormData {
  email: string;
  password: string;
}

export enum UserRole {
  ADMIN = 1,
  USER = 2,
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  password: string;
  password_confirmation: string;
};

export interface RegisterUser {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone_number?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone_number?: string;
  address?: string;
  profile_picture?: string;
  role: string;
  roles?: string[];
  status: boolean;
  is_verified?: boolean;
  email_verified_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiResponse<T> {
  result?: T;
  message?: string;
  success: boolean;
  errors: string[];
}

export interface ProductVariant {
  id: string | number;
  title?: string | null;
  sku: string;
  mrp: string;
  sp: string;
  bp: string;
  stock: number;
  image_url?: string | null;
  image_json?: string | null;
  product_id: string | number;
  attribute_values?: AttributeValue[];
  status: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  description: string;
  itemCode?: string;
  imageUrl?: string;
  image_url?: string;
  imageJson?: string[];
  detailList?: { key: string; value: string }[];
  featureList?: string[];
  status: boolean;
  variants?: ProductVariant[];
  item_code?: string;
  image_json?: string;
  feature_json?: string;
  detail_json?: string;
  category?: any;
  brand?: any;
  brand_id?: number | string;
  brandId?: number | string;
  category_id?: number | string;
  categoryId?: number | string;
  item_attributes?: ItemAttribute[];
  itemAttributes?: any[];
  product_attribute_values?: ProductAttributeValue[];
  productAttributeValues?: any[];
}

export interface ItemAttribute {
  product_id: number;
  attribute_id: number;
  has_images: boolean;
  is_primary: boolean;
  attribute?: Attribute;
}

export interface ProductAttributeValue {
  product_id: number;
  attribute_id: number;
  attribute_value_id: number;
  attribute?: Attribute;
  attribute_value?: AttributeValue;
}

export interface RawProduct {
  id: string;
  name: string;
  slug?: string;
  description: string;
  item_code?: string;
  image_url: string;
  status: boolean;
  image_json?: string;
  feature_json?: string;
  detail_json?: string;
  variants?: any[];
  category?: any;
  brand?: any;
}

export interface DropdownOption {
  id: string | number;
  value: string;
}

export interface CategoryAttribute {
  attributeId: number;
  name: string;
  has_images: boolean;
  values: DropdownOption[];
}

export interface CreateCategory {
  name: string;
  description: string;
  link: string;
  image?: string;
  secondary_image?: string;
  hsn?: string | null;
  cgst?: string | number | null;
  sgst?: string | number | null;
  igst?: string | number | null;
}

export interface Category extends CreateCategory {
  id: string;
  slug?: string;
  status: boolean;
  attributes?: CategoryAttribute[];
}

export interface Attribute {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  status: boolean;
  has_images?: boolean;
  is_primary?: boolean;
  result?: any;
  pivot?: {
    category_id: number;
    attribute_id: number;
    has_images: boolean;
    is_primary: boolean;
  };
}

export interface TopbarAnnouncement {
  id: number;
  title: string;
  icon?: string | null;
  link_url?: string | null;
  status: 'active' | 'inactive';
}

export interface AttributeValue extends AttributeValuePayload {
  id: number;
  created_at: string;
  updated_at: string;
  attribute?: Attribute;
}

export interface AttributeValuePayload {
  value: string;
  description?: string;
  status: boolean;
  attribute_id: number;
};

export interface Subcategory {
  id: string;
  name: string;
  parent_id: number;
  description?: string;
  image?: string;
  secondary_image?: string;
  status: boolean;
  link?: string;
  hsn?: string | null;
  cgst?: string | number | null;
  sgst?: string | number | null;
  igst?: string | number | null;
  attribute_ids?: number[];
  attributes: Attribute[];
}

export interface Brand {
  id: string;
  name: string;
  slug?: string;
  status: boolean;
  description?: string;
  description1?: string;
  description2?: string;
  description3?: string;
  image1?: string;
  image2?: string;
  image3?: string;
}

export interface ImageItem {
  url: string;
  selected: boolean;
}

export interface Slider {
  id: number;
  title?: string;
  description?: string;
  image: string;
  link?: string;
  open_in_new_tab?: boolean;
  status: boolean;
  show_buttons: boolean;
  button1_text?: string;
  button1_link?: string;
  button2_text?: string;
  button2_link?: string;
}

export interface ProductDetail {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  item_code?: string;
  category_id?: number;
  brand_id?: number;
  status?: boolean;
  feature_json?: string;
  detail_json?: string;
  image_url: string | null;
  image_json?: string;
  variants: ProductVariant[];
  item_attributes: ItemAttribute[];
  category?: Category;
  brand?: Brand;
  rating_summary?: {
    average_rating: number;
    total_reviews: number;
    rating_distribution: { [key: number]: number };
  };
};


