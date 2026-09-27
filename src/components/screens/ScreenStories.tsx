import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Phone, X } from 'lucide-react';
import { ServiceCenterStory, StoryGroup } from '../../types';
import { Button } from '../design-system';

export interface ScreenStoriesProps {
  groups: StoryGroup[];
  /** Индекс группы, с которой открыли. */
  startGroupIndex: number;
  onClose: () => void;
  onOpenCenter: (serviceCenterId: string) => void;
}

/** Сколько живёт одна карточка. Как в Stories: 5 секунд на фото. */
const SLIDE_MS = 5000;
const TICK_MS = 100;

/**
 * Просмотр историй: полноэкранные вертикальные карточки.
 *
 * Управление как в Telegram: тап по левой и правой половине листает, свайп —
 * тоже, стрелки клавиатуры работают для десктопа, Esc закрывает. Полоса
 * прогресса сверху показывает, сколько осталось до автоперехода.
 */
export const ScreenStories: React.FC<ScreenStoriesProps> = ({
  groups,
  startGroupIndex,
  onClose,
  onOpenCenter
}) => {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const touchStartRef = useRef<number | null>(null);

  const group = groups[groupIndex];
  const story: ServiceCenterStory | undefined = group?.stories[storyIndex];

  const close = useCallback(() => onClose(), [onClose]);

  // Вперёд: в конце автосервиса переходим к следующему, и только после
  // последнего закрываем ленту — так ведут себя Stories.
  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIndex + 1 < group.stories.length) {
      setStoryIndex(storyIndex + 1);
      setProgress(0);
      return;
    }
    if (groupIndex + 1 < groups.length) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
      setProgress(0);
      return;
    }
    close();
  }, [close, group, groupIndex, groups.length, storyIndex]);

  const goPrevious = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      setProgress(0);
      return;
    }
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setStoryIndex(Math.max(0, previousGroup.stories.length - 1));
      setProgress(0);
    }
  }, [groupIndex, groups, storyIndex]);

  // Автопереход. Пока пользователь держит палец, таймер стоит, иначе
  // карточка уехала бы из-под пальца и это выглядело бы как баг.
  useEffect(() => {
    if (paused || !story) return;
    const timer = setInterval(() => {
      setProgress((current) => {
        const next = current + (TICK_MS * TICK_MS) / SLIDE_MS;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [goNext, paused, story, storyIndex, groupIndex]);

  // Esc и стрелки: на десктопе удобнее, чем искать невидимые зоны тапа.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goPrevious();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, goNext, goPrevious]);

  if (!group || !story) return null;


  return (
    <div className="fixed inset-0 z-[100] bg-[#0B0C0D] flex flex-col">
      {/* Полосы прогресса: по одной на каждую историю автосервиса. */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-2">
        {group.stories.map((item, index) => (
          <div key={item.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: `${index < storyIndex ? 100 : index === storyIndex ? progress : 0}%` }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-6 left-3 right-3 z-20 flex items-center gap-2">
        {group.avatarUrl && (
          <img src={group.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/40" />
        )}
        <span className="text-xs font-bold text-white truncate">{group.name}</span>
        <button
          onClick={close}
          className="ml-auto w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white"
          aria-label="Закрыть истории"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="flex-1 relative"
        onTouchStart={(e) => {
          touchStartRef.current = e.touches[0].clientX;
          setPaused(true);
        }}
        onTouchEnd={(e) => {
          setPaused(false);
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (start === null) return;
          const delta = e.changedTouches[0].clientX - start;
          // Порог 50 px: ниже него лёгкое дрожание пальца листало бы карточку.
          if (delta < -50) goNext();
          if (delta > 50) goPrevious();
        }}
      >
        <img
          key={story.id}
          src={story.media_url}
          alt={story.caption || group.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Затемнение сверху и снизу, чтобы текст и полосы читались поверх фото. */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />

        {story.caption && (
          <p className="absolute bottom-6 left-4 right-4 z-10 text-sm font-semibold text-white">{story.caption}</p>
        )}
      </div>

      {/* Невидимые зоны тапа по краям. Удержание останавливает автопереход. */}
      <button
        className="absolute inset-y-0 left-0 w-1/2 z-10 cursor-pointer"
        onClick={goPrevious}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        aria-label="Предыдущая история"
      >
        {storyIndex === 0 && groupIndex > 0 && (
          <ChevronLeft className="absolute left-3 top-1/2 w-7 h-7 text-white/70" />
        )}
      </button>
      <button
        className="absolute inset-y-0 right-0 w-1/2 z-10 cursor-pointer"
        onClick={goNext}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        aria-label="Следующая история"
      />

      {group.phone && (
        <div className="absolute bottom-5 left-4 right-4 z-20 flex justify-center pointer-events-none">
          <Button
            variant="primary"
            className="pointer-events-auto"
            onClick={() => onOpenCenter(group.serviceCenterId)}
            icon={<Phone className="w-4 h-4" />}
          >
            {group.phone}
          </Button>
        </div>
      )}
    </div>
  );
};
