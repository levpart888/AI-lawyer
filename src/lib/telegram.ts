import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const API_BASE = "https://api.telegram.org";

async function sendMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      console.error("Telegram sendMessage failed", await res.text());
    }
  } catch (err) {
    console.error("Telegram sendMessage error", err);
  }
}

// Сообщение в закрытый канал Лиги. Fire-and-forget — ошибки логируются, не блокируют операцию.
export async function notifyChannel(text: string) {
  const chatId = process.env.TELEGRAM_CHANNEL_CHAT_ID;
  if (!chatId) return;
  await sendMessage(chatId, text);
}

// Личное уведомление участнику (если у него указан telegram_chat_id). Fire-and-forget.
export async function notifyPersonal(profileId: string, text: string) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", profileId)
      .maybeSingle();

    if (data?.telegram_chat_id) {
      await sendMessage(data.telegram_chat_id, text);
    }
  } catch (err) {
    console.error("notifyPersonal error", err);
  }
}
