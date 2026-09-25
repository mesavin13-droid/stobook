import { PaymentRecord, PaymentService } from '../../types';

export class DemoPaymentService implements PaymentService {
  async createPayment(params: {
    userId: string;
    serviceCenterId?: string;
    type: 'SUBSCRIPTION' | 'PROMOTION';
    amount: number;
    currency: string;
    metadata?: Record<string, any>;
  }): Promise<{ paymentId: string; redirectUrl?: string; status: string }> {
    const paymentId = 'pay_' + Math.random().toString(36).substring(2, 12);

    return {
      paymentId,
      redirectUrl: `/payment-success?paymentId=${paymentId}`,
      status: 'SUCCEEDED' // For demo, immediately approved
    };
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    return 'SUCCEEDED';
  }

  async handleWebhook(payload: any, signature: string): Promise<{ handled: boolean; paymentId?: string }> {
    return {
      handled: true,
      paymentId: payload?.id
    };
  }
}

export function createPaymentService(provider: string = 'demo'): PaymentService {
  return new DemoPaymentService();
}
