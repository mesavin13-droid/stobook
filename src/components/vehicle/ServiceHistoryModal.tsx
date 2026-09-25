import React, { useState, useEffect } from 'react';
import { Vehicle, ServiceHistoryItem, ServiceHistoryAccess, VehicleHistorySettings } from '../../types';
import { X, Shield, Lock, FileText, CheckCircle2, AlertTriangle, Calendar, Wrench, ShieldAlert } from 'lucide-react';
import { triggerHaptic } from '../../lib/telegram/webapp';

interface ServiceHistoryModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceHistoryModal: React.FC<ServiceHistoryModalProps> = ({
  vehicle,
  isOpen,
  onClose
}) => {
  const [historyItems, setHistoryItems] = useState<ServiceHistoryItem[]>([]);
  const [settings, setSettings] = useState<VehicleHistorySettings>({
    id: '',
    vehicle_id: vehicle.id,
    user_id: vehicle.user_id,
    store_history: true,
    allow_service_view: true
  });
  const [activeAccess, setActiveAccess] = useState<ServiceHistoryAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'privacy'>('records');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        fetch(`/api/vehicles/${vehicle.id}/history`).then((r) => r.json()),
        fetch(`/api/vehicles/${vehicle.id}/access`).then((r) => r.json())
      ])
        .then(([histData, accessData]) => {
          setHistoryItems(histData.history || []);
          if (histData.settings) setSettings(histData.settings);
          setActiveAccess(accessData || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [vehicle.id, isOpen]);

  if (!isOpen) return null;

  // Toggle settings
  const handleToggleSetting = async (key: 'store_history' | 'allow_service_view', value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    triggerHaptic('selection');

    try {
      await fetch(`/api/vehicles/${vehicle.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Revoke access
  const handleRevokeAccess = async (serviceCenterId: string) => {
    try {
      await fetch(`/api/vehicles/${vehicle.id}/revoke-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceCenterId })
      });

      triggerHaptic('warning');
      setActiveAccess((prev) => prev.filter((a) => a.service_center_id !== serviceCenterId));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">
                История обслуживания
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {vehicle.brand} {vehicle.model} ({vehicle.year} г.) · {vehicle.mileage.toLocaleString('ru-RU')} км
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5 bg-white">
          <button
            onClick={() => setActiveTab('records')}
            className={`py-3 text-xs font-bold border-b-2 mr-6 transition-colors ${
              activeTab === 'records'
                ? 'border-amber-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Записи ТО и ремонтов ({historyItems.length})
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'border-amber-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Доступ и приватность
            {activeAccess.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
              Загрузка электронной сервисной книжки...
            </div>
          ) : activeTab === 'records' ? (
            historyItems.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-800 text-xs">Записей обслуживания пока нет</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  Когда СТО завершит работу по вашей записи, данные о работах, запчастях и пробеге сохранятся сюда автоматически.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-xs text-slate-900">{item.service_date}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-semibold text-xs text-slate-700">{item.service_center_name || 'СТО'}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Пробег при визите: <strong className="text-slate-800">{item.mileage.toLocaleString('ru-RU')} км</strong>
                        </p>
                      </div>
                      <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {item.cost.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>

                    {/* Works performed */}
                    {item.work_performed && item.work_performed.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-600 block mb-1">Выполненные работы:</span>
                        <ul className="space-y-1">
                          {item.work_performed.map((w: any, idx: number) => (
                            <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold shrink-0">•</span>
                              <span>{typeof w === 'string' ? w : w.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Parts */}
                    {item.parts && item.parts.length > 0 && (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-[11px] font-bold text-slate-600 block mb-1">Расходные материалы и запчасти:</span>
                        <div className="space-y-1 text-xs text-slate-600">
                          {item.parts.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px]">
                              <span>{p.name} × {p.quantity}</span>
                              <span className="font-semibold text-slate-800">{p.cost.toLocaleString('ru-RU')} ₽</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Comments */}
                    {item.comment && (
                      <p className="text-xs text-slate-600 italic bg-amber-50/60 p-2 rounded-lg border border-amber-200/50">
                        <strong>Мастер:</strong> {item.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* PRIVACY & ACCESS TAB */
            <div className="space-y-5">
              {/* Privacy toggles */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3.5">
                <h4 className="font-bold text-xs text-slate-900">Настройки приватности</h4>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Хранить историю обслуживания</p>
                    <p className="text-[11px] text-slate-500">Автоматически сохранять данные о ремонтах от СТО</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.store_history}
                    onChange={(e) => handleToggleSetting('store_history', e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Разрешать СТО видеть историю</p>
                    <p className="text-[11px] text-slate-500">Предоставлять временный доступ автосервису на время записи</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allow_service_view}
                    onChange={(e) => handleToggleSetting('allow_service_view', e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Active Temporary Access List (Section 24) */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-slate-500" />
                  Кому доступна моя история сейчас
                </h4>

                {activeAccess.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <Lock className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700">В данный момент доступ закрыт для всех СТО</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Доступ открывается только при активной записи и автоматически отзывается после завершения обслуживания.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeAccess.map((access) => (
                      <div
                        key={access.id}
                        className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-xs text-slate-900">
                            {access.service_center_name || 'ТОП МОТОРС'}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Доступ открыт до завершения обслуживания
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevokeAccess(access.service_center_id)}
                          className="px-3 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors shadow-xs"
                        >
                          Отозвать доступ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
