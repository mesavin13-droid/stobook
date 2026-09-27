import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Crosshair } from 'lucide-react';
import { createFailingOverTileLayer } from '../lib/maps/tiles';

export interface PointPickerProps {
  latitude: number;
  longitude: number;
  onChange: (point: { latitude: number; longitude: number }) => void;
  /** Подпись над картой. */
  label?: string;
}

const DEFAULT_CENTER: [number, number] = [55.0084, 82.9357];

/**
 * Выбор точки на карте для автосервиса.
 *
 * Отдельный компонент, а не переиспользование ScreenMap: здесь нужен клик по
 * карте, который возвращает координаты, и всегда одна метка. Экран клиента
 * показывает много чужих меток и не умеет сообщать о клике.
 */
export const PointPicker: React.FC<PointPickerProps> = ({ latitude, longitude, onChange, label }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Метка создаётся заново при смене координат, поэтому обновляем её
  // из эффекта, а не пересоздаём карту.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [latitude || DEFAULT_CENTER[0], longitude || DEFAULT_CENTER[1]],
      14
    );
    // Тот же набор подложек, что и на клиентской карте: стандартные тайлы
    // OpenStreetMap отвечают «Access blocked», использовать их нельзя.
    const installTiles = () => {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      tileLayerRef.current = createFailingOverTileLayer(installTiles).addTo(map);
    };
    installTiles();

    map.on('click', (event: L.LeafletMouseEvent) => {
      onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Карта создаётся один раз: пересоздание сбрасывало бы зум и положение.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const lat = latitude || DEFAULT_CENTER[0];
    const lng = longitude || DEFAULT_CENTER[1];
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    map.setView([lat, lng], map.getZoom());
  }, [latitude, longitude]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const lat = latitude || DEFAULT_CENTER[0];
    const lng = longitude || DEFAULT_CENTER[1];
    map.setView([lat, lng], 15);
  }, [latitude, longitude]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-slate-700">
          {label || 'Точка на карте'}
        </span>
        <button
          type="button"
          onClick={recenter}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
        >
          <Crosshair className="w-3 h-3" />
          К центру
        </button>
      </div>
      <div className="relative rounded-xl overflow-hidden border border-slate-200">
        <div ref={containerRef} className="h-64 w-full bg-slate-100" />
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
        <MapPin className="w-3 h-3 shrink-0" />
        Нажмите на карту, чтобы поставить метку
      </p>
      <p className="text-[11px] font-mono text-slate-600 mt-0.5">
        {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
      </p>
    </div>
  );
};
