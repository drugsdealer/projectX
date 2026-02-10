import { Prisma } from '@prisma/client';

// NOTE: `include` keys must match relation field names from your Prisma schema.
// Your TS errors suggest the relation is named `Brand` (capital B), not `brand`.
export type ProductWithBrand = Prisma.ProductGetPayload<{
  include: {
    Brand: true;
  };
}>;

// Backwards-compatible alias (if you used this name across the codebase)
export type ProductWithImages = ProductWithBrand;