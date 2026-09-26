import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface VerifiedInitData {
  isValid: boolean;
  user?: TelegramUser;
  authDate?: number;
  raw?: Record<string, string>;
}

/**
 * Validates Telegram WebApp initData string using HMAC-SHA256
 * As per Telegram Mini Apps documentation
 */
export function verifyInitData(initDataString: string, botToken?: string): VerifiedInitData {
  if (!initDataString || !botToken || botToken === 'your-telegram-bot-token') {
    return { isValid: false };
  }

  try {
    const params = new URLSearchParams(initDataString);
    const hash = params.get('hash');
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return { isValid: false };
    }

    params.delete('hash');

    const userJson = params.get('user');
    let user: TelegramUser | undefined;
    if (userJson) {
      const parsed = JSON.parse(userJson) as Partial<TelegramUser>;
      if (typeof parsed.id !== 'number' || typeof parsed.first_name !== 'string') {
        return { isValid: false };
      }
      user = parsed as TelegramUser;
    }

    const authDateValue = params.get('auth_date');
    const authDate = authDateValue ? Number(authDateValue) : Number.NaN;
    if (!Number.isInteger(authDate) || authDate <= 0 || Math.abs(Date.now() / 1000 - authDate) > 86400) {
      return { isValid: false };
    }
    if (!user) {
      return { isValid: false };
    }

    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys.map((key) => `${key}=${params.get(key)}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
    const providedHash = Buffer.from(hash, 'hex');
    const isValid = calculatedHash.length === providedHash.length && crypto.timingSafeEqual(calculatedHash, providedHash);

    return {
      isValid,
      user,
      authDate,
      raw: Object.fromEntries(params.entries())
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Sends a message via Telegram Bot API
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] || character);
}

export async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'your-telegram-bot-token') {
    console.log(`[Telegram Simulation] To: ${chatId} | Message:\n${text}`);
    return true;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    if (!res.ok) {
      return false;
    }
    const result = await res.json() as { ok?: boolean };
    return result.ok === true;
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return false;
  }
}

/**
 * Sends booking confirmation notification
 */
export async function sendBookingConfirmation(telegramId: number, params: {
  serviceCenterName: string;
  dateStr: string;
  timeStr: string;
  vehicleName: string;
  serviceName: string;
  priceStr: string;
  address: string;
}) {
  const text = `🚗 <b>Запись создана в STOBOOK</b>\n\n` +
    `📍 <b>${escapeHtml(params.serviceCenterName)}</b>\n` +
    `📅 ${escapeHtml(params.dateStr)} в <b>${escapeHtml(params.timeStr)}</b>\n` +
    `🚘 Автомобиль: ${escapeHtml(params.vehicleName)}\n` +
    `🔧 Услуга: ${escapeHtml(params.serviceName)}\n` +
    `💰 Стоимость: от ${escapeHtml(params.priceStr)}\n` +
    `🗺 Адрес: ${escapeHtml(params.address)}\n\n` +
    `<i>Автосервис уже уведомлен. Мы пришлем напоминание за 1 час до визита!</i>`;

  return sendTelegramMessage(telegramId, text);
}

/**
 * Sends 1-hour booking reminder with interactive buttons
 */
export async function sendBookingReminder(telegramId: number, params: {
  appointmentId: string;
  serviceCenterName: string;
  timeStr: string;
  vehicleName: string;
  serviceName: string;
  appUrl: string;
}) {
  const text = `⏰ <b>Напоминание о записи в STOBOOK</b>\n\n` +
    `Сегодня в <b>${escapeHtml(params.timeStr)}</b>\n` +
    `СТО: <b>${escapeHtml(params.serviceCenterName)}</b>\n` +
    `🔧 ${escapeHtml(params.serviceName)}\n` +
    `🚘 ${escapeHtml(params.vehicleName)}\n\n` +
    `Пожалуйста, подтвердите визит или отмените, если планы изменились:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Подтвердить', callback_data: `confirm_${params.appointmentId}` },
        { text: '❌ Не смогу приехать', callback_data: `cancel_${params.appointmentId}` }
      ],
      [
        { text: '📍 Открыть в приложении', url: `${params.appUrl}?appointmentId=${params.appointmentId}` }
      ]
    ]
  };

  return sendTelegramMessage(telegramId, text, replyMarkup);
}

/**
 * Sends cancellation notification
 */
export async function sendBookingCancellation(telegramId: number, params: {
  serviceCenterName: string;
  timeStr: string;
  serviceName: string;
  reason?: string;
}) {
  const text = `❌ <b>Запись отменена</b>\n\n` +
    `СТО: ${escapeHtml(params.serviceCenterName)}\n` +
    `Время: ${escapeHtml(params.timeStr)}\n` +
    `Услуга: ${escapeHtml(params.serviceName)}\n` +
    (params.reason ? `Причина: ${escapeHtml(params.reason)}\n` : '') +
    `\n<i>Слот снова доступен для других водителей. Ждем вас в следующий раз!</i>`;

  return sendTelegramMessage(telegramId, text);
}
