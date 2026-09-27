import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, EmptyState } from '../design-system';
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Wrench, Users, CalendarClock, Warehouse, Store, Images } from 'lucide-react';
import { SERVICE_PRESETS, isPresetAlreadyAdded } from './serviceFilters';
import { AddressPicker } from './AddressPicker';
import { StoriesTab } from './OwnerStoriesTab';
import { Card, Row } from './ownerLayout';
import type { ServiceCenterStory } from '../../types';

type Tab = 'services' | 'bays' | 'masters' | 'hours' | 'stories' | 'about';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'services', label: 'Услуги', icon: <Wrench className="w-4 h-4" /> },
  { id: 'bays', label: 'Посты', icon: <Warehouse className="w-4 h-4" /> },
  { id: 'masters', label: 'Мастера', icon: <Users className="w-4 h-4" /> },
  { id: 'hours', label: 'Часы работы', icon: <CalendarClock className="w-4 h-4" /> },
  { id: 'stories', label: 'Истории', icon: <Images className="w-4 h-4" /> },
  { id: 'about', label: 'О сервисе', icon: <Store className="w-4 h-4" /> }
];

const DAY_LABELS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const BAY_TYPES = [
  { value: 'lift', label: 'Подъёмник' },
  { value: 'pit', label: 'Смотровая яма' },
  { value: 'diagnostics', label: 'Диагностика' },
  { value: 'wash', label: 'Мойка' }
];

interface OwnerService {
  id: string;
  custom_name: string;
  custom_category: string;
  price: number;
  is_fixed_price: boolean;
  duration_minutes: number;
  is_active: boolean;
}

interface OwnerBay {
  id: string;
  name: string;
  bay_type: string;
  is_active: boolean;
}

interface OwnerMaster {
  id: string;
  full_name: string;
  phone?: string;
  specialization?: string;
  is_active: boolean;
  schedule_json: { work_days: number[]; start: string; end: string };
}

