export type BostaStateTone = "neutral" | "info" | "warning" | "success" | "danger";

export interface BostaStateDefinition {
  code: number;
  value: string;
  dashboard: string;
  labelEn: string;
  labelAr: string;
  tone: BostaStateTone;
}

const states: BostaStateDefinition[] = [
  { code: 10, value: "Pickup requested", dashboard: "New", labelEn: "New shipment", labelAr: "شحنة جديدة", tone: "neutral" },
  { code: 11, value: "Waiting for route", dashboard: "In progress", labelEn: "Waiting for pickup", labelAr: "في انتظار الاستلام", tone: "info" },
  { code: 20, value: "Route Assigned", dashboard: "In progress", labelEn: "Pickup assigned", labelAr: "تم تعيين مندوب الاستلام", tone: "info" },
  { code: 21, value: "Picked up from business", dashboard: "Picked up", labelEn: "Picked up", labelAr: "تم استلام الشحنة", tone: "info" },
  { code: 22, value: "Picking up from consignee", dashboard: "Heading to customer", labelEn: "Heading to customer", labelAr: "متجهة للعميل", tone: "info" },
  { code: 23, value: "Picked up from consignee", dashboard: "Picked up", labelEn: "Return picked up", labelAr: "تم استلام المرتجع", tone: "warning" },
  { code: 24, value: "Received at warehouse", dashboard: "In progress", labelEn: "At warehouse", labelAr: "في مخزن بوسطة", tone: "info" },
  { code: 25, value: "Fulfilled", dashboard: "Fulfilled", labelEn: "Fulfilled", labelAr: "تم التجهيز", tone: "info" },
  { code: 30, value: "In transit between Hubs", dashboard: "In progress", labelEn: "In transit", labelAr: "في الطريق بين المخازن", tone: "info" },
  { code: 40, value: "Picking up", dashboard: "Heading to customer", labelEn: "Out for delivery", labelAr: "خرجت للتسليم", tone: "info" },
  { code: 41, value: "Picked up", dashboard: "Heading to customer", labelEn: "Out for delivery", labelAr: "متجهة للعميل", tone: "info" },
  { code: 45, value: "Delivered", dashboard: "Successful", labelEn: "Delivered", labelAr: "تم التسليم", tone: "success" },
  { code: 46, value: "Returned to business", dashboard: "Successful", labelEn: "Returned", labelAr: "تم إرجاع الشحنة", tone: "danger" },
  { code: 47, value: "Exception", dashboard: "In progress", labelEn: "Needs attention", labelAr: "تحتاج متابعة", tone: "warning" },
  { code: 48, value: "Terminated", dashboard: "Terminated", labelEn: "Terminated", labelAr: "تم إنهاء الشحنة", tone: "danger" },
  { code: 49, value: "Canceled", dashboard: "In progress", labelEn: "Cancelled", labelAr: "تم إلغاء الشحنة", tone: "danger" },
  { code: 60, value: "Returned to stock", dashboard: "Returned", labelEn: "Returned to stock", labelAr: "عادت للمخزن", tone: "danger" },
  { code: 100, value: "Lost", dashboard: "Unsuccessful", labelEn: "Lost", labelAr: "الشحنة مفقودة", tone: "danger" },
  { code: 101, value: "Damaged", dashboard: "Unsuccessful", labelEn: "Damaged", labelAr: "الشحنة تالفة", tone: "danger" },
  { code: 102, value: "Investigation", dashboard: "In progress", labelEn: "Under investigation", labelAr: "قيد التحقيق", tone: "warning" },
  { code: 103, value: "Awaiting your action", dashboard: "Awaiting your action", labelEn: "Awaiting action", labelAr: "في انتظار متابعتك", tone: "warning" },
  { code: 104, value: "Archived", dashboard: "Archived", labelEn: "Archived", labelAr: "مؤرشفة", tone: "neutral" },
  { code: 105, value: "On hold", dashboard: "In progress", labelEn: "On hold", labelAr: "موقوفة مؤقتًا", tone: "warning" },
];

export function getBostaStateMeta(code: number): BostaStateDefinition {
  return states.find((state) => state.code === code) ?? {
    code,
    value: "Unknown",
    dashboard: "Unknown",
    labelEn: "In progress",
    labelAr: "قيد التنفيذ",
    tone: "neutral",
  };
}
