import React, { useState } from 'react';
import { Button, EmptyState, Input } from '../design-system';
import { Card } from './ownerLayout';
import { Clock, Images, Trash2 } from 'lucide-react';
import { ServiceCenterStory } from '../../types';

export interface StoriesTabProps {
  stories: ServiceCenterStory[];
  saving: boolean;
  onCreate: (payload: { mediaUrl: string; caption: string; expiresInHours: number }) => void;
  onDelete: (id: string) => void;
}

const EXPIRY_OPTIONS = [
  { value: '12', label: '12 часов' },
  { value: '24', label: 'Сутки' },
  { value: '72', label: '3 дня' },
  { value: '168', label: 'Неделя' }
];

/**
 * Публикация историй автосервиса.
 *
 * Загрузки файлов в проекте нет, поэтому владелец вставляет ссылку на фото —
 * так же, как заполняются фото самого автосервиса. Срок жизни выбирается
 * из списка: произвольную дату вводить нельзя, иначе истории жили бы вечно и
 * лента устарела бы.
 */
export const StoriesTab: React.FC<StoriesTabProps> = ({ stories, saving, onCreate, onDelete }) => {
  const [form, setForm] = useState({ mediaUrl: '', caption: '', expiresInHours: '24' });
  const canCreate = form.mediaUrl.trim().length > 0;

  const now = Date.now();
  const live = stories.filter((story) => new Date(story.expires_at).getTime() > now);

  return (
    <>
      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-[#111315]">Новая история</h2>
        </div>
        <p className="text-xs text-[#70777D] -mt-1">
          Фото выполненной работы. Истории видны в ленте на главной, пока не истёк срок.
        </p>

        <Input
          label="Ссылка на фото"
          placeholder="https://..."
          value={form.mediaUrl}
          onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
        />
        <Input
          label="Подпись"
          placeholder="Замена масла на Toyota Camry"
          value={form.caption}
          onChange={(e) => setForm({ ...form, caption: e.target.value })}
        />
        <div>
          <span className="text-xs font-bold text-[#70777D] block mb-1.5">Срок жизни</span>
          <div className="flex gap-1.5 flex-wrap">
            {EXPIRY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setForm({ ...form, expiresInHours: option.value })}
                className={`px-3 py-2 rounded-[12px] text-xs font-bold transition-colors ${
                  form.expiresInHours === option.value
                    ? 'bg-[#111315] text-[#B8F23A]'
                    : 'bg-[#ECEFF1] text-[#70777D]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {form.mediaUrl.trim() && (
          <img
            src={form.mediaUrl}
            alt="Предпросмотр"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            className="w-full max-h-64 object-cover rounded-[14px] border border-[#E1E4E6]"
          />
        )}

        <Button
          fullWidth
          disabled={saving || !canCreate}
          icon={<Images className="w-4 h-4" />}
          onClick={() => {
            onCreate({
              mediaUrl: form.mediaUrl.trim(),
              caption: form.caption.trim(),
              expiresInHours: Number(form.expiresInHours) || 24
            });
            setForm({ mediaUrl: '', caption: '', expiresInHours: '24' });
          }}
        >
          Опубликовать
        </Button>
      </Card>

      {stories.length === 0 ? (
        <EmptyState
          title="Историй пока нет"
          description="Опубликуйте фото выполненных работ — они появятся в ленте на главной"
        />
      ) : (
        stories.map((story) => {
          const expired = new Date(story.expires_at).getTime() <= now;
          return (
            <Card key={story.id}>
              <div className="flex gap-3">
                <img
                  src={story.media_url}
                  alt={story.caption || 'История'}
                  className="w-20 h-20 rounded-[12px] object-cover shrink-0 bg-[#ECEFF1]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#111315] truncate">
                    {story.caption || 'Без подписи'}
                  </p>
                  <p
                    className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                      expired ? 'text-[#A7ADB3]' : 'text-[#1B7F4B]'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {expired
                      ? 'Срок истёк'
                      : `До ${new Date(story.expires_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}`}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(story.id)}
                  className="shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-lg self-start"
                  aria-label="Удалить историю"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          );
        })
      )}

      {live.length === 0 && stories.length > 0 && (
        <p className="text-[11px] font-semibold text-[#70777D] text-center">
          Сейчас в ленте нет ни одной вашей истории
        </p>
      )}
    </>
  );
};
