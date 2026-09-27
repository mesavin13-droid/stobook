import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '../design-system';
import { PointPicker } from '../PointPicker';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';

export interface GeocodeSuggestion {
  address: string;
  latitude: number;
  longitude: number;
  score: number;
}

export interface AddressPickerProps {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onAddressChange: (address: string) => void;
  onPointChange: (point: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
  label?: string;
}

const MIN_QUERY_LENGTH = 5;
const DEBOUNCE_MS = 450;

/**
 * Ввод адреса с подбором координат.
 *
 * Адрес и метка на карте должны описывать одно и то же место. Раньше владелец
 * писал адрес текстом, а координаты жёстко зашивались в клиент, и на карте все
 * автосервисы оказывались в одной точке. Здесь адрес либо уточняется по
 * геокодеру, либо метку ставят руками — молча подставить случайную точку
 * уже нельзя.
 */
export const AddressPicker: React.FC<AddressPickerProps> = ({
  address,
  latitude,
  longitude,
  onAddressChange,
  onPointChange,
  disabled,
  label = 'Адрес'
}) => {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [reverseHint, setReverseHint] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Точка выбрана: значит, владелец подтвердил место сам.
  const hasPoint = latitude !== null && longitude !== null;

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }

    // Ответы приходят не по порядку: запоминаем номер запроса и игнорируем
    // устаревший, иначе подсказки мигают при быстром наборе.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      if (requestIdRef.current !== requestId) return;
      if (!res.ok) {
        setSuggestions([]);
        const payload = await res.json().catch(() => null);
        setSearchError(payload?.error || 'Не удалось распознать адрес');
        return;
      }
      const payload = await res.json();
      const results: GeocodeSuggestion[] = Array.isArray(payload?.results) ? payload.results : [];
      setSuggestions(results);
      // Пустой результат — это не ошибка, а «не нашли»: метку можно поставить
      // руками, и об этом честнее сказать прямо.
      setSearchError(results.length === 0 ? 'Ничего не нашлось — поставьте метку на карте вручную' : null);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setSuggestions([]);
      setSearchError('Сервис подбора адреса недоступен — поставьте метку на карте');
    } finally {
      if (requestIdRef.current === requestId) setIsSearching(false);
    }
  }, []);

  const handleAddressInput = (value: string) => {
    onAddressChange(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const applySuggestion = (suggestion: GeocodeSuggestion) => {
    onAddressChange(suggestion.address);
    onPointChange({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setSuggestions([]);
    setSearchError(null);
    setIsMapOpen(true);
  };

  /**
   * Метка поставлена вручную: уточняем, что попало в точку.
   *
   * Обратное геокодирование часто отдаёт не адрес, а название объекта
   * («Уголок Святого Патрика»), поэтому результат показываем подсказкой, а не
   * подставляем молча — иначе можно стереть адрес, который владелец уже
   * аккуратно набрал. В пустое поле подставляем сами.
   */
  const resolveManualPoint = async (point: { latitude: number; longitude: number }) => {
    onPointChange(point);
    setReverseHint(null);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${point.latitude}&lng=${point.longitude}`);
      if (!res.ok) return;
      const payload = await res.json();
      const resolved = typeof payload?.address === 'string' ? payload.address.trim() : '';
      if (!resolved) return;
      setReverseHint(resolved);
      if (address.trim().length === 0) onAddressChange(resolved);
    } catch {
      // Сеть или геокодер могут лежать: адрес владелец поправит руками.
    }
  };
  return (
    <div className="space-y-2.5">
      <Input
        label={label}
        placeholder="Новосибирск, улица Ленина, 10"
        value={address}
        onChange={(e) => handleAddressInput(e.target.value)}
        disabled={disabled}
      />

      {isSearching && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#70777D]">
          <Loader2 className="w-3 h-3 animate-spin" />
          Ищем адрес…
        </p>
      )}

      {suggestions.length > 0 && (
        <ul className="space-y-1">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.address}-${suggestion.latitude}-${suggestion.longitude}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applySuggestion(suggestion)}
                className="w-full text-left px-3 py-2.5 rounded-[12px] border border-[#E1E4E6] bg-white hover:border-[#111315]/40 transition-colors"
              >
                <span className="flex items-start gap-1.5 text-xs font-bold text-[#111315]">
                  <Search className="w-3.5 h-3.5 mt-px shrink-0 text-[#70777D]" />
                  <span className="truncate">{suggestion.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchError && !isSearching && (
        <p className="text-[11px] font-semibold text-amber-600">{searchError}</p>
      )}

      {hasPoint ? (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#35B86B]">
          <MapPin className="w-3 h-3 shrink-0" />
          Точка на карте выбрана
        </p>
      ) : (
        <p className="text-[11px] font-semibold text-amber-600">
          Без метки автосервис не попадёт на карту. Выберите адрес выше или поставьте точку вручную.
        </p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsMapOpen((open) => !open)}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#70777D] hover:text-[#111315] disabled:opacity-50"
      >
        <Crosshair className="w-3.5 h-3.5" />
        {isMapOpen ? 'Скрыть карту' : 'Указать точку на карте'}
      </button>

      {isMapOpen && (
        <div className="rounded-[14px] border border-[#E1E4E6] p-2.5 bg-white">
          <PointPicker
            latitude={latitude ?? 0}
            longitude={longitude ?? 0}
            onChange={(point) => void resolveManualPoint(point)}
          />
          {reverseHint && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAddressChange(reverseHint)}
              className="mt-2 w-full text-left px-3 py-2 rounded-[12px] bg-[#F6F7F8] text-[11px] font-semibold text-[#70777D] hover:text-[#111315] disabled:opacity-50"
            >
              По этой точке: {reverseHint}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

