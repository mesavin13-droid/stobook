import React, { useState } from 'react';
import { Appointment } from '../../types';
import { X, Star, AlertCircle } from 'lucide-react';
import { reviewSchema } from '../../validations';
import { triggerHaptic } from '../../lib/telegram/webapp';

interface AddReviewModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

export const AddReviewModal: React.FC<AddReviewModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onReviewSubmitted
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parse = reviewSchema.safeParse({
      appointmentId: appointment.id,
      serviceCenterId: appointment.service_center_id,
      rating,
      comment
    });

    if (!parse.success) {
      setError(parse.error.issues[0]?.message || 'Заполните отзыв');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parse.data)
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Ошибка отправки отзыва');
      }

      triggerHaptic('success');
      onReviewSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить отзыв');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Как прошёл визит?</h3>
            <p className="text-xs text-slate-500">{appointment.service_center?.name || 'Автосервис'}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Star selector */}
          <div className="text-center py-2">
            <p className="text-xs font-semibold text-slate-600 mb-2">Оцените качество обслуживания:</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => {
                    setRating(star);
                    triggerHaptic('selection');
                  }}
                  className="p-1 focus:outline-none transition-transform hover:scale-125"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Ваш отзыв:</label>
            <textarea
              required
              rows={3}
              placeholder="Расскажите о впечатлениях: чистота бокса, пунктуальность, качество работ..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            {submitting ? 'Отправка...' : 'Оставить отзыв'}
          </button>
        </form>
      </div>
    </div>
  );
};
