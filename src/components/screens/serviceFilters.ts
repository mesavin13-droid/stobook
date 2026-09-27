import { ServiceCenter } from '../../types';

/**
 * Популярные категории услуг.
 *
 * Список задан статически, чтобы набор кнопок не «прыгал» между выдачами, но
 * фактические категории в данных не ограничены этим списком: в mapCategories()
 * к нему добавляются категории, которые автосервисы завели через админку.
 */
export const POPULAR_CATEGORIES = [
  { id: 'ТО', label: 'ТО', icon: '📋' },
  { id: 'Замена масла', label: 'Замена масла', icon: '🛢️' },
  { id: 'Шиномонтаж', label: 'Шиномонтаж', icon: '🛞' },
  { id: 'Диагностика', label: 'Диагностика', icon: '🔍' },
  { id: 'Тормоза', label: 'Тормоза', icon: '🛑' },
  { id: 'Кондиционер', label: 'Кондиционер', icon: '❄️' },
  { id: 'Кузовной ремонт', label: 'Кузовной', icon: '🚗' },
  { id: 'Трансмиссия', label: 'Трансмиссия', icon: '⚙️' }
];

/**
 * Есть ли такая услуга уже в каталоге автосервиса.
 *
 * Сравнение нечувствительно к регистру и лишним пробелам: «Замена масла » и
 * «замена масла» — это одна и та же услуга, и предлагать её второй раз нельзя.
 * Вынесено отдельно, чтобы правило можно было проверить без рендера React.
 */
export function isPresetAlreadyAdded(name: string, existingNames: Iterable<string>): boolean {
  const target = name.trim().toLowerCase();
  if (!target) return false;
  for (const existing of existingNames) {
    if (existing.trim().toLowerCase() === target) return true;
  }
  return false;
}

/**
 * Готовые услуги для кабинета владельца.
 *
 * Владелец не должен придумывать формулировки и категории: он выбирает услугу
 * из списка, а цена и длительность подставляются как отправная точка — их можно
 * поправить перед добавлением. Названия совпадают с popular-категориями выше,
 * поэтому услуга сразу попадает в фильтр на карте.
 */
export const SERVICE_PRESETS: {
  category: string;
  icon: string;
  items: { name: string; price: number; duration: number }[];
}[] = [
  {
    category: 'ТО',
    icon: '📋',
    items: [
      { name: 'Комплексное ТО', price: 3500, duration: 90 },
      { name: 'Замена масла и фильтров', price: 1800, duration: 60 },
      { name: 'Замена воздушного фильтра', price: 700, duration: 30 },
      { name: 'Замена салонного фильтра', price: 600, duration: 30 }
    ]
  },
  {
    category: 'Замена масла',
    icon: '🛢️',
    items: [
      { name: 'Замена моторного масла', price: 1500, duration: 45 },
      { name: 'Замена масла и масляного фильтра', price: 1900, duration: 60 },
      { name: 'Экспресс-замена масла', price: 1700, duration: 40 }
    ]
  },
  {
    category: 'Шиномонтаж',
    icon: '🛞',
    items: [
      { name: 'Шиномонтаж и балансировка', price: 2500, duration: 60 },
      { name: 'Сезонная смена шин', price: 2000, duration: 60 },
      { name: 'Ремонт прокола', price: 900, duration: 30 },
      { name: 'Балансировка колёс', price: 1200, duration: 45 }
    ]
  },
  {
    category: 'Диагностика',
    icon: '🔍',
    items: [
      { name: 'Компьютерная диагностика', price: 1200, duration: 45 },
      { name: 'Диагностика ходовой части', price: 1500, duration: 60 },
      { name: 'Диагностика подвески', price: 1400, duration: 60 },
      { name: 'Диагностика перед покупкой', price: 2500, duration: 90 }
    ]
  },
  {
    category: 'Тормоза',
    icon: '🛑',
    items: [
      { name: 'Замена тормозных колодок', price: 1900, duration: 60 },
      { name: 'Замена тормозных дисков', price: 3200, duration: 90 },
      { name: 'Замена тормозной жидкости', price: 1400, duration: 60 }
    ]
  },
  {
    category: 'Кондиционер',
    icon: '❄️',
    items: [
      { name: 'Чистка кондиционера', price: 2500, duration: 60 },
      { name: 'Заправка кондиционера', price: 2200, duration: 60 },
      { name: 'Замена компрессора кондиционера', price: 8500, duration: 180 }
    ]
  },
  {
    category: 'Кузовной ремонт',
    icon: '🚗',
    items: [
      { name: 'Полировка кузова', price: 6000, duration: 180 },
      { name: 'Покраска элемента', price: 8000, duration: 240 },
      { name: 'Удаление царапин', price: 3500, duration: 120 }
    ]
  },
  {
    category: 'Трансмиссия',
    icon: '⚙️',
    items: [
      { name: 'Замена масла в КПП', price: 2200, duration: 60 },
      { name: 'Замена сцепления', price: 12000, duration: 300 }
    ]
  }
];

