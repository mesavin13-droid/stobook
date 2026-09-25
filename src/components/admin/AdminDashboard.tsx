import React, { useState, useEffect } from 'react';
import { ServiceCenter, PlatformSettings, SubscriptionPlan, PromotionType } from '../../types';
import { ShieldCheck, Check, X, Settings, Layers, TrendingUp, Users, Car, Calendar, Sliders } from 'lucide-react';
import { triggerHaptic } from '../../lib/telegram/webapp';

interface AdminDashboardProps {
  onBackToCustomer: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToCustomer }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    trial_days: 14,
    booking_reminder_minutes: 60,
    default_city: 'Новосибирск',
    currency: 'RUB'
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'settings' | 'tariffs'>('overview');

  const loadData = () => {
    fetch('/api/admin/metrics')
      .then((r) => r.json())
      .then((data) => {
        setMetrics(data);
        if (data.platformSettings) setSettings(data.platformSettings);
      })
      .catch(console.error);

    fetch('/api/service-centers')
      .then((r) => r.json())
      .then(setServiceCenters)
      .catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (scId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/service-centers/${scId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        triggerHaptic('success');
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        triggerHaptic('success');
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">Панель управления SUPER_ADMIN</span>
          </div>
          <h1 className="text-2xl font-black mt-1">Платформа STOBOOK</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Управление модерацией автосервисов, тарифами, промо и системными параметрами
          </p>
        </div>

        <button
          onClick={onBackToCustomer}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20"
        >
          В приложение клиента
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'overview' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Сводка платформы
        </button>
        <button
          onClick={() => setActiveTab('moderation')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'moderation' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Модерация СТО
          {serviceCenters.some((s) => s.status === 'PENDING') && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('tariffs')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'tariffs' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Тарифы и Продвижение
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'settings' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Настройки платформы
        </button>
      </div>

      {/* OVERVIEW TAB (Section 42) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">СТО всего</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{serviceCenters.length}</p>
              <span className="text-[11px] text-emerald-600 font-semibold">
                {serviceCenters.filter((s) => s.status === 'ACTIVE').length} активных
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Записей сегодня</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{metrics?.bookingsToday || 12}</p>
              <span className="text-[11px] text-slate-500 font-semibold">Конверсия 94%</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Клиенты и авто</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{metrics?.totalVehicles || 4}</p>
              <span className="text-[11px] text-slate-500 font-semibold">В Новосибирске</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Выручка за месяц</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">148 500 ₽</p>
              <span className="text-[11px] text-emerald-600 font-semibold">+22% к прошлому</span>
            </div>
          </div>

          {/* List of all registered СТО */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-900 mb-4">Все подключенные автосервисы</h3>
            <div className="space-y-3">
              {serviceCenters.map((sc) => (
                <div
                  key={sc.id}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{sc.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sc.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                        sc.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sc.status}
                      </span>
                      {sc.is_promoted && (
                        <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 rounded">ПРОМО</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{sc.address} · Рейтинг: ★ {sc.rating} ({sc.reviews_count} отзывов)</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {sc.status === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateStatus(sc.id, 'ACTIVE')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                      >
                        Одобрить
                      </button>
                    )}
                    {sc.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleUpdateStatus(sc.id, 'BLOCKED')}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-red-50 hover:text-red-700 rounded-lg text-xs font-semibold text-slate-700"
                      >
                        Блокировать
                      </button>
                    )}
                    {sc.status === 'BLOCKED' && (
                      <button
                        onClick={() => handleUpdateStatus(sc.id, 'ACTIVE')}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold"
                      >
                        Разблокировать
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODERATION TAB (Section 44) */}
      {activeTab === 'moderation' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Заявки автосервисов на модерацию</h3>
          {serviceCenters.filter((s) => s.status === 'PENDING').length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-semibold text-slate-600">Очередь модерации пуста</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Все поступившие заявки обработаны</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serviceCenters.filter((s) => s.status === 'PENDING').map((sc) => (
                <div key={sc.id} className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-100 px-2 py-0.5 rounded">
                        Новая заявка на модерацию
                      </span>
                      <h4 className="font-bold text-base text-slate-900 mt-1">{sc.name}</h4>
                      <p className="text-xs text-slate-600">{sc.address} · Телефон: {sc.phone}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(sc.id, 'ACTIVE')}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        ✓ Одобрить СТО (14 дн. Trial)
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(sc.id, 'BLOCKED')}
                        className="px-3.5 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs rounded-xl"
                      >
                        ✕ Отклонить
                      </button>
                    </div>
                  </div>
                  {sc.description && (
                    <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-amber-100">
                      {sc.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TARIFFS & PROMOTIONS (Sections 45 & 47) */}
      {activeTab === 'tariffs' && (
        <div className="space-y-6">
          {/* Subscription Plans */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-900 mb-3">Тарифные планы для автосервисов</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="font-black text-sm text-slate-900">Базовый</span>
                <p className="text-xl font-extrabold text-slate-900">3 900 ₽ <span className="text-xs font-normal text-slate-500">/ 30 дней</span></p>
                <p className="text-xs text-slate-600">Для сервисов до 2 постов. Онлайн-запись и Telegram-уведомления.</p>
              </div>

              <div className="p-4 rounded-xl border-2 border-amber-500 bg-amber-50/30 space-y-2 relative">
                <span className="absolute top-2 right-2 text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded">ХИТ</span>
                <span className="font-black text-sm text-slate-900">Профессиональный</span>
                <p className="text-xl font-extrabold text-slate-900">7 900 ₽ <span className="text-xs font-normal text-slate-500">/ 30 дней</span></p>
                <p className="text-xs text-slate-600">До 6 постов, приоритетная выдача, SMS и Web Push клиентам.</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="font-black text-sm text-slate-900">Премиум</span>
                <p className="text-xl font-extrabold text-slate-900">14 900 ₽ <span className="text-xs font-normal text-slate-500">/ 30 дней</span></p>
                <p className="text-xs text-slate-600">Безлимит постов, интеграция с 1С, максимальный буст на карте.</p>
              </div>
            </div>
          </div>

          {/* Promotion Types */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-900 mb-3">Виды платного продвижения (Promotions)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <p className="font-bold text-xs text-slate-900">MAP_BOOST (Выделенный пин на карте)</p>
                  <p className="text-[11px] text-slate-500">Увеличенный золотой пин, логотип на карте 72 часа</p>
                </div>
                <span className="text-xs font-black text-slate-900">990 ₽</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <p className="font-bold text-xs text-slate-900">FEATURED_CARD (Топ «Мне нужно сегодня»)</p>
                  <p className="text-[11px] text-slate-500">Первое место при поиске свободных слотов</p>
                </div>
                <span className="text-xs font-black text-slate-900">1 490 ₽</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLATFORM SETTINGS (Section 80 & 81) */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-xl">
          <h3 className="font-extrabold text-base text-slate-900 mb-1">Настройки платформы STOBOOK</h3>
          <p className="text-xs text-slate-500 mb-5">
            Конфигурируемые параметры платформы (не захардкожены).
          </p>

          {settingsSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold mb-4">
              ✓ Настройки успешно сохранены в базе данных
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Бесплатный пробный период для новых СТО (дней)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={settings.trial_days}
                onChange={(e) => setSettings({ ...settings, trial_days: parseInt(e.target.value, 10) || 14 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Время отправки напоминания до записи (минут)
              </label>
              <input
                type="number"
                min={15}
                max={1440}
                value={settings.booking_reminder_minutes}
                onChange={(e) => setSettings({ ...settings, booking_reminder_minutes: parseInt(e.target.value, 10) || 60 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Город по умолчанию
              </label>
              <input
                type="text"
                value={settings.default_city}
                onChange={(e) => setSettings({ ...settings, default_city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Основная валюта
              </label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20"
            >
              Сохранить системные настройки
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
