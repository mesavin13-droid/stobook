import L from 'leaflet';

export interface TileSource {
  url: string;
  maxZoom: number;
  attribution: string;
}

/**
 * Подложки карты. Без ключей API и без водяных знаков поверх тайлов.
 *
 * Раньше здесь стояли CARTO Positron и OpenStreetMap, и обе были непригодны:
 *
 *  - CARTO теперь отдаёт вместо тайла картинку «API KEY REQUIRED» (проверено:
 *    два разных тайла приходят байт-в-байт одинаковыми, 2049 байт);
 *  - стандартный слой OpenStreetMap отвечает «Access blocked» — сервер требует
 *    идентифицирующий User-Agent, а браузер шлёт свой собственный. Для
 *    приложения с тысячами пользователей эти тайлы использовать нельзя.
 *
 * Esri Canvas отдаёт настоящие тайлы без ключа. Light Gray Base — спокойный
 * светлый фон, на котором хорошо читаются метки автосервисов. Остальные слои
 * включаются автоматически, если основной перестал отдавать тайлы.
 */
export const TILE_SOURCES: TileSource[] = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Esri, HERE, Garmin, USGS, &copy; OpenStreetMap contributors'
  },
  {
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.opencyclomap.org/">OpenCycleMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics'
  }
];

/**
 * Слой с автопереключением: при серии неудачных загрузок переходит к следующему
 * источнику, чтобы карта не осталась пустой серой сеткой.
 */
export function createFailingOverTileLayer(
  onSourceChange: (index: number) => void
): L.TileLayer {
  let sourceIndex = 0;
  let errorCount = 0;
  let layer: L.TileLayer;

  const install = () => {
    const source = TILE_SOURCES[sourceIndex];
    if (!source) return;
    const next = L.tileLayer(source.url, {
      maxZoom: source.maxZoom,
      attribution: source.attribution
    });
    next.on('tileerror', () => {
      errorCount += 1;
      if (errorCount >= 6 && sourceIndex < TILE_SOURCES.length - 1) {
        errorCount = 0;
        sourceIndex += 1;
        next.remove();
        onSourceChange(sourceIndex);
        install();
      }
    });
    return next;
  };

  layer = install()!;
  return layer;
}
