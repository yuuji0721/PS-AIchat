// lib/ai.ts
export async function getAiResponse(message: string, history: any[]) {
  // history が引数に入っているか確認！

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // ❌ 間違い: JSON.stringify({ message })
    // ⭕ 正解: 以下のように `history` を一緒に送る！
    body: JSON.stringify({ message, history }), 
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("サーバーエラー詳細:", data.error);
    throw new Error(data.error ?? "APIエラー");
  }

  return data.reply;
}