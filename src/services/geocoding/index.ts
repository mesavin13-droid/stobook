/**
 * Геокодирование адреса в координаты.
 *
 * Раньше координаты автосервиса просто захардкожились в форме регистрации, и
 * все СТО попадали на карту в одну точку центра Новосибирска, пока карточка
 * продолжала показывать введённый владельцем адрес. Расхождение адреса и
 * метки и было жалобой «сделал СТО, а он по другому адресу».
 *
 * Провайдер — Esri World Geocoding. Причины те же, по которым карта уже
 * рисуется на тайлах Esri: работает по России, не требует ключа API, и это
 * серверный прокси, поэтому браузерные ограничения и требования к
 * User-Agent не при чём. Публичные Nominatim и OSM здесь не годились бы:
 * стандартные тайлы OSM этот сервер уже отдаёт как «Access blocked».
 *
 * Любая ошибка геокодера не должна ломать регистрацию: владелец всегда может
 * поставить метку на карте вручную. Поэтому функции не бросают исключений, а
 * возвращают пустой результат.
 */

/** Границы, в которых сервер вообще принимает координаты СТО. */
const MIN_LAT = 50;
const MAX_LAT = 60;
const MIN_LNG = 70;
const MAX_LNG = 90;

const ENDPOINT = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const TIMEOUT_MS = 6000;
const MAX_RESULTS = 5;

export interface GeocodeCandidate {
  /** Нормализованный адрес, который стоит показать и сохранить. */
  address: string;
  latitude: number;
  longitude: number;
  /** Точность совпадения геокодера, 0–100. */
  score: number;
}

// Кэш на стороне процесса: геокодер — внешний сервис, а владельцы массово
// подбирают похожие адреса («ул. Ленина, 1») в пределах одного сеанса.
const cache = new Map<string, { at: number; value: GeocodeCandidate[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

function cacheGet(key: string): GeocodeCandidate[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: GeocodeCandidate[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

function isUsableCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= MIN_LAT &&
    latitude <= MAX_LAT &&
    longitude >= MIN_LNG &&
    longitude <= MAX_LNG
  );
}

async function requestJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Найти координаты по написанному адресу.
 *
 * Возвращает до пяти вариантов: в России один и тот же адрес неоднозначен
 * (номер дома без корпуса, «Новосибирск» без района), и решать должен
 * владелец, а не алгоритм.
 */
export async function geocodeAddress(query: string): Promise<GeocodeCandidate[]> {
  const text = query.trim();
  if (text.length < 5) return [];

  const cacheKey = text.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `${ENDPOINT}/findAddressCandidates?f=json` +
    `&singleLine=${encodeURIComponent(text)}` +
    `&outFields=Match_addr,Score&maxLocations=${MAX_RESULTS}&countryCode=rus`;

  const data = await requestJson(url);
  const rawCandidates = Array.isArray(data?.candidates) ? data.candidates : [];

  const results: GeocodeCandidate[] = [];
  for (const candidate of rawCandidates) {
    const latitude = Number(candidate?.location?.y);
    const longitude = Number(candidate?.location?.x);
    if (!isUsableCoordinate(latitude, longitude)) continue;
    const address = String(candidate?.address || '').trim();
    if (!address) continue;
    results.push({
      address,
      latitude,
      longitude,
      score: Math.round(Number(candidate?.score) || 0)
    });
  }

  // Совпадения по умолчанию идут от лучших к худшим, но сортировка по score
  // делает порядок предсказуемым независимо от ответа геокодера.
  results.sort((left, right) => right.score - left.score);
  const limited = results.slice(0, MAX_RESULTS);

  cacheSet(cacheKey, limited);
  return limited;
}

/**
 * Обратное геокодирование: координаты → адрес.
 *
 * Нужно, когда владелец поставил метку руками и хочет увидеть, что попало
 * в карточку, вместо того чтобы писать адрес заново.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (!isUsableCoordinate(latitude, longitude)) return null;

  const cacheKey = `rev:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
  const cached = cacheGet(cacheKey);
  if (cached && cached.length > 0) return cached[0].address;

  const url =
    `${ENDPOINT}/reverseGeocode?f=json` +
    `&location=${encodeURIComponent(`${longitude},${latitude}`)}`;

  const data = await requestJson(url);
  const address = String(data?.address?.Match_addr || '').trim();
  if (!address) return null;

  cacheSet(cacheKey, [
    { address, latitude, longitude, score: 100 }
  ]);
  return address;
}

/** Только для тестов: сброс кэша между прогонами. */
export function clearGeocodeCache(): void {
  cache.clear();
}
