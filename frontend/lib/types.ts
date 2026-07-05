export type Status = "fresh" | "warning" | "danger" | "expired";

export type Material =
  | "plastico"
  | "vidrio"
  | "metal"
  | "carton"
  | "organico"
  | "general"
  | "desconocido";

export interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  material: Material;
  category: string;
  added_date: string;
  expiry_date: string;
  opened_date: string | null;
  shelf_closed: number;
  shelf_opened: number;
  changes_on_open: boolean;
  days_left: number;
  status: Status;
}

export interface ScanItem {
  name: string;
  quantity: number;
  price: number;
  material: Material;
  category: string;
}

export interface WasteEntry {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
  material: string;
  wasted_at: string;
}

export interface DashboardData {
  total_lost: number;
  waste: WasteEntry[];
  status_counts: Record<Status, number>;
}
