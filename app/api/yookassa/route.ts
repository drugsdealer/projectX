// app/api/yookassa/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  try {
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": String(Date.now()),
        Authorization: "Basic " + Buffer.from("YOUR_SHOP_ID:YOUR_API_KEY").toString("base64")
      },
      body: JSON.stringify({
        amount: {
          value: body.amount,
          currency: "RUB"
        },
        confirmation: {
          type: "redirect",
          return_url: "https://yourdomain.com/thank-you"
        },
        capture: true,
        description: "Тестовая оплата"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.confirmation?.confirmation_url) {
      console.error("YooKassa API Error:", data);
      return new Response(JSON.stringify({ error: "Ошибка при создании оплаты", details: data }), {
        status: 500
      });
    }

    return new Response(JSON.stringify(data), { status: 200 });

  } catch (error) {
    console.error("YooKassa Network Error:", error);
    return new Response(JSON.stringify({ error: "Ошибка соединения с YooKassa" }), {
      status: 500
    });
  }
}