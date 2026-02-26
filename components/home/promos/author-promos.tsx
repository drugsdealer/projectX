import FstuStudiosSpotlight from '@/components/home/FstuStudiosSpotlight';
import type { HomePromoProduct } from '@/components/home/promos/types';

export const AUTHOR_PROMOS_HELP_PATH = 'components/home/promos/author-promos.tsx';

const FSTU_CLOUDINARY_ASSETS = {
  // Вставь сюда свои Cloudinary URL
  // backgroundImageUrl: 'https://res.cloudinary.com/<cloud>/image/upload/<bg>.jpg',
  // logoImageUrl: 'https://res.cloudinary.com/<cloud>/image/upload/<logo>.png',
  // bowImageUrl: 'https://res.cloudinary.com/<cloud>/image/upload/<bow>.png',
};

/**
 * Здесь можно создавать полностью кастомные авторские промо блоки для главной.
 * Сложные дизайны лучше хранить именно в этом файле, а типовые — через CMS.
 */
export function renderAuthorHomePromo(sectionIndex: number, items: HomePromoProduct[]) {
  if (sectionIndex !== 2) return null;

  return (
    <FstuStudiosSpotlight
      items={items}
      badgeLabel="FSTU STUDIOS"
      seasonLabel="acne SS 26"
      assets={FSTU_CLOUDINARY_ASSETS}
      emptyHint="Добавьте товары бренда FSTU/ACNE, чтобы заполнить авторский блок."
    />
  );
}
