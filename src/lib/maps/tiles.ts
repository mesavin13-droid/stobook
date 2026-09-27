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
 * Второй раз основным стоял Esri Canvas Light Gray, и он тоже не годился:
 * начиная с z17 сервер отдаёт «Map data not yet available», то есть вместо
 * карты серый фон. На z14 это незаметно, а метку автосервиса ставят на
 * z17–18 — там карта и выглядела мутной.
 *
 * World Street Map — полноценная картографическая подложка: цвет, здания,
 * названия улиц кириллицей, данные до z19.
 */
export const TILE_SOURCES: TileSource[] = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
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
 *
 * detectRetina заставляет Leaflet брать тайл на уровень глубже и показывать
 * его в 256 CSS-пикселей. Без этого на телефоне с экраном 2–3x тайл
 * растягивается вдвое и карта выглядит мыльной.
 */
export function createFailingOverTileLayer(
  onSourceChange: (index: number) => void
): L.TileLayer {
  let sourceIndex = 0;
  let errorCount = 0;

  const install = () => {
    const source = TILE_SOURCES[sourceIndex];
    if (!source) return;
    const next = L.tileLayer(source.url, {
      maxZoom: source.maxZoom,
      attribution: source.attribution,
      detectRetina: true
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

  return install()!;
}
