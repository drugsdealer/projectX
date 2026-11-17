"use client";

import { useTrackCategoryVisit } from "@/hooks/useTrackBehavior";

/** Отмечает заход в категорию в профиле интересов (для персональной ленты на главной). */
export default function TrackCategoryVisit({ slug, name }: { slug: string | null; name: string }) {
  useTrackCategoryVisit(slug, name);
  return null;
}
