export const typeIds = {
  retail: "10000000-0000-4000-8000-000000000001",
  wholesale: "10000000-0000-4000-8000-000000000002",
  gym_owner: "10000000-0000-4000-8000-000000000003",
};

export const customerIds = {
  primary: "20000000-0000-4000-8000-000000000001",
  secondary: "20000000-0000-4000-8000-000000000002",
};

export const adminUserId = "30000000-0000-4000-8000-000000000001";

export const validWholesaleRequest = {
  requested_type_code: "wholesale",
  business_name: "Example Trading",
  business_phone: "٠١٠ ١٢٣٤ ٥٦٧٨",
  governorate: "Cairo",
  city: "Nasr City",
  business_description: "Car-care wholesale business",
  customer_note: "Please review our application.",
};

export const validGymRequest = {
  requested_type_code: "gym_owner",
  business_name: "Example Gym",
  business_phone: "01112345678",
  governorate: "Gharbia",
  city: "Tanta",
};
