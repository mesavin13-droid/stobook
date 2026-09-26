import React, { useState, useEffect } from 'react';
import { Appointment, ServiceCenter, Master, ServiceBay, AppointmentStatus } from '../../types';
import { Wrench, Calendar, Users, Clock, CheckCircle, Car, AlertCircle, Plus, ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../../lib/telegram/webapp';

type OwnerCabinetTab = 'dashboard' | 'appointments' | 'bays_masters' | 'register';

interface OwnerCabinetProps {
  onBackToCustomer: () => void;
  initialTab?: OwnerCabinetTab;
}

export const OwnerCabinet: React.FC<OwnerCabinetProps> = ({ onBackToCustomer, initialTab = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState<OwnerCabinetTab>(initialTab);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceCenter, setServiceCenter] = useState<ServiceCenter | null>(null);

  // Complete Service Modal State
  const [completingAppt, setCompletingAppt] = useState<Appointment | null>(null);
  const [completionForm, setCompletionForm] = useState({
    mileage: 85000,
    cost: 5500,
    work_performed: 'Замена моторного масла Toyota 5W-30\nЗамена масляного фильтра\nДиагностика подвески',
    parts: 'Масло моторное Toyota 5W-30 (4.5 л) - 4200 ₽\nФильтр масляный оригинал - 800 ₽',
    comment: 'Автомобиль в хорошем состоянии. На следующем ТО рекомендована замена тормозной жидкости.'
  });

  const loadData = () => {
    setLoading(true);
    fetch('/api/service-centers/c0010000-0000-0000-0000-000000000001')
      .then((res) => res.json())
      .then((sc) => {
        setServiceCenter(sc);
      });

    fetch('/api/bookings?serviceCenterId=c0010000-0000-0000-0000-000000000001')
      .then((res) => res.json())
      .then((data) => {
        setAppointments(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Status transition handler
  const handleUpdateStatus = async (apptId: string, newStatus: AppointmentStatus) => {
    try {
      const res = await fetch(`/api/bookings/${apptId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          changedByUserId: 'a2222222-2222-2222-2222-222222222222'
        })
      });

      if (res.ok) {
        triggerHaptic('success');
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Complete service submission
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingAppt) return;

    try {
      const workArray = completionForm.work_performed
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const partsArray = completionForm.parts
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line) => {
          return { name: line, quantity: 1, cost: 0 };
        });

      const res = await fetch(`/api/bookings/${completingAppt.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mileage: completionForm.mileage,
          cost: completionForm.cost,
          work_performed: workArray,
          parts: partsArray,
          comment: completionForm.comment
        })
      });

      if (res.ok) {
        triggerHaptic('success');
        setCompletingAppt(null);
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Registration of new СТО state
  const [registerForm, setRegisterForm] = useState({
    name: '',
    address: '',
    phone: '',
    description: '',
    baysCount: 3,
    mastersCount: 2
  });
  const [regSuccess, setRegSuccess] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/service-centers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...registerForm,
          latitude: 55.01,
          longitude: 82.93
        })
      });
      if (res.ok) {
        triggerHaptic('success');
        setRegSuccess(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & СТО Profile info */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">Кабинет автосервиса</span>
          </div>
          <h1 className="text-2xl font-black mt-1">ТОП МОТОРС</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            г. Новосибирск, ул. Днепрогэсовская, 9/1 · Тариф «Про» (Trial активен еще 12 дней)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('register')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
          >
            + Зарегистрировать новое СТО
          </button>
          <button
            onClick={onBackToCustomer}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20"
          >
            В режим клиента
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'dashboard' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Обзор и сводка
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'appointments' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Записи на сегодня ({appointments.length})
        </button>
        <button
          onClick={() => setActiveTab('bays_masters')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'bays_masters' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Посты и мастера
        </button>
      </div>

      {/* DASHBOARD TAB (Section 33: Сегодня 12 записей, 3 машины сейчас, 5 свободных окон) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Записей сегодня</span>
              <p className="text-2xl font-black text-slate-900 mt-1">12</p>
              <span className="text-[11px] text-emerald-600 font-semibold">+4 с онлайн-бронирования</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Машины в боксах</span>
              <p className="text-2xl font-black text-slate-900 mt-1">3</p>
              <span className="text-[11px] text-amber-600 font-semibold">Посты №1, №2, №3 заняты</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Свободных окон</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">5</p>
              <span className="text-[11px] text-slate-500 font-semibold">16:30, 17:00, 18:30...</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Ожидают подтверждения</span>
              <p className="text-2xl font-black text-amber-500 mt-1">2</p>
              <span className="text-[11px] text-slate-500 font-semibold">Уведомления отправлены</span>
            </div>
          </div>

          {/* Quick list of urgent appointments */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-sm text-slate-900">Ближайшие автомобили на обслуживании</h3>
              <button onClick={() => setActiveTab('appointments')} className="text-xs font-bold text-amber-600 hover:text-amber-700">
                Все записи →
              </button>
            </div>

            <div className="space-y-3">
              {appointments.slice(0, 3).map((appt) => (
                <div
                  key={appt.id}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                      {new Date(appt.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {appt.vehicle ? `${appt.vehicle.brand} ${appt.vehicle.model}` : 'Toyota Camry'}
                        </span>
                        <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                          {appt.vehicle?.license_plate || 'О777ОО54'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {appt.service?.custom_name || 'Замена моторного масла и фильтра'} · от {appt.price} ₽
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                      appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      appt.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                      appt.status === 'ARRIVED' ? 'bg-purple-100 text-purple-800' :
                      appt.status === 'CONFIRMED' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-200 text-slate-800'
                    }`}>
                      {appt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* APPOINTMENTS TAB */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-900 mb-4">
              Журнал записей автосервиса
            </h3>

            {appointments.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Записей пока нет</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">
                            {new Date(appt.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-bold text-xs text-slate-800">
                            {appt.vehicle ? `${appt.vehicle.brand} ${appt.vehicle.model} (${appt.vehicle.year})` : 'Автомобиль'}
                          </span>
                          {appt.vehicle?.license_plate && (
                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                              {appt.vehicle.license_plate}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {appt.service?.custom_name || 'Замена моторного масла и фильтра'} · Стоимость: {appt.price} ₽
                        </p>
                        {appt.customer_note && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md mt-1 inline-block">
                            Примечание клиента: {appt.customer_note}
                          </p>
                        )}
                      </div>

                      {/* Status badge */}
                      <span className={`self-start sm:self-auto text-xs font-bold px-2.5 py-1 rounded-lg ${
                        appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        appt.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        appt.status === 'ARRIVED' ? 'bg-purple-100 text-purple-800' :
                        appt.status === 'CONFIRMED' ? 'bg-amber-100 text-amber-800' :
                        appt.status.startsWith('CANCELLED') ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {appt.status === 'NEW' && 'Новая заявка'}
                        {appt.status === 'CONFIRMED' && 'Подтверждена'}
                        {appt.status === 'ARRIVED' && 'Машина прибыла'}
                        {appt.status === 'IN_PROGRESS' && 'В работе'}
                        {appt.status === 'COMPLETED' && 'Обслужено'}
                        {appt.status === 'CANCELLED_BY_CUSTOMER' && 'Отменено клиентом'}
                        {appt.status === 'CANCELLED_BY_SERVICE' && 'Отменено СТО'}
                      </span>
                    </div>

                    {/* Action buttons to transition status */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      {appt.status === 'NEW' && (
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'CONFIRMED')}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors"
                        >
                          Подтвердить запись
                        </button>
                      )}

                      {(appt.status === 'NEW' || appt.status === 'CONFIRMED') && (
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'ARRIVED')}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
                        >
                          Клиент приехал (Прибыл)
                        </button>
                      )}

                      {appt.status === 'ARRIVED' && (
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'IN_PROGRESS')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
                        >
                          Взять в работу
                        </button>
                      )}

                      {appt.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => {
                            setCompletingAppt(appt);
                            triggerHaptic('selection');
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-colors shadow-sm"
                        >
                          ✓ Завершить и внести в историю
                        </button>
                      )}

                      {!['COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE'].includes(appt.status) && (
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'CANCELLED_BY_SERVICE')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 font-semibold rounded-lg transition-colors"
                        >
                          Отменить
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BAYS & MASTERS TAB (Section 34, 36, 37) */}
      {activeTab === 'bays_masters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Service Bays */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">Посты автосервиса (3 поста)</h3>
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">Пост №1 (Подъемник 4т)</span>
                  <p className="text-[11px] text-slate-500">Для тяжелых седанов, кроссоверов и внедорожников</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Активен</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">Пост №2 (Экспресс-масло/Яма)</span>
                  <p className="text-[11px] text-slate-500">Специализированный пост быстрой замены масла и фильтров</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Активен</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">Пост №3 (Компьютерная диагностика)</span>
                  <p className="text-[11px] text-slate-500">Диагностический стенд, проверка электроники и датчиков</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Активен</span>
              </div>
            </div>
          </div>

          {/* Masters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">Мастера автосервиса (3 мастера)</h3>
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">Иван Васильев</span>
                  <p className="text-[11px] text-slate-500">Специалист по замене масел и регламентному ТО</p>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">График: 7/7 09-20</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">Сергей Ковалев</span>
                  <p className="text-[11px] text-slate-500">Мастер ходовой и тормозных систем</p>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">График: 6/1 09-20</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">Артем Новиков</span>
                  <p className="text-[11px] text-slate-500">Диагност-автоэлектрик</p>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">График: 5/2 10-19</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER NEW СТО (Section 30) */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-xl mx-auto">
          <h3 className="font-extrabold text-base text-slate-900 mb-1">Регистрация нового автосервиса</h3>
          <p className="text-xs text-slate-500 mb-4">
            После подачи заявки СТО получает статус PENDING. Администратор платформы одобрит заявку, и начнется 14-дневный бесплатный пробный период (TRIAL).
          </p>

          {regSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-xs text-emerald-800">Заявка успешно отправлена!</p>
              <p className="text-[11px] text-emerald-600">
                Статус заявки: PENDING. Переключитесь в роль "Админ", чтобы одобрить автосервис.
              </p>
              <button
                onClick={() => setRegSuccess(false)}
                className="mt-2 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold"
              >
                Подать еще заявку
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Название СТО *</label>
                <input
                  type="text"
                  required
                  placeholder="Сибирь Моторс 54"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Адрес в Новосибирске *</label>
                <input
                  type="text"
                  required
                  placeholder="ул. Станционная, 38"
                  value={registerForm.address}
                  onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Контактный телефон *</label>
                <input
                  type="tel"
                  required
                  placeholder="+7 (383) 300-40-50"
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Описание автосервиса *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Специализация, опыт мастеров, оборудование..."
                  value={registerForm.description}
                  onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Количество постов</label>
                  <input
                    type="number"
                    min={1}
                    value={registerForm.baysCount}
                    onChange={(e) => setRegisterForm({ ...registerForm, baysCount: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Количество мастеров</label>
                  <input
                    type="number"
                    min={1}
                    value={registerForm.mastersCount}
                    onChange={(e) => setRegisterForm({ ...registerForm, mastersCount: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-black transition-all shadow-md shadow-amber-500/20"
              >
                Отправить заявку на модерацию
              </button>
            </form>
          )}
        </div>
      )}

      {/* COMPLETE SERVICE MODAL (Section 93 & 22) */}
      {completingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Завершение обслуживания</h3>
                <p className="text-xs text-slate-500">
                  {completingAppt.vehicle ? `${completingAppt.vehicle.brand} ${completingAppt.vehicle.model}` : 'Автомобиль'}
                </p>
              </div>
              <button onClick={() => setCompletingAppt(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="p-5 overflow-y-auto space-y-3.5 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Итоговый пробег (км) *</label>
                  <input
                    type="number"
                    required
                    value={completionForm.mileage}
                    onChange={(e) => setCompletionForm({ ...completionForm, mileage: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Итоговая стоимость (₽) *</label>
                  <input
                    type="number"
                    required
                    value={completionForm.cost}
                    onChange={(e) => setCompletionForm({ ...completionForm, cost: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Выполненные работы (по одной на строке) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={completionForm.work_performed}
                  onChange={(e) => setCompletionForm({ ...completionForm, work_performed: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Использованные запчасти и расходники
                </label>
                <textarea
                  rows={2}
                  value={completionForm.parts}
                  onChange={(e) => setCompletionForm({ ...completionForm, parts: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Рекомендации и комментарий клиенту
                </label>
                <textarea
                  rows={2}
                  value={completionForm.comment}
                  onChange={(e) => setCompletionForm({ ...completionForm, comment: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black transition-all shadow-md shadow-emerald-600/20"
                >
                  Завершить и сохранить в историю
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
