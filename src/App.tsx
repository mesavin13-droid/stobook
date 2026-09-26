import React, { useState, useEffect } from 'react';
import { Profile, Vehicle, ServiceCenter } from './types';
import { Navigation } from './components/Navigation';
import { Button } from './components/design-system';

// Screens
import { ScreenOnboarding } from './components/screens/ScreenOnboarding';
import { ScreenAuth } from './components/screens/ScreenAuth';
import { ScreenLegal } from './components/screens/ScreenLegal';
import { DEFAULT_LEGAL_DOC, type LegalDocId } from './legal';
import { ScreenAddCar } from './components/screens/ScreenAddCar';
import { ScreenHome } from './components/screens/ScreenHome';
import { ScreenProblemSearch } from './components/screens/ScreenProblemSearch';
import { ScreenMarketplaceResults } from './components/screens/ScreenMarketplaceResults';
import { ScreenMap } from './components/screens/ScreenMap';
import { ScreenServiceDetail } from './components/screens/ScreenServiceDetail';
import { ScreenServiceSelect } from './components/screens/ScreenServiceSelect';
import { ScreenDateTimeSelect } from './components/screens/ScreenDateTimeSelect';
import { ScreenConfirmation } from './components/screens/ScreenConfirmation';
import { ScreenBookingSuccess } from './components/screens/ScreenBookingSuccess';
import { ScreenBookingsList } from './components/screens/ScreenBookingsList';
import { ScreenProfile } from './components/screens/ScreenProfile';
import { ScreenCarProfile } from './components/screens/ScreenCarProfile';
import { ScreenOwnerDashboard } from './components/screens/ScreenOwnerDashboard';
import { ScreenOwnerSchedule } from './components/screens/ScreenOwnerSchedule';
import { ScreenOwnerManage } from './components/screens/ScreenOwnerManage';
import { ScreenOwnerRegister } from './components/screens/ScreenOwnerRegister';
import { AdminDashboard } from './components/admin/AdminDashboard';

