import React from 'react';
import { Star, Search, X, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

// ==========================================
// 1. BUTTONS (Height 48-54px, 16px radius)
// ==========================================
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  icon,
  iconPosition = 'left',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-bold tracking-tight rounded-[16px] transition-all duration-150 focus:outline-none select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const sizeClasses = {
    sm: 'h-10 px-4 text-xs',
    md: 'h-12 px-5 text-sm',
    lg: 'h-[52px] px-6 text-sm sm:text-base'
  }[size];

  const variantClasses = {
    // Primary: Lime #B8F23A with dark text #111315
    primary: 'bg-[#B8F23A] text-[#111315] hover:bg-[#A8E82A] active:bg-[#9BE01B] shadow-xs',
    // Secondary: Pure Dark #111315 with white text
    secondary: 'bg-[#111315] text-white hover:bg-[#1B1E20] active:bg-[#2A2E32]',
    // Ghost: Clean neutral outline or subtle surface
    ghost: 'bg-[#ECEFF1] text-[#111315] hover:bg-[#E1E4E6] active:bg-[#D5D9DC]',
    // Danger: Error state
    danger: 'bg-[#E55353] text-white hover:bg-[#D84545] active:bg-[#C93838]',
    // Dark accent
    dark: 'bg-[#1B1E20] text-white hover:bg-[#252A2D]'
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="mr-2 shrink-0">{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span className="ml-2 shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};

// ==========================================
// 2. INPUTS (Clean, 14-16px radius, #FFFFFF)
// ==========================================
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-[#70777D] tracking-tight">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-4 text-[#70777D] pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          className={`w-full h-[52px] bg-white text-[#111315] placeholder:text-[#70777D]/70 font-medium text-sm rounded-[16px] border border-[#E1E4E6] transition-all focus:outline-none focus:border-[#111315] focus:ring-1 focus:ring-[#111315] disabled:bg-[#ECEFF1] disabled:text-[#70777D] ${
            leftIcon ? 'pl-11' : 'pl-4'
          } ${rightIcon ? 'pr-11' : 'pr-4'} ${error ? 'border-[#E55353] focus:border-[#E55353] focus:ring-[#E55353]' : ''} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-4 text-[#70777D] flex items-center">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-[#E55353] font-medium flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

// ==========================================
// 3. SEARCH BAR (Uber / Yandex Go clean style)
// ==========================================
export interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onMicClick?: () => void;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Опишите проблему или услугу...',
  onClear,
  onMicClick,
  autoFocus = false
}) => {
  return (
    <div className="relative w-full flex items-center">
      <Search className="w-5 h-5 text-[#70777D] absolute left-4 pointer-events-none" />
      <input
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[54px] bg-white text-[#111315] placeholder:text-[#70777D] text-sm font-medium pl-12 pr-12 rounded-[18px] border border-[#E1E4E6] shadow-xs focus:outline-none focus:border-[#111315] focus:ring-1 focus:ring-[#111315] transition-all"
      />
      <div className="absolute right-3.5 flex items-center gap-1.5">
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-full hover:bg-[#ECEFF1] text-[#70777D] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : onMicClick ? (
          <button
            type="button"
            onClick={onMicClick}
            title="Голосовой ввод"
            className="p-2 rounded-xl text-[#111315] bg-[#ECEFF1] hover:bg-[#E1E4E6] transition-colors flex items-center justify-center text-sm"
          >
            🎙️
          </button>
        ) : null}
      </div>
    </div>
  );
};

// ==========================================
// 4. FILTER CHIP
// ==========================================
export interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
  icon?: React.ReactNode;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  active = false,
  onClick,
  count,
  icon
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[14px] text-xs font-semibold tracking-tight transition-all select-none ${
        active
          ? 'bg-[#111315] text-[#B8F23A] shadow-xs'
          : 'bg-white text-[#111315] border border-[#E1E4E6] hover:border-[#111315]/40'
      }`}
    >
      {icon && <span className="text-sm">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            active ? 'bg-[#B8F23A] text-[#111315]' : 'bg-[#ECEFF1] text-[#70777D]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

// ==========================================
// 5. RATING BADGE
// ==========================================
export const RatingBadge: React.FC<{ rating: number; count?: number }> = ({
  rating,
  count
}) => {
  return (
    <div className="inline-flex items-center gap-1 text-xs font-bold text-[#111315]">
      <span className="text-[#F2B84B]">★</span>
      <span>{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-[#70777D] font-normal">({count})</span>
      )}
    </div>
  );
};

// ==========================================
// 6. STATUS BADGE
// ==========================================
export type StatusType = 'today' | 'tomorrow' | 'none' | 'confirmed' | 'pending' | 'completed' | 'cancelled';

export const StatusBadge: React.FC<{ status: StatusType; text?: string }> = ({
  status,
  text
}) => {
  const configs: Record<StatusType, { bg: string; text: string; dot: string; label: string }> = {
    today: {
      bg: 'bg-[#35B86B]/10',
      text: 'text-[#35B86B]',
      dot: 'bg-[#35B86B]',
      label: 'Сегодня свободно'
    },
    tomorrow: {
      bg: 'bg-[#F2B84B]/15',
      text: 'text-[#9A6A12]',
      dot: 'bg-[#F2B84B]',
      label: 'Завтра'
    },
    none: {
      bg: 'bg-[#ECEFF1]',
      text: 'text-[#70777D]',
      dot: 'bg-[#70777D]',
      label: 'Нет мест'
    },
    confirmed: {
      bg: 'bg-[#35B86B]/10',
      text: 'text-[#35B86B]',
      dot: 'bg-[#35B86B]',
      label: 'Подтверждена'
    },
    pending: {
      bg: 'bg-[#F2B84B]/15',
      text: 'text-[#9A6A12]',
      dot: 'bg-[#F2B84B]',
      label: 'Ожидает'
    },
    completed: {
      bg: 'bg-[#ECEFF1]',
      text: 'text-[#111315]',
      dot: 'bg-[#111315]',
      label: 'Завершена'
    },
    cancelled: {
      bg: 'bg-[#E55353]/10',
      text: 'text-[#E55353]',
      dot: 'bg-[#E55353]',
      label: 'Отменена'
    }
  };

  const conf = configs[status] || configs.none;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-xs font-semibold ${conf.bg} ${conf.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
      <span>{text || conf.label}</span>
    </span>
  );
};

// ==========================================
// 7. TIME SLOT CAPSULE
// ==========================================
export const TimeSlot: React.FC<{
  time: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ time, selected = false, onClick, disabled = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-11 px-4 rounded-[14px] text-xs font-bold font-mono tracking-tight transition-all select-none flex items-center justify-center ${
        selected
          ? 'bg-[#B8F23A] text-[#111315] shadow-xs'
          : disabled
          ? 'bg-[#ECEFF1] text-[#70777D]/50 border border-transparent cursor-not-allowed'
          : 'bg-white text-[#111315] border border-[#E1E4E6] hover:border-[#111315]'
      }`}
    >
      {time}
    </button>
  );
};

