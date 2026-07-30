import { prisma } from "./prisma-client";

const initialStories = [
  {
    title: "Неделя Acne",
    slides: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763127821/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_16.43.33_ilx8ql.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763133407/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_18.16.39_hu9xjn.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763133813/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_18.23.26_jxd8bb.png",
    ],
  },
  {
    title: "Дроп Fragment x Travis Scott",
    slides: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763129091/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_17.04.43_tdixee.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763135311/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_18.48.22_u8qeuc.png",
    ],
  },
  {
    title: "Распродажа Minion x Swarovski",
    slides: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763129245/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_17.07.15_zgaauj.png",
    ],
  },
];

async function main() {
  const existing = await prisma.story.count();
  if (existing > 0) {
    console.log(`Уже есть ${existing} сторис в БД, пропускаю сид.`);
    return;
  }

  for (let i = 0; i < initialStories.length; i++) {
    const s = initialStories[i];
    await prisma.story.create({
      data: {
        title: s.title,
        order: i,
        Slides: {
          create: s.slides.map((imageUrl, order) => ({ imageUrl, order })),
        },
      },
    });
  }

  console.log(`Создано ${initialStories.length} сторис.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
