import React from 'react';
import { UserRole } from '../types';
import { Bell, ShieldCheck, Wrench, User, MapPin, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  activeTab,
  setActiveTab,
  unreadCount = 1
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 text-white shadow-2xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3.5 cursor-pointer group" onClick={() => setActiveTab('home')}>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 group-hover:scale-105 transition-transform duration-300">
              <span className="font-black text-slate-950 text-base tracking-tighter">SB</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
                STOBOOK
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                54 RUS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block font-medium">
              Мгновенная онлайн-запись в автосервисы
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md text-xs font-semibold">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'home'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Главная
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'map'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Карта СТО
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3.5 py-1.5 rounded-lg transition-all relative ${
              activeTab === 'bookings'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Записи
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'vehicles'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Гараж
          </button>
        </nav>

        {/* Role Switcher & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Demo Role Selector */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 text-xs backdrop-blur-md">
            <button
              onClick={() => onRoleChange('CUSTOMER')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                currentRole === 'CUSTOMER'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Режим клиента"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">Клиент</span>
            </button>
            <button
              onClick={() => onRoleChange('SERVICE_OWNER')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                currentRole === 'SERVICE_OWNER'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Кабинет владельца СТО"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">СТО</span>
            </button>
            <button
              onClick={() => onRoleChange('SUPER_ADMIN')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Панель администратора"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">Админ</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
