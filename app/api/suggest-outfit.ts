import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      // Получаем ID продукта из запроса
      const { productId } = req.body;

      // Здесь будет логика для взаимодействия с нейросетью или внешним API
      // Примерный ответ от нейросети
      const suggestedOutfit = await getSuggestedOutfit(productId);

      // Отправляем ответ с подобранными вещами
      res.status(200).json({ outfit: suggestedOutfit });
    } catch (error) {
      res.status(500).json({ error: 'Не удалось получить образ' });
    }
  } else {
    res.status(405).json({ error: 'Метод не поддерживается' });
  }
}

// Примерная логика для получения рекомендованного образа
async function getSuggestedOutfit(productId: number) {
  // Эмуляция работы нейросети, ты должен подключить реальный сервис
  const outfits = [
    { top: 'T-shirt', bottom: 'Jeans', accessories: 'Hat' },
    { top: 'Sweater', bottom: 'Chinos', accessories: 'Glasses' },
    // добавь сюда другие варианты
  ];

  // Возвращаем случайный набор одежды
  return outfits[Math.floor(Math.random() * outfits.length)];
}