/** Категория с числом услуг в текущей выдаче. */
export type ServiceCategory = {
  id: string;
  label: string;
  icon: string;
  /** Сколько активных сервисов с этой категорией сейчас в выдаче. */
  count: number;
};

const normalize = (value: string): string => value.trim().toLowerCase();

/** Активные услуги автосервиса: поиск по отключённым услугам вводил бы в заблуждение. */
export function centerCategories(center: ServiceCenter): string[] {
  return (center.services ?? [])
    .filter((service) => service.is_active)
    .map((service) => service.custom_category)
    .filter((category) => category.trim().length > 0);
}

export function centerMatchesCategory(center: ServiceCenter, categoryId: string): boolean {
  const target = normalize(categoryId);
  return centerCategories(center).some((category) => normalize(category) === target);
}

export function filterByCategory(
  centers: ServiceCenter[],
  categoryId: string | null
): ServiceCenter[] {
  if (!categoryId) return centers;
  return centers.filter((center) => centerMatchesCategory(center, categoryId));
}

/** Счётчик сервисов по каждой категории. Считаем сервисы, а не центры, как в /api/service-centers. */
export function countByCategory(centers: ServiceCenter[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const center of centers) {
    for (const category of new Set(centerCategories(center))) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Категории для кнопок фильтра. Стандартные идут первыми и в заданном порядке
 * (даже если сейчас у них ноль услуг — пользователь должен видеть, что такой
 * выбор возможен), затем категории из данных, которых нет в списке.
 */
export function mapCategories(centers: ServiceCenter[]): ServiceCategory[] {
  const counts = countByCategory(centers);
  const known = new Set(POPULAR_CATEGORIES.map((category) => normalize(category.id)));
  const extra = [...counts.keys()]
    .filter((category) => !known.has(normalize(category)))
    .sort((left, right) => left.localeCompare(right, 'ru'));

  return [
    ...POPULAR_CATEGORIES.map((category) => ({
      ...category,
      count: counts.get(category.id) ?? 0
    })),
    ...extra.map((category) => ({
      id: category,
      label: category,
      icon: '🔧',
      count: counts.get(category) ?? 0
    }))
  ];
}

/**
 * Поиск по автосервисам: имя, адрес, описание, названия и категории услуг.
 *
 * Запрос разбивается на слова и требует совпадения всех слов: так «замена
 * масла» находит услугу «Замена моторного масла и фильтра», а не любой центр
 * со словом «замена». Регистр не учитывается.
 */
export function searchCenters(centers: ServiceCenter[], query: string): ServiceCenter[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return centers;

  return centers.filter((center) => {
    const haystack = normalize(
      [
        center.name,
        center.address,
        center.description ?? '',
        ...(center.services ?? []).flatMap((service) => [
          service.custom_name,
          service.custom_category
        ])
      ].join(' ')
    );
    return tokens.every((token) => haystack.includes(token));
  });
}