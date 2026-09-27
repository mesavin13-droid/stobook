import React, { useEffect, useState } from 'react';
import { Play, Wrench } from 'lucide-react';
import { StoryGroup } from '../../types';

export interface StoriesRowProps {
  /** Отдаёт загруженные группы наружу: App держит их для просмотрщика. */
  onGroupsLoaded: (groups: StoryGroup[]) => void;
  onOpen: (groupIndex: number) => void;
}

/** Сколько историй одного автосервиса успешно посмотрели, по id центра. */
const SEEN_KEY = 'stobook.stories.seen';

function readSeen(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    // Приватный режим и переполненное хранилище не должны ломать ленту.
    return {};
  }
}

/**
 * Ряд круглых аватаров с историями автосервисов.
 *
 * Обводка имет��онов: у кого есть непрочитанные истории — градиентная
 * рамка, у кого все просмотрены — серая, как в Telegram. Отметка о прочтении
 * хранится локально: серверу незачем знать, кто что досмотрел, а отдельной
 * таблицы для этого заводить незачем.
 */
export const StoriesRow: React.FC<StoriesRowProps> = ({ onGroupsLoaded, onOpen }) => {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stories')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const loaded: StoryGroup[] = Array.isArray(data?.groups) ? data.groups : [];
        setGroups(loaded);
        // Просмотрщик живёт в App, поэтому список передаём сразу: открыть
        // историю можно раньше, чем отработает setState этой строки.
        onGroupsLoaded(loaded);
      })
      .catch(() => {});
    setSeen(readSeen());
    return () => {
      cancelled = true;
    };
  }, [onGroupsLoaded]);

  // Групп может не быть вовсе, и пустая лента оставляет на экране дыру.
  if (groups.length === 0) return null;

  const markSeen = (serviceCenterId: string) => {
    setSeen((current) => {
      if (current[serviceCenterId]) return current;
      const next = { ...current, [serviceCenterId]: true };
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 py-3">
      {groups.map((group, index) => {
        const isNew = !seen[group.serviceCenterId];
        return (
          <button
            key={group.serviceCenterId}
            onClick={() => {
              markSeen(group.serviceCenterId);
              onOpen(index);
            }}
            className="flex flex-col items-center gap-1 shrink-0 w-16"
          >
            <span
              className={`w-14 h-14 rounded-full p-[2px] ${
                isNew
                  ? 'bg-gradient-to-tr from-[#B8F23A] via-[#35B86B] to-[#111315]'
                  : 'bg-[#E1E4E6]'
              }`}
            >
              <span className="w-full h-full rounded-full bg-white p-0.5 block">
                {group.avatarUrl ? (
                  <img src={group.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="w-full h-full rounded-full bg-[#ECEFF1] flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-[#70777D]" />
                  </span>
                )}
              </span>
            </span>
            <span className="relative w-full">
              <span className="block text-[10px] font-bold text-[#111315] truncate text-center px-0.5">
                {group.name}
              </span>
              {isNew && (
                <span className="absolute -top-4 -right-1 w-4 h-4 rounded-full bg-[#B8F23A] flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-[#111315] text-[#111315]" />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};
