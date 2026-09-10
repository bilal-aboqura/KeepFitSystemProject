export interface Customer {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  full_name: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  is_default: boolean;
}

export const customerProfileFields = ["full_name", "phone"] as const;
