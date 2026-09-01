const INVENTORY_IMAGE_BY_NAME: Record<string, string> = {
  'arcage rider rental': '/uploads/inventory/acreage_rider_1600x400.png',
  'black flyer box': '/uploads/inventory/black_flyer_box_1200x1200.png',
  'black signpost': '/uploads/inventory/black_sign_post_1200x1200.jpg',
  'black sign post': '/uploads/inventory/black_sign_post_1200x1200.jpg',
  'custom signpost': '/uploads/inventory/custom_color_sign_post_1200x1200.jpg',
  'custom color sign post': '/uploads/inventory/custom_color_sign_post_1200x1200.jpg',
  'custom rider change': '/uploads/inventory/coming_soon_rider_1600x400.png',
  'for lease rider': '/uploads/inventory/for_lease_rider_1600x400.png',
  'for lease rider rental': '/uploads/inventory/for_lease_rider_alt_1600x400.png',
  'for sale rider': '/uploads/inventory/for_sale_rider_1600x400.png',
  'for sale rider rental': '/uploads/inventory/for_sale_rider_1600x400.png',
  'rider change credit': '/uploads/inventory/coming_soon_rider_1600x400.png',
  'white flyer box': '/uploads/inventory/white_flyer_box_1200x1200.png',
  'white signpost': '/uploads/inventory/white_signpost_1200x1200.jpg',
};

export function resolveInventoryImageUrl(name: string, imageUrl: string | null): string | null {
  const key = name.trim().toLowerCase();
  return INVENTORY_IMAGE_BY_NAME[key] ?? imageUrl;
}
