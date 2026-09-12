export type CatalogValueType = "option" | "text" | "number" | "boolean";
export type CatalogMediaProvider = "r2" | "legacy";

export interface CatalogCategory {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  image: string | null;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface CatalogBrand {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  logo_media_id: string | null;
  is_active: boolean;
}

export interface AttributeDefinition {
  id: string;
  code: string;
  label_en: string;
  label_ar: string;
  value_type: CatalogValueType;
  unit: string | null;
  is_variant_defining: boolean;
  is_filterable: boolean;
  is_visible: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface AttributeValue {
  id: string;
  attribute_definition_id: string;
  code: string;
  label_en: string;
  label_ar: string;
  sort_order: number;
  is_active: boolean;
}

export interface CatalogAttributeAssignment {
  attribute_definition_id: string;
  attribute_value_id?: string | null;
  text_value?: string | null;
  number_value?: number | null;
  boolean_value?: boolean | null;
  definition?: AttributeDefinition;
  value?: AttributeValue | null;
}

export interface CatalogMedia {
  id: string;
  provider: CatalogMediaProvider;
  object_key: string;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  alt_en: string;
  alt_ar: string;
  public_url: string;
  sort_order: number;
  is_primary: boolean;
  archived_at: string | null;
}

export interface CatalogVariant {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  label_en: string;
  label_ar: string;
  base_price: number;
  compare_at_price: number | null;
  stock: number;
  is_default: boolean;
  is_active: boolean;
  archived_at: string | null;
  combination_fingerprint: string;
  attributes: CatalogAttributeAssignment[];
  media: CatalogMedia[];
}

export interface ProductSpecification extends CatalogAttributeAssignment {
  id: string;
  product_id: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  category_id: string | null;
  brand_id: string | null;
  name_en: string;
  name_ar: string;
  short_desc_en: string;
  short_desc_ar: string;
  long_desc_en: string;
  long_desc_ar: string;
  is_active: boolean;
  is_featured: boolean;
  seo_title_en: string | null;
  seo_title_ar: string | null;
  seo_description_en: string | null;
  seo_description_ar: string | null;
  category: CatalogCategory | null;
  brand: CatalogBrand | null;
  variants: CatalogVariant[];
  specifications: ProductSpecification[];
  media: CatalogMedia[];
}

export interface VariantCartSnapshot {
  variant_id: string;
  product_id: string;
  slug: string;
  sku: string;
  name_en: string;
  name_ar: string;
  variant_label_en: string;
  variant_label_ar: string;
  price: number;
  image: string;
  stock: number;
}

export interface OrderVariantSnapshot {
  variant_id: string;
  product_id: string;
  sku: string;
  product_name_en: string;
  product_name_ar: string;
  variant_label_en: string;
  variant_label_ar: string;
  price: number;
}
