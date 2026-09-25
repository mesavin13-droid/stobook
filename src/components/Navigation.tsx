import React from 'react';
import { Home, Map, CalendarCheck, User } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  bookingCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  bookingCount = 1
}) => {
  const items = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'map', label: 'Карта', icon: Map },
    { id: 'bookings', label: 'Записи', icon: CalendarCheck, badge: bookingCount > 0 ? bookingCount : undefined },
    { id: 'profile', label: 'Профиль', icon: User }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E1E4E6] px-4 py-2 select-none shadow-lg">
      <nav className="max-w-md mx-auto flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-[14px] transition-all duration-150 ${
                isActive
                  ? 'text-[#111315]'
                  : 'text-[#70777D] hover:text-[#111315]'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1.5 rounded-[12px] transition-colors ${
                    isActive ? 'bg-[#111315] text-[#B8F23A]' : ''
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </div>
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-1 bg-[#B8F23A] text-[#111315] text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight font-semibold ${
                  isActive ? 'text-[#111315] font-extrabold' : 'text-[#70777D]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
