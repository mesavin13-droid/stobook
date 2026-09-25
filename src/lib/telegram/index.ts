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
  if (!initDataString) {
    return { isValid: false };
  }

  try {
    const params = new URLSearchParams(initDataString);
    const hash = params.get('hash');
    if (!hash) return { isValid: false };

    params.delete('hash');

    // Parse user object if present
    const userJson = params.get('user');
    let user: TelegramUser | undefined;
    if (userJson) {
      try {
        user = JSON.parse(userJson);
      } catch (e) {
        console.error('Failed to parse telegram user json', e);
      }
    }

    const authDateStr = params.get('auth_date');
    const authDate = authDateStr ? parseInt(authDateStr, 10) : undefined;

    // In local development or if no botToken configured, permit mock/demo validation if user object exists
    if (!botToken || botToken === 'your-telegram-bot-token') {
      return {
        isValid: true,
        user: user || { id: 1097348022, first_name: 'Дмитрий', username: 'dmitry_nsk' },
        authDate: authDate || Math.floor(Date.now() / 1000)
      };
    }

    // Sort parameters alphabetically
    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys.map((key) => `${key}=${params.get(key)}`).join('\n');

    // HMAC calculation
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const isValid = calculatedHash === hash;

    return {
      isValid,
      user,
      authDate,
      raw: Object.fromEntries(params.entries())
    };
  } catch (error) {
    console.error('Error verifying initData:', error);
    return { isValid: false };
  }
}

/**
 * Sends a message via Telegram Bot API
 */
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
    const result = await res.json();
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
    `📍 <b>${params.serviceCenterName}</b>\n` +
    `📅 ${params.dateStr} в <b>${params.timeStr}</b>\n` +
    `🚘 Автомобиль: ${params.vehicleName}\n` +
    `🔧 Услуга: ${params.serviceName}\n` +
    `💰 Стоимость: от ${params.priceStr}\n` +
    `🗺 Адрес: ${params.address}\n\n` +
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
    `Сегодня в <b>${params.timeStr}</b>\n` +
    `СТО: <b>${params.serviceCenterName}</b>\n` +
    `🔧 ${params.serviceName}\n` +
    `🚘 ${params.vehicleName}\n\n` +
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
    `СТО: ${params.serviceCenterName}\n` +
    `Время: ${params.timeStr}\n` +
    `Услуга: ${params.serviceName}\n` +
    (params.reason ? `Причина: ${params.reason}\n` : '') +
    `\n<i>Слот снова доступен для других водителей. Ждем вас в следующий раз!</i>`;

  return sendTelegramMessage(telegramId, text);
}
