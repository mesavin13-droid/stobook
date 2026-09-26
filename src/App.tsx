import React, { useState, useEffect } from 'react';
import { Profile, Vehicle, ServiceCenter } from './types';
import { Navigation } from './components/Navigation';

// Screens
import { ScreenOnboarding } from './components/screens/ScreenOnboarding';
import { ScreenAuth } from './components/screens/ScreenAuth';
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
import { ScreenOwnerSettings } from './components/screens/ScreenOwnerSettings';
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
  | 'owner_settings'
  | 'owner_register'
  | 'admin_dashboard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [profile, setProfile] = useState<Profile | null>(null);

  // Core Data
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 'b1111111-1111-1111-1111-111111111111',
      user_id: 'a1111111-1111-1111-1111-111111111111',
      brand: 'Toyota',
      model: 'Camry',
      year: 2021,
      mileage: 124000,
      license_plate: 'О 777 ОО 54',
      photo_url: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=600&q=80'
    }
  ]);

  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([
    {
      id: 'c0010000-0000-0000-0000-000000000001',
      owner_id: 'a2222222-2222-2222-2222-222222222222',
      city_id: 'c1111111-1111-1111-1111-111111111111',
      status: 'ACTIVE',
      name: 'ТОП МОТОРС',
      description: 'Специализированный автосервис японских и европейских автомобилей. Компьютерная диагностика, ремонт подвески, тормозных систем, плановое ТО.',
      address: 'ул. Днепрогэсовская, 9/1',
      latitude: 55.0125,
      longitude: 82.9460,
      phone: '+7 (383) 299-15-54',
      rating: 4.9,
      reviews_count: 852,
      is_promoted: true,
      minPrice: 1500,
      distance_km: 1.7,
      availabilityStatus: 'today',
      available_today_slots: ['15:30', '17:00', '18:30'],
      services: [
        { id: 'f0010000-0000-0000-0000-000000000001', service_center_id: 'c0010000-0000-0000-0000-000000000001', custom_name: 'Замена тормозных колодок', price: 2500, duration_minutes: 60, custom_category: 'Тормоза', is_fixed_price: false, is_active: true },
        { id: 'f0010000-0000-0000-0000-000000000002', service_center_id: 'c0010000-0000-0000-0000-000000000001', custom_name: 'Замена масла и фильтров', price: 1500, duration_minutes: 40, custom_category: 'Замена масла', is_fixed_price: false, is_active: true },
        { id: 'f0010000-0000-0000-0000-000000000003', service_center_id: 'c0010000-0000-0000-0000-000000000001', custom_name: 'Компьютерная диагностика', price: 1000, duration_minutes: 30, custom_category: 'Диагностика', is_fixed_price: true, is_active: true },
        { id: 'f0010000-0000-0000-0000-000000000004', service_center_id: 'c0010000-0000-0000-0000-000000000001', custom_name: 'Развал-схождение', price: 1800, duration_minutes: 60, custom_category: 'Подвеска', is_fixed_price: false, is_active: true }
      ]
    },
    {
      id: 'c0020000-0000-0000-0000-000000000002',
      owner_id: 'a3333333-3333-3333-3333-333333333333',
      city_id: 'c1111111-1111-1111-1111-111111111111',
      status: 'ACTIVE',
      name: 'НСК АВТО 54',
      description: 'Профессиональный автосервис в Новосибирске. Замена техжидкостей, ремонт ДВС и тормозов.',
      address: 'ул. Немировича-Данченко, 138',
      latitude: 54.985,
      longitude: 82.905,
      phone: '+7 (383) 300-44-55',
      rating: 4.7,
      reviews_count: 198,
      is_promoted: false,
      minPrice: 2300,
      distance_km: 2.4,
      availabilityStatus: 'today',
      available_today_slots: ['17:00', '18:30'],
      services: [
        { id: 'f0020000-0000-0000-0000-000000000001', service_center_id: 'c0020000-0000-0000-0000-000000000002', custom_name: 'Замена тормозных колодок', price: 2300, duration_minutes: 50, custom_category: 'Тормоза', is_fixed_price: false, is_active: true },
        { id: 'f0020000-0000-0000-0000-000000000002', service_center_id: 'c0020000-0000-0000-0000-000000000002', custom_name: 'Замена масла', price: 1400, duration_minutes: 40, custom_category: 'Замена масла', is_fixed_price: false, is_active: true }
      ]
    }
  ]);

  // Booking Flow State
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter>(serviceCenters[0]);
  const [selectedTask, setSelectedTask] = useState<string>('Замена тормозных колодок');
  const [selectedServiceItem, setSelectedServiceItem] = useState<{ id: string; name: string; price: number; duration: number }>({
    id: 'f0010000-0000-0000-0000-000000000001',
    name: 'Замена тормозных колодок',
    price: 2500,
    duration: 60
  });
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-25');
  const [selectedTime, setSelectedTime] = useState<string>('17:30');

  const loadVehicles = async (): Promise<Vehicle[]> => {
    const response = await fetch('/api/vehicles', { credentials: 'same-origin' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data as Vehicle[] : [];
  };

  // Sync initial backend data
  useEffect(() => {
    fetch('/api/service-centers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setServiceCenters(data);
          setSelectedCenter(data[0]);
        }
      })
      .catch(() => {});

    loadVehicles()
      .then((data) => {
        if (data.length > 0) setVehicles(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile) setProfile(data.profile as Profile);
      })
      .catch(() => {});
  }, []);

  const activeVehicle = vehicles[0] || {
    id: 'b1111111-1111-1111-1111-111111111111',
    user_id: 'a1111111-1111-1111-1111-111111111111',
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    mileage: 124000,
    license_plate: 'О 777 ОО 54'
  };

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
    // If selected service center has real services, pick matched or first
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

  // Render active screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'onboarding':
        return (
          <ScreenOnboarding
            onStart={() => setCurrentScreen('auth')}
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
        return (
          <ScreenServiceDetail
            serviceCenter={selectedCenter}
            onBack={() => setCurrentScreen('marketplace')}
            onBook={() => setCurrentScreen('service_select')}
            onSelectServiceItem={(name) => {
              setSelectedTask(name);
              setCurrentScreen('service_select');
            }}
          />
        );

      case 'service_select':
        return (
          <ScreenServiceSelect
            vehicle={activeVehicle}
            serviceCenter={selectedCenter}
            initialSelectedService={selectedTask}
            onBack={() => setCurrentScreen('service_detail')}
            onNext={(serviceItem) => {
              setSelectedServiceItem(serviceItem);
              setCurrentScreen('datetime_select');
            }}
          />
        );

      case 'datetime_select':
        return (
          <ScreenDateTimeSelect
            serviceCenterId={selectedCenter.id}
            serviceCenterServiceId={selectedServiceItem.id}
            onBack={() => setCurrentScreen('service_select')}
            onNext={(date, time) => {
              setSelectedDate(date);
              setSelectedTime(time);
              setCurrentScreen('confirmation');
            }}
          />
        );

      case 'confirmation':
        return (
          <ScreenConfirmation
            vehicle={activeVehicle}
            serviceCenter={selectedCenter}
            serviceName={selectedServiceItem.name}
            price={selectedServiceItem.price}
            dateStr={selectedDate}
            timeStr={selectedTime}
            onBack={() => setCurrentScreen('datetime_select')}
            onConfirm={handleConfirmBooking}
          />
        );

      case 'booking_success':
        return (
          <ScreenBookingSuccess
            vehicle={activeVehicle}
            serviceCenter={selectedCenter}
            serviceName={selectedServiceItem.name}
            timeStr={selectedTime}
            onOpenBooking={() => setCurrentScreen('bookings')}
            onNavigateToCenter={() => alert('Маршрут передан в навигатор')}
            onAddToCalendar={() => alert('Запись сохранена в календарь')}
          />
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
            onOpenCarProfile={() => {
              if (requireAuthentication()) setCurrentScreen('car_profile');
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
            onOpenSettings={() => setCurrentScreen('owner_settings')}
          />
        );

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

      case 'owner_settings':
        return (
          <ScreenOwnerSettings
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
            bookingCount={1}
          />
        )}
      </div>
    </div>
  );
}