// ==========================================
// 8. DATE SELECTOR PILL
// ==========================================
export interface DateOption {
  dayName: string;
  dayNumber: number;
  dateStr: string;
  isToday?: boolean;
  isTomorrow?: boolean;
}

export const DateSelector: React.FC<{
  options: DateOption[];
  selectedDate: string;
  onSelect: (dateStr: string) => void;
}> = ({ options, selectedDate, onSelect }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
      {options.map((opt) => {
        const isSelected = selectedDate === opt.dateStr;
        return (
          <button
            key={opt.dateStr}
            type="button"
            onClick={() => onSelect(opt.dateStr)}
            className={`shrink-0 w-20 py-2.5 rounded-[16px] flex flex-col items-center justify-center transition-all select-none border ${
              isSelected
                ? 'bg-[#111315] text-white border-[#111315] shadow-sm'
                : 'bg-white text-[#111315] border-[#E1E4E6] hover:border-[#111315]/40'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold tracking-wider ${
                isSelected
                  ? 'text-[#B8F23A]'
                  : opt.isToday
                  ? 'text-[#35B86B]'
                  : 'text-[#70777D]'
              }`}
            >
              {opt.isToday ? 'Сегодня' : opt.isTomorrow ? 'Завтра' : opt.dayName}
            </span>
            <span className="text-base font-extrabold font-mono mt-0.5">
              {opt.dayNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ==========================================
// 9. BOTTOM SHEET
// ==========================================
export const BottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#111315]/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl border border-[#E1E4E6] overflow-hidden flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-200">
        {/* Drag handle */}
        <div className="sm:hidden w-10 h-1.5 bg-[#E1E4E6] rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#E1E4E6] flex items-center justify-between">
          <div>
            {title && <h3 className="text-base font-extrabold text-[#111315] tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-[#70777D] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#70777D] hover:text-[#111315] rounded-xl hover:bg-[#ECEFF1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// ==========================================
// 10. EMPTY STATE
// ==========================================
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionText, onAction }) => {
  return (
    <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-8 text-center space-y-3.5 shadow-xs">
      {icon && <div className="flex justify-center text-4xl mb-1">{icon}</div>}
      <h3 className="font-extrabold text-base text-[#111315] tracking-tight">{title}</h3>
      <p className="text-xs text-[#70777D] max-w-xs mx-auto leading-relaxed">{description}</p>
      {actionText && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="md" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};
