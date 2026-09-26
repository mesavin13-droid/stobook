import { PaymentRecord, PaymentService } from '../../types';

/**
 * Заглушка платёжного провайдера для локальной разработки.
 *
 * Оплату она никогда не подтверждает: createPayment и getPaymentStatus
 * возвращают PENDING, а webhook игнорируется. Статус PENDING выбран сознательно,
 * потому что прежний SUCCEEDED позволял включить подписку или продвижение без
 * поступления денег. В production сервис бросает исключение.
 */
export class DemoPaymentService implements PaymentService {
  async createPayment(params: {
    userId: string;
    serviceCenterId?: string;
    type: 'SUBSCRIPTION' | 'PROMOTION';
    amount: number;
    currency: string;
    metadata?: Record<string, any>;
  }): Promise<{ paymentId: string; redirectUrl?: string; status: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'DemoPaymentService запрещён в production: подключите реального платёжного провайдера (ЮKassa, Т-Банк).'
      );
    }

    const paymentId = 'pay_' + Math.random().toString(36).substring(2, 12);

    return {
      paymentId,
      redirectUrl: `/payment-success?paymentId=${paymentId}`,
      status: 'PENDING'
    };
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    return 'PENDING';
  }

  async handleWebhook(payload: any, signature: string): Promise<{ handled: boolean; paymentId?: string }> {
    return { handled: false };
  }
}

export function createPaymentService(provider: string = 'demo'): PaymentService {
  if (provider !== 'demo') {
    console.warn(
      `Платёжный провайдер "${provider}" не реализован, используется заглушка. Реальные платежи работать не будут.`
    );
  }
  return new DemoPaymentService();
}
