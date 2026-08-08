import { prisma } from "@/lib/prisma";
import { productPath } from "@/lib/product-url";
import { getStoryImageUrl, getOptimizedImageUrl } from "@/lib/media";

export async function getActiveStories() {
  const stories = await prisma.story.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      Slides: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          imageUrl: true,
          caption: true,
          description: true,
          Products: {
            orderBy: { order: "asc" },
            select: {
              Product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  imageUrl: true,
                  available: true,
                  deletedAt: true,
                  Brand: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return stories
    .filter((s) => s.Slides.length > 0)
    .map((s) => ({
      id: s.id,
      title: s.title,
      slides: s.Slides.map((slide) => ({
        id: slide.id,
        image: getStoryImageUrl(slide.imageUrl, 900),
        thumb: getStoryImageUrl(slide.imageUrl, 160),
        caption: slide.caption,
        description: slide.description,
        products: slide.Products
          .filter((sp) => sp.Product && !sp.Product.deletedAt && sp.Product.available)
          .map((sp) => ({
            id: sp.Product.id,
            name: sp.Product.name,
            subtitle: sp.Product.Brand?.name ?? null,
            price: sp.Product.price,
            image: getOptimizedImageUrl(sp.Product.imageUrl, { width: 160 }),
            href: productPath({
              id: sp.Product.id,
              name: sp.Product.name,
              brandName: sp.Product.Brand?.name,
            }),
          })),
      })),
    }));
}

export type ActiveStory = Awaited<ReturnType<typeof getActiveStories>>[number];