interface OwnerHours {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface OwnerCenter {
  id: string;
  name: string;
  description?: string;
  address: string;
  phone: string;
  telegram?: string;
  website?: string;
  route_description?: string;
  parking_description?: string;
  status: string;
  latitude: number;
  longitude: number;
}

interface OwnerPayload {
  center: OwnerCenter;
  services: OwnerService[];
  bays: OwnerBay[];
  masters: OwnerMaster[];
  businessHours: OwnerHours[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || 'Не удалось сохранить изменения');
  return payload as T;
}

export interface ScreenOwnerManageProps {
  onBack: () => void;
}

export const ScreenOwnerManage: React.FC<ScreenOwnerManageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('services');
  const [data, setData] = useState<OwnerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Истории живут отдельным маршрутом: основной payload кабинета их не
  // возвращает, а тянуть их при каждом открытии кабинета смысла нет.
  const [stories, setStories] = useState<ServiceCenterStory[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await request<OwnerPayload>('/api/owner/service-center'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить автосервис');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Грузим истории один раз: список нужен только вкладке «Истории», а лишний
  // запрос на каждый экран кабинета делать незачем.
  useEffect(() => {
    request<{ stories: ServiceCenterStory[] }>('/api/owner/stories')
      .then((payload) => setStories(payload.stories || []))
      .catch(() => {});
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
  };

  const mutate = async (work: () => Promise<unknown>, successMessage: string) => {
    setSaving(true);
    setError(null);
    try {
      await work();
      await load();
      flash(successMessage);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#F6F7F8]">
        <span className="w-6 h-6 border-2 border-[#111315] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-full bg-[#F6F7F8] p-6">
        <EmptyState title="Автосервис недоступен" description={error ?? 'Сервис не найден'} />
        <Button variant="secondary" fullWidth onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7F8] pb-8">
      <div className="bg-white border-b border-[#E1E4E6] px-4 pt-4 pb-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-[#F6F7F8] border border-[#E1E4E6] flex items-center justify-center"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-[#111315] truncate">{data.center.name}</h1>
            <p className="text-xs text-[#70777D] truncate">{data.center.address}</p>
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-xs font-bold whitespace-nowrap transition-colors ${
                tab === item.id ? 'bg-[#111315] text-[#B8F23A]' : 'bg-[#ECEFF1] text-[#70777D]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">
        {error && (
          <p role="alert" className="text-sm text-red-600 bg-white border border-red-100 rounded-[14px] px-4 py-3">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-[#1B7F4B] bg-white border border-[#D8F0E2] rounded-[14px] px-4 py-3">{notice}</p>
        )}

        {tab === 'services' && (
          <ServicesTab
            services={data.services}
            saving={saving}
            onCreate={(payload) =>
              mutate(
                () => request('/api/owner/services', { method: 'POST', body: JSON.stringify(payload) }),
                'Услуга добавлена'
              )
            }
            onUpdate={(id, payload) =>
              mutate(
                () => request(`/api/owner/services/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
                'Услуга обновлена'
              )
            }
            onDelete={(id) =>
              mutate(() => request(`/api/owner/services/${id}`, { method: 'DELETE' }), 'Услуга удалена')
            }
          />
        )}

        {tab === 'bays' && (
          <BaysTab
            bays={data.bays}
            saving={saving}
            onCreate={(payload) =>
              mutate(() => request('/api/owner/bays', { method: 'POST', body: JSON.stringify(payload) }), 'Пост добавлен')
            }
            onUpdate={(id, payload) =>
              mutate(
                () => request(`/api/owner/bays/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
                'Пост обновлён'
              )
            }
            onDelete={(id) => mutate(() => request(`/api/owner/bays/${id}`, { method: 'DELETE' }), 'Пост удалён')}
          />
        )}

        {tab === 'masters' && (
          <MastersTab
            masters={data.masters}
            saving={saving}
            onCreate={(payload) =>
              mutate(
                () => request('/api/owner/masters', { method: 'POST', body: JSON.stringify(payload) }),
                'Мастер добавлен'
              )
            }
            onUpdate={(id, payload) =>
              mutate(
                () => request(`/api/owner/masters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
                'Мастер обновлён'
              )
            }
            onDelete={(id) => mutate(() => request(`/api/owner/masters/${id}`, { method: 'DELETE' }), 'Мастер удалён')}
          />
        )}

        {tab === 'hours' && (
          <HoursTab
            hours={data.businessHours}
            saving={saving}
            onSave={(entries) =>
              mutate(
                () => request('/api/owner/business-hours', { method: 'PUT', body: JSON.stringify({ hours: entries }) }),
                'Расписание сохранено'
              )
            }
          />
        )}

        {tab === 'stories' && (
          <StoriesTab
            stories={stories}
            saving={saving}
            onCreate={(payload) =>
              mutate(
                async () => {
                  const created = await request<{ story: ServiceCenterStory }>('/api/owner/stories', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                  });
                  setStories((current) => [created.story, ...current]);
                },
                'История опубликована'
              )
            }
            onDelete={(id) =>
              mutate(
                async () => {
                  await request(`/api/owner/stories/${id}`, { method: 'DELETE' });
                  setStories((current) => current.filter((item) => item.id !== id));
                },
                'История удалена'
              )
            }
          />
        )}

        {tab === 'about' && (
          <AboutTab
            center={data.center}
            saving={saving}
            onSave={(payload) =>
              mutate(
                () => request('/api/owner/service-center', { method: 'PATCH', body: JSON.stringify(payload) }),
                'Данные автосервиса сохранены'
              )
            }
          />
        )}
      </div>
    </div>
  );
};

interface TabActions {
  saving: boolean;
  onCreate: (payload: Record<string, unknown>) => void;
  onUpdate: (id: string, payload: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

const ServicesTab: React.FC<TabActions & { services: OwnerService[] }> = ({
  services,
  saving,
  onCreate,
  onUpdate,
  onDelete
}) => {
  const [form, setForm] = useState({ customName: '', customCategory: '', price: '', durationMinutes: '60' });
  // Категория в подсказках: показываем только нужные услуги, а не все сразу.
  const [presetCategory, setPresetCategory] = useState(SERVICE_PRESETS[0].category);
  const empty = form.customName.trim().length === 0;

  const activePreset = SERVICE_PRESETS.find((group) => group.category === presetCategory) ?? SERVICE_PRESETS[0];
  // Названия уже добавленных услуг — чтобы не предлагать их повторно.
  const existingNames = useMemo(() => services.map((service) => service.custom_name), [services]);

  // Тап по готовой услуге заполняет форму: ничего печатать не нужно,
  // но цену и длительность владелец успевает проверить перед добавлением.
  const applyPreset = (name: string, price: number, duration: number) => {
    setForm({
      customName: name,
      customCategory: activePreset.category,
      price: String(price),
      durationMinutes: String(duration)
    });
  };

  return (
    <>
      {/* Быстрый путь стоит выше формы: владелец выбирает категорию и тапает
          по услуге, а форма ниже заполняется сама. Раньше всё приходилось
          вбивать руками, и большинство просто не добавляло услуги вовсе. */}
      <Card>
        <h2 className="text-sm font-black text-[#111315]">Добавить из готовых</h2>
        <p className="text-xs text-[#70777D] -mt-1">
          Выберите категорию и нажмите на услугу — название, цена и длительность подставятся сами.
        </p>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {SERVICE_PRESETS.map((group) => (
            <button
              key={group.category}
              onClick={() => setPresetCategory(group.category)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-[12px] text-xs font-bold whitespace-nowrap transition-colors ${
                presetCategory === group.category
                  ? 'bg-[#111315] text-[#B8F23A]'
                  : 'bg-[#ECEFF1] text-[#70777D]'
              }`}
            >
              <span>{group.icon}</span>
              {group.category}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          {activePreset.items.map((item) => {
            const alreadyAdded = isPresetAlreadyAdded(item.name, existingNames);
            return (
              <button
                key={item.name}
                disabled={alreadyAdded}
                onClick={() => applyPreset(item.name, item.price, item.duration)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[12px] border text-left transition-colors ${
                  alreadyAdded
                    ? 'bg-[#F6F7F8] border-[#E1E4E6] text-[#A7ADB3] cursor-not-allowed'
                    : 'bg-white border-[#E1E4E6] hover:border-[#111315]/40'
                }`}
              >
                <span className="text-xs font-bold text-[#111315] truncate">
                  {item.name}
                  {alreadyAdded && <span className="ml-2 text-[10px]">уже добавлена</span>}
                </span>
                <span className="text-[11px] font-mono font-bold text-[#70777D] shrink-0">
                  {item.price.toLocaleString('ru-RU')} ₽ · {item.duration} мин
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-black text-[#111315]">Своя услуга</h2>
        <Input
          label="Название"
          placeholder="Замена масла и фильтров"
          value={form.customName}
          onChange={(e) => setForm({ ...form, customName: e.target.value })}
        />
        <Row>
          <Input
            label="Категория"
            placeholder="ТО"
            value={form.customCategory}
            onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
          />
          <Input
            label="Цена, ₽"
            type="number"
            inputMode="numeric"
            placeholder="2500"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </Row>
        <Row>
          <Input
            label="Длительность, мин"
            type="number"
            inputMode="numeric"
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          />
          <div className="flex-1 self-end">
            <Button
              fullWidth
              disabled={saving || empty}
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                onCreate({
                  customName: form.customName.trim(),
                  customCategory: form.customCategory.trim() || 'ТО',
                  price: Number(form.price) || 0,
                  durationMinutes: Number(form.durationMinutes) || 60
                });
                setForm({ customName: '', customCategory: '', price: '', durationMinutes: '60' });
              }}
            >
              Добавить
            </Button>
          </div>
        </Row>
      </Card>

      {services.length === 0 ? (
        <EmptyState title="Услуг пока нет" description="Добавьте первую услугу, чтобы клиенты могли записаться" />
      ) : (
        services.map((service) => (
          <ServiceRow key={service.id} service={service} saving={saving} onUpdate={onUpdate} onDelete={onDelete} />
        ))
      )}
    </>
  );
};

const ServiceRow: React.FC<{
  service: OwnerService;
  saving: boolean;
  onUpdate: (id: string, payload: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}> = ({ service, saving, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    customName: service.custom_name,
    price: String(service.price),
    durationMinutes: String(service.duration_minutes)
  });

  return (
    <Card>
      <Row>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#111315] truncate">
            {service.custom_name}
            {!service.is_active && <span className="ml-2 text-[10px] text-[#70777D]">скрыта</span>}
          </p>
          <p className="text-xs text-[#70777D]">
            {service.custom_category} · {service.duration_minutes} мин ·{' '}
            {service.is_fixed_price ? `${service.price} ₽` : `от ${service.price} ₽`}
          </p>
        </div>
        <IconToggle
          title={editing ? 'Закрыть' : 'Изменить'}
          onClick={() => {
            setEditing(!editing);
            setForm({
              customName: service.custom_name,
              price: String(service.price),
              durationMinutes: String(service.duration_minutes)
            });
          }}
        >
          {editing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
        </IconToggle>
        <IconToggle title="Удалить" danger onClick={() => onDelete(service.id)}>
          <Trash2 className="w-4 h-4" />
        </IconToggle>
      </Row>

      {editing && (
        <>
          <Input value={form.customName} onChange={(e) => setForm({ ...form, customName: e.target.value })} />
          <Row>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <Input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            />
          </Row>
          <Row>
            <div className="flex-1">
              <Button
                size="sm"
                variant="secondary"
                fullWidth
                loading={saving}
                icon={<Check className="w-4 h-4" />}
                onClick={() =>
                  onUpdate(service.id, {
                    customName: form.customName.trim(),
                    price: Number(form.price) || 0,
                    durationMinutes: Number(form.durationMinutes) || 60
                  })
                }
              >
                Сохранить
              </Button>
            </div>
            <div className="flex-1">
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                onClick={() => onUpdate(service.id, { isActive: !service.is_active })}
              >
                {service.is_active ? 'Скрыть' : 'Показать'}
              </Button>
            </div>
          </Row>
        </>
      )}
    </Card>
  );
};

const BaysTab: React.FC<TabActions & { bays: OwnerBay[] }> = ({
  bays,
  saving,
  onCreate,
  onUpdate,
  onDelete
}) => {
  const [form, setForm] = useState({ name: '', bayType: 'lift' });
  const existingNames = useMemo(() => new Set(bays.map((bay) => bay.name.toLowerCase())), [bays]);
  const duplicate = existingNames.has(form.name.trim().toLowerCase());

  return (
    <>
      <Card>
        <h2 className="text-sm font-black text-[#111315]">Новый пост</h2>
        <Row>
          <Input
            label="Название"
            placeholder="Подъёмник №2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <SelectField
            label="Тип"
            value={form.bayType}
            options={BAY_TYPES}
            onChange={(value) => setForm({ ...form, bayType: value })}
          />
        </Row>
        {duplicate && <p className="text-xs text-red-600">Пост с таким названием уже есть</p>}
        <Button
          fullWidth
          disabled={saving || form.name.trim().length === 0 || duplicate}
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            onCreate({ name: form.name.trim(), bayType: form.bayType });
            setForm({ name: '', bayType: 'lift' });
          }}
        >
          Добавить
        </Button>
      </Card>

      {bays.length === 0 ? (
        <EmptyState title="Постов пока нет" description="Добавьте посты, чтобы расписание слотов считалось корректно" />
      ) : (
        bays.map((bay) => (
          <Card key={bay.id}>
            <Row>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#111315]">{bay.name}</p>
                <p className="text-xs text-[#70777D]">
                  {BAY_TYPES.find((type) => type.value === bay.bay_type)?.label ?? bay.bay_type}
                  {bay.is_active ? '' : ' · отключён'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onUpdate(bay.id, { isActive: !bay.is_active })}>
                {bay.is_active ? 'Отключить' : 'Включить'}
              </Button>
              <IconToggle title="Удалить" danger onClick={() => onDelete(bay.id)}>
                <Trash2 className="w-4 h-4" />
              </IconToggle>
            </Row>
          </Card>
        ))
      )}
    </>
  );
};

// Кнопок «Уволить»/«Удалить» здесь намеренно нет: увольнение сотрудника —
// кадровое действие, а не настройка. Мастер здесь — единица загрузки поста,
// и удаление одного обнуляло бы расчёт свободных окон для всего автосервиса.
const MastersTab: React.FC<TabActions & { masters: OwnerMaster[] }> = ({
  masters,
  saving,
  onCreate
}) => {
  const [form, setForm] = useState({ fullName: '', phone: '', specialization: '', start: '09:00', end: '20:00' });

  return (
    <>
      <Card>
        <h2 className="text-sm font-black text-[#111315]">Новый мастер</h2>
        <Input
          label="Имя"
          placeholder="Иван Васильев"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <Row>
          <Input
            label="Телефон"
            placeholder="+7 (913) 000-00-00"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Специализация"
            placeholder="Двигатель"
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
          />
        </Row>
        <Row>
          <Input label="Смена с" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <Input label="Смена до" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
        </Row>
        <Button
          fullWidth
          disabled={saving || form.fullName.trim().length < 2}
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            onCreate({
              fullName: form.fullName.trim(),
              phone: form.phone.trim(),
              specialization: form.specialization.trim(),
              schedule: { work_days: [1, 2, 3, 4, 5, 6], start: form.start, end: form.end }
            });
            setForm({ fullName: '', phone: '', specialization: '', start: '09:00', end: '20:00' });
          }}
        >
          Добавить
        </Button>
      </Card>

      {masters.length === 0 ? (
        <EmptyState
          title="Мастеров пока нет"
          description="Добавьте хотя бы одного мастера: без него автосервис не показывает свободные окна и запись невозможна"
        />
      ) : (
        masters.map((master) => (
          <Card key={master.id}>
            <Row>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#111315] truncate">
                  {master.full_name}
                  {!master.is_active && <span className="ml-2 text-[10px] text-[#70777D]">не работает</span>}
                </p>
                <p className="text-xs text-[#70777D] truncate">
                  {[master.specialization, master.phone].filter(Boolean).join(' · ') || 'Без специализации'}
                </p>
                <p className="text-xs text-[#70777D]">
                  Смена {master.schedule_json.start}–{master.schedule_json.end}
                </p>
              </div>
            </Row>
          </Card>
        ))
      )}
    </>
  );
};

const HoursTab: React.FC<{
  hours: OwnerHours[];
  saving: boolean;
  onSave: (entries: Record<string, unknown>[]) => void;
}> = ({ hours, saving, onSave }) => {
  const [rows, setRows] = useState<OwnerHours[]>(() => {
    const byDay = new Map(hours.map((entry) => [entry.day_of_week, entry]));
    return Array.from({ length: 7 }, (_, day) =>
      byDay.get(day) ?? { day_of_week: day, open_time: '09:00', close_time: '20:00', is_closed: day === 0 }
    );
  });

  const update = (day: number, patch: Partial<OwnerHours>) =>
    setRows((current) => current.map((row) => (row.day_of_week === day ? { ...row, ...patch } : row)));

  return (
    <Card>
      {rows.map((row) => (
        <div key={row.day_of_week} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#111315]">{DAY_LABELS[row.day_of_week]}</span>
            <button
              type="button"
              onClick={() => update(row.day_of_week, { is_closed: !row.is_closed })}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-bold ${
                row.is_closed ? 'bg-[#ECEFF1] text-[#70777D]' : 'bg-[#B8F23A] text-[#111315]'
              }`}
            >
              {row.is_closed ? 'Выходной' : 'Открыто'}
            </button>
          </div>
          {!row.is_closed && (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={row.open_time}
                onChange={(e) => update(row.day_of_week, { open_time: e.target.value })}
              />
              <Input
                type="time"
                value={row.close_time}
                onChange={(e) => update(row.day_of_week, { close_time: e.target.value })}
              />
            </div>
          )}
        </div>
      ))}
      <Button
        fullWidth
        loading={saving}
        onClick={() =>
          onSave(
            rows.map((row) => ({
              dayOfWeek: row.day_of_week,
              openTime: row.open_time,
              closeTime: row.close_time,
              isClosed: row.is_closed
            }))
          )
        }
      >
        Сохранить расписание
      </Button>
    </Card>
  );
};

const AboutTab: React.FC<{ center: OwnerCenter; saving: boolean; onSave: (payload: Record<string, unknown>) => void }> = ({
  center,
  saving,
  onSave
}) => {
  const [form, setForm] = useState({
    name: center.name,
    address: center.address,
    phone: center.phone,
    description: center.description ?? '',
    telegram: center.telegram ?? '',
    website: center.website ?? '',
    route_description: center.route_description ?? '',
    parking_description: center.parking_description ?? ''
  });
  // Точка на карте. Раньше автосервисы создавались с зашитыми координатами
  // центра города, поэтому владельцу нужно дать возможность поставить метку
  // самому — иначе исправить неверный адрес нечем.
  const [point, setPoint] = useState<{ latitude: number; longitude: number }>({
    latitude: center.latitude,
    longitude: center.longitude
  });

  return (
    <Card>
      <Input label="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <AddressPicker
        address={form.address}
        latitude={point.latitude}
        longitude={point.longitude}
        onAddressChange={(address) => setForm({ ...form, address })}
        onPointChange={setPoint}
      />
      <Input label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Input
        label="Telegram"
        placeholder="@stobook_support"
        value={form.telegram}
        onChange={(e) => setForm({ ...form, telegram: e.target.value })}
      />
      <Input
        label="Сайт"
        placeholder="https://example.ru"
        value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })}
      />
      <Input
        label="Описание"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Input
        label="Как добраться"
        value={form.route_description}
        onChange={(e) => setForm({ ...form, route_description: e.target.value })}
      />
      <Input
        label="Парковка"
        value={form.parking_description}
        onChange={(e) => setForm({ ...form, parking_description: e.target.value })}
      />
      <Button
        fullWidth
        loading={saving}
        onClick={() =>
          onSave({
            name: form.name.trim(),
            address: form.address.trim(),
            phone: form.phone.trim(),
            description: form.description.trim(),
            telegram: form.telegram.trim(),
            website: form.website.trim(),
            route_description: form.route_description.trim(),
            parking_description: form.parking_description.trim(),
            latitude: point.latitude,
            longitude: point.longitude
          })
        }
      >
        Сохранить
      </Button>
    </Card>
  );
};

const IconToggle: React.FC<{
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, danger, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${
      danger ? 'bg-[#FDECEC] text-[#E55353]' : 'bg-[#ECEFF1] text-[#70777D]'
    }`}
  >
    {children}
  </button>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="flex-1 block">
    <span className="block text-xs font-semibold text-[#70777D] mb-1.5">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full h-12 px-3 rounded-[14px] border border-[#E1E4E6] bg-white text-sm text-[#111315] focus:outline-none focus:border-[#111315]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);