export type ScreenId =
  | 'onboarding'
  | 'auth'
  | 'add_car'
  | 'home'
  | 'problem_search'
  | 'marketplace'
  | 'map'
  | 'service_detail'
  | 'service_select'
  | 'datetime_select'
  | 'confirmation'
  | 'booking_success'
  | 'bookings'
  | 'profile'
  | 'car_profile'
  | 'owner_dashboard'
  | 'owner_schedule'
  | 'owner_manage'
  | 'owner_register'
  | 'legal'
  | 'admin_dashboard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [profile, setProfile] = useState<Profile | null>(null);

  // Core Data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);

  // Booking Flow State
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(null);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedServiceItem, setSelectedServiceItem] = useState<{ id: string; name: string; price: number; duration: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [upcomingBookings, setUpcomingBookings] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  // Какой юридический документ открыт на экране «Правовая информация».
  const [legalDoc, setLegalDoc] = useState<LegalDocId>(DEFAULT_LEGAL_DOC);

  const openLegal = (doc: LegalDocId = DEFAULT_LEGAL_DOC) => {
    setLegalDoc(doc);
    setCurrentScreen('legal');
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const loadVehicles = async (): Promise<Vehicle[]> => {
    const response = await fetch('/api/vehicles', { credentials: 'same-origin' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data as Vehicle[] : [];
  };

  const loadUpcomingBookings = async (): Promise<number> => {
    const response = await fetch('/api/bookings', { credentials: 'same-origin' });
    if (!response.ok) return 0;
    const data = await response.json();
    if (!Array.isArray(data)) return 0;
    const now = Date.now();
    return data.filter(
      (booking: { start_at?: string; status?: string }) =>
        booking.start_at &&
        new Date(booking.start_at).getTime() >= now &&
        !['COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'NO_SHOW'].includes(booking.status ?? '')
    ).length;
  };

  // Sync initial backend data
  useEffect(() => {
    fetch('/api/service-centers')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const centers = Array.isArray(data) ? (data as ServiceCenter[]) : [];
        setServiceCenters(centers);
        setSelectedCenter((current) => current ?? centers[0] ?? null);
      })
      .catch(() => setServiceCenters([]));

    loadVehicles()
      .then(setVehicles)
      .catch(() => setVehicles([]));

    loadUpcomingBookings()
      .then(setUpcomingBookings)
      .catch(() => setUpcomingBookings(0));
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile) setProfile(data.profile as Profile);
      })
      .catch(() => {});
  }, []);

  const activeVehicle = vehicles[0] ?? null;

  // Determine whether to display the bottom tab bar
  const showBottomNav = ['home', 'map', 'bookings', 'profile'].includes(currentScreen);

  const requireAuthentication = (): boolean => {
    if (profile) return true;
    setCurrentScreen('auth');
    return false;
  };

  // Real atomic booking submission
  const handleConfirmBooking = async () => {
    if (!requireAuthentication()) return;
    if (!selectedCenter || !selectedServiceItem || !activeVehicle) {
      throw new Error('Не выбран автосервис, услуга или автомобиль');
    }
    const targetServiceId = selectedServiceItem.id;

    // ISO start datetime
    const startAt = `${selectedDate}T${selectedTime}:00.000Z`;

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        serviceCenterId: selectedCenter.id,
        vehicleId: activeVehicle.id,
        serviceCenterServiceId: targetServiceId,
        startAt,
        customerNote: 'Запись создана через приложение STOBOOK'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Слот занят' }));
      throw new Error(err.error || 'Не удалось создать запись на это время');
    }

    setCurrentScreen('booking_success');
  };

  // Open a real route to the selected center in Yandex Maps
  const handleNavigateToCenter = () => {
    const destination = selectedCenter?.address || selectedCenter?.name;
    if (!destination) {
      notify('Адрес автосервиса не указан');
      return;
    }
    window.open(
      `https://yandex.ru/maps/?text=${encodeURIComponent(destination)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // Export the appointment as a real .ics calendar file
  const handleAddToCalendar = () => {
    if (!selectedCenter || !selectedServiceItem || !selectedDate || !selectedTime) {
      notify('Данные записи неполные — календарь недоступен');
      return;
    }

    const escapeIcs = (value: string) =>
      value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');

    const start = new Date(`${selectedDate}T${selectedTime}:00Z`);
    const end = new Date(start.getTime() + (selectedServiceItem.duration || 60) * 60_000);
    const toIcsDate = (value: Date) =>
      value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//STOBOOK//Booking//RU',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${selectedCenter.id}@stobook`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${escapeIcs(`${selectedServiceItem.name} — ${selectedCenter.name}`)}`,
      `LOCATION:${escapeIcs(selectedCenter.address)}`,
      'DESCRIPTION:' + escapeIcs('Запись создана в STOBOOK'),
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stobook-${selectedDate}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify('Файл календаря сохранён');
  };

  // Render active screen
  const renderScreen = () => {
    const center = selectedCenter;
    const vehicle = activeVehicle;
    const serviceItem = selectedServiceItem;

    const missingFlowData = (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 bg-[#F6F7F8] p-6 text-center">
        <h2 className="text-lg font-black text-[#111315]">Недостаточно данных для записи</h2>
        <p className="text-sm text-[#70777D] max-w-xs">
          {!vehicle
            ? 'Сначала добавьте автомобиль в профиле'
            : 'Выберите автосервис и услугу, чтобы продолжить'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCurrentScreen('home')}>
            На главную
          </Button>
          {!vehicle && (
            <Button variant="primary" onClick={() => setCurrentScreen('add_car')}>
              Добавить авто
            </Button>
          )}
        </div>
      </div>
    );

    switch (currentScreen) {
      case 'onboarding':
        return (
          <ScreenOnboarding
            onStart={() => setCurrentScreen('auth')}
            onOpenLegal={openLegal}
          />
        );

      case 'auth':
        return (
          <ScreenAuth
            onSuccess={(authenticatedProfile) => {
              setProfile(authenticatedProfile);
              void loadVehicles()
                .then((data) => {
                  if (data.length > 0) setVehicles(data);
                  setCurrentScreen(data.length > 0 ? 'home' : 'add_car');
                })
                .catch(() => setCurrentScreen('add_car'));
            }}
            onBack={() => setCurrentScreen('onboarding')}
            onOpenLegal={openLegal}
          />
        );

      case 'legal':
        return (
          <ScreenLegal
            initialDoc={legalDoc}
            onBack={() => {
              setCurrentScreen(profile ? 'profile' : 'auth');
            }}
          />
        );

      case 'add_car':
        return (
          <ScreenAddCar
            initialVehicle={activeVehicle}
            onSaved={(newCar) => {
              setVehicles((prev) => [newCar as Vehicle, ...prev]);
              setCurrentScreen('home');
            }}
          />
        );

      case 'home':
        return (
          <ScreenHome
            vehicle={activeVehicle}
            serviceCenters={serviceCenters}
            onOpenSearch={(initialQuery) => {
              if (initialQuery) setSelectedTask(initialQuery);
              setCurrentScreen('problem_search');
            }}
            onSelectServiceCenter={(sc) => {
              setSelectedCenter(sc);
              setCurrentScreen('service_detail');
            }}
            onStartBooking={(sc) => {
              if (sc) setSelectedCenter(sc);
              setCurrentScreen('service_select');
            }}
            onChangeVehicle={() => {
              if (requireAuthentication()) setCurrentScreen('add_car');
            }}
            onOpenNotifications={() => setCurrentScreen('bookings')}
            onOpenMap={() => setCurrentScreen('map')}
          />
        );

      case 'problem_search':
        return (
          <ScreenProblemSearch
            initialQuery={selectedTask}
            onBack={() => setCurrentScreen('home')}
            onFindServices={(problemTitle) => {
              setSelectedTask(problemTitle);
              setCurrentScreen('marketplace');
            }}
          />
        );

      case 'marketplace':
        return (
          <ScreenMarketplaceResults
            taskTitle={selectedTask}
            serviceCenters={serviceCenters}
            onBack={() => setCurrentScreen('home')}
            onSelectServiceCenter={(sc) => {
              setSelectedCenter(sc);
              setCurrentScreen('service_detail');
            }}
            onBookServiceCenter={(sc) => {
              setSelectedCenter(sc);
              setCurrentScreen('service_select');
            }}
            onSwitchToMap={() => setCurrentScreen('map')}
          />
        );

      case 'map':
        return (
          <ScreenMap
            serviceCenters={serviceCenters}
            onSelectServiceCenter={(sc) => {
              setSelectedCenter(sc);
              setCurrentScreen('service_detail');
            }}
            onBookServiceCenter={(sc) => {
              setSelectedCenter(sc);
              setCurrentScreen('service_select');
            }}
            onSwitchToList={() => setCurrentScreen('marketplace')}
          />
        );

      case 'service_detail':
        return center ? (
          <ScreenServiceDetail
            serviceCenter={center}
            onBack={() => setCurrentScreen('marketplace')}
            onBook={() => setCurrentScreen('service_select')}
            onSelectServiceItem={(name) => {
              setSelectedTask(name);
              setCurrentScreen('service_select');
            }}
          />
        ) : (
          missingFlowData
        );

      case 'service_select':
        return center && vehicle ? (
          <ScreenServiceSelect
            vehicle={vehicle}
            serviceCenter={center}
            initialSelectedService={selectedTask}
            onBack={() => setCurrentScreen('service_detail')}
            onNext={(item) => {
              setSelectedServiceItem(item);
              setCurrentScreen('datetime_select');
            }}
          />
        ) : (
          missingFlowData
        );

      case 'datetime_select':
        return center && serviceItem ? (
          <ScreenDateTimeSelect
            serviceCenterId={center.id}
            serviceCenterServiceId={serviceItem.id}
            onBack={() => setCurrentScreen('service_select')}
            onNext={(date, time) => {
              setSelectedDate(date);
              setSelectedTime(time);
              setCurrentScreen('confirmation');
            }}
          />
        ) : (
          missingFlowData
        );

      case 'confirmation':
        return center && vehicle && serviceItem ? (
          <ScreenConfirmation
            vehicle={vehicle}
            serviceCenter={center}
            serviceName={serviceItem.name}
            price={serviceItem.price}
            dateStr={selectedDate}
            timeStr={selectedTime}
            onBack={() => setCurrentScreen('datetime_select')}
            onConfirm={handleConfirmBooking}
          />
        ) : (
          missingFlowData
        );

      case 'booking_success':
        return center && vehicle && serviceItem ? (
          <ScreenBookingSuccess
            vehicle={vehicle}
            serviceCenter={center}
            serviceName={serviceItem.name}
            dateStr={selectedDate}
            timeStr={selectedTime}
            onOpenBooking={() => setCurrentScreen('bookings')}
            onNavigateToCenter={handleNavigateToCenter}
            onAddToCalendar={handleAddToCalendar}
          />
        ) : (
          missingFlowData
        );

      case 'bookings':
        return (
          <ScreenBookingsList
            onNewBookingClick={() => setCurrentScreen('home')}
            onAuthRequired={() => setCurrentScreen('auth')}
          />
        );

      case 'profile':
        return (
          <ScreenProfile
            vehicle={activeVehicle}
            profile={profile}
            onAuthenticate={() => setCurrentScreen('auth')}
            onOpenLegal={openLegal}
            onOpenCarProfile={() => {
              if (!requireAuthentication()) return;
              setCurrentScreen(activeVehicle ? 'car_profile' : 'add_car');
            }}
            onAddCar={() => {
              if (requireAuthentication()) setCurrentScreen('add_car');
            }}
            onSwitchToOwnerCabinet={() => {
              if (!profile) {
                setCurrentScreen('auth');
                return;
              }
              if (['SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
                setCurrentScreen('owner_dashboard');
              } else {
                setCurrentScreen('owner_register');
              }
            }}
            onSwitchToAdmin={() => {
              if (profile?.role === 'SUPER_ADMIN') setCurrentScreen('admin_dashboard');
              else setCurrentScreen('auth');
            }}
          />
        );

      case 'car_profile':
        return (
          <ScreenCarProfile
            vehicle={activeVehicle}
            onBack={() => setCurrentScreen('profile')}
            onEdit={() => setCurrentScreen('add_car')}
            onBook={() => setCurrentScreen('service_select')}
          />
        );

      case 'owner_dashboard':
        return (
          <ScreenOwnerDashboard
            onBackToCustomer={() => setCurrentScreen('profile')}
            onOpenSchedule={() => setCurrentScreen('owner_schedule')}
            onOpenSettings={() => setCurrentScreen('owner_manage')}
            onOpenManage={() => setCurrentScreen('owner_manage')}
          />
        );

      case 'owner_manage':
        return <ScreenOwnerManage onBack={() => setCurrentScreen('owner_dashboard')} />;

      case 'owner_register':
        return (
          <ScreenOwnerRegister
            onBack={() => setCurrentScreen('profile')}
            onRegistered={(updated) => {
              setProfile(updated);
              setCurrentScreen('profile');
            }}
          />
        );

      case 'owner_schedule':
        return (
          <ScreenOwnerSchedule
            onBack={() => setCurrentScreen('owner_dashboard')}
          />
        );

      case 'admin_dashboard':
        return (
          <div className="p-2 sm:p-4 bg-slate-100 min-h-screen">
            <AdminDashboard
              onBackToCustomer={() => setCurrentScreen('profile')}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F8] text-[#111315] flex flex-col font-sans selection:bg-[#B8F23A] selection:text-[#111315]">
      {/* Normalized Mobile Viewport (max-w-md on desktop, 100% on phones) */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-[#F6F7F8] relative sm:border-x sm:border-[#E1E4E6] shadow-sm">
        {/* Main active screen */}
        <main className="flex-1 flex flex-col w-full">
          {renderScreen()}
        </main>

        {/* Bottom Navigation (Only on customer main tabs) */}
        {showBottomNav && (
          <Navigation
            activeTab={currentScreen}
            setActiveTab={(tab) => setCurrentScreen(tab as ScreenId)}
            bookingCount={upcomingBookings}
          />
        )}

        {toast && (
          <div
            role="status"
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-[14px] bg-[#111315] text-white text-xs font-bold shadow-lg max-w-[90%] text-center"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
