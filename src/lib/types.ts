import type { AuditDetailsJson, OrderItemJson } from '@/db/schema';

export interface CategoryDTO {
  id: number;
  name: string;
  slug: string;
  iconName: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductVariantDTO {
  id: number;
  productId: number;
  groupName: string;
  optionName: string;
  additionalPrice: number;
  isRequired: boolean;
}

export interface ProductDTO {
  id: number;
  categoryId: number;
  categoryName?: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice: number | null;
  imageUrl: string;
  badgeLabel: string | null;
  isLimitedStock: boolean;
  dailyQuota: number;
  remainingStock: number;
  isAvailable: boolean;
  createdAt: string;
  variants: ProductVariantDTO[];
}

export interface PromoDTO {
  id: number;
  title: string;
  subtitle: string;
  discountText: string;
  bannerImageUrl: string;
  isActive: boolean;
  validUntil: string | null;
}

export interface VoucherDTO {
  id: number;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export interface CafeTableDTO {
  id: number;
  tableNumber: string;
  qrToken: string;
  isActive: boolean;
}

export interface OrderDTO {
  id: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderType: 'Dine-In' | 'Pickup' | 'Delivery';
  tableNumber: string | null;
  itemsJson: OrderItemJson[];
  subtotal: number;
  voucherCode: string | null;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'Cash' | 'QRIS' | 'Transfer';
  orderStatus: 'Pending' | 'Brewing' | 'Ready' | 'Completed' | 'Cancelled';
  notes: string | null;
  createdAt: string;
}

export interface AuditLogDTO {
  id: number;
  actorName: string;
  actionType: string;
  targetEntity: string;
  detailsJson: AuditDetailsJson;
  createdAt: string;
}

export interface StoreSettingsDTO {
  id: number;
  cafeName: string;
  tagline: string;
  address: string;
  mapsEmbedUrl: string;
  openingHours: string;
  whatsappNumber: string;
  isOpenNow: boolean;
}

export interface PublicVoucherDTO {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  validUntil: string;
}

export interface CatalogData {
  categories: CategoryDTO[];
  products: ProductDTO[];
  promos: PromoDTO[];
  vouchers: PublicVoucherDTO[];
  tables: CafeTableDTO[];
  settings: StoreSettingsDTO;
  isFallbackData?: boolean;
}

export interface SelectedVariant {
  group_name: string;
  option_name: string;
  additional_price: number;
}

export interface CartItem {
  cartKey: string;
  productId: number;
  name: string;
  categoryName: string;
  imageUrl: string;
  basePrice: number;
  selectedVariants: SelectedVariant[];
  unitTotal: number;
  qty: number;
  isLimitedStock: boolean;
  remainingStock: number;
}

