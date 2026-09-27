/**
 * Тесты геокодера с подменённым fetch.
 *
 * Геокодер ходит во внешний сервис, поэтому реальные запросы здесь были бы
 * медленными и зависели бы от сети. Подменяем fetch и проверяем контракт:
 * разбор ответа, отсечение ненужных координат, кэш и деградацию при сбое.
 *
 * Запуск: npm run test:geocoding
 */
import { geocodeAddress, reverseGeocode, clearGeocodeCache } from '../src/services/geocoding/index.js';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const realFetch = globalThis.fetch;
let lastUrl = '';
let responder: (url: string) => unknown = () => ({ candidates: [] });

function stubFetch() {
  globalThis.fetch = (async (input: any) => {
    lastUrl = String(input);
    const body = responder(lastUrl);
    return {
      ok: true,
      status: 200,
      json: async () => body
    } as any;
  }) as typeof fetch;
}

function candidate(y: number, x: number, score: number, address: string) {
  return { address, location: { y, x }, score };
}

async function runTests() {
  console.log('\n🌍 ГЕОКОДИРОВАНИЕ АДРЕСА\n');
  stubFetch();

  // --- Разбор ответа ---------------------------------------------------------
  console.log('--- разбор ответа Esri ---');
  responder = () => ({
    candidates: [
      candidate(55.0612, 82.9187, 98.4, 'Новосибирск, улица Ленина, 10'),
      candidate(55.064, 82.921, 91.2, 'Новосибирск, улица Ленина, 10к1')
    ]
  });
  clearGeocodeCache();
  const parsed = await geocodeAddress('ул. Ленина, 10, Новосибирск');
  check('адрес разобран в координаты', parsed.length === 2, `получено ${parsed.length}`);
  check('широта и долгота на своих местах', parsed[0]?.latitude === 55.0612 && parsed[0]?.longitude === 82.9187);
  check('совпадение отсортировано по точности', parsed[0]?.score === 98 && parsed[1]?.score === 91);
  check('в запрос уходит текст адреса', lastUrl.includes('findAddressCandidates') && lastUrl.includes('singleLine='));

  // --- Отсечение непригодных координат --------------------------------------
  console.log('\n--- отсечение лишнего ---');
  responder = () => ({
    candidates: [
      candidate(55.06, 82.92, 99, 'Новосибирск, улица Ленина, 10'),
      // Москва и зарубежье: сервер такие координаты всё равно не примет.
      candidate(55.75, 37.61, 97, 'Москва, Тверская, 1'),
      candidate(48.85, 2.35, 96, 'Paris, Rue de Rivoli'),
      { address: 'Без координат', location: {}, score: 80 },
      { address: '', location: { y: 55.06, x: 82.92 }, score: 80 }
    ]
  });
  clearGeocodeCache();
  const filtered = await geocodeAddress('Тестовая улица, Новосибирск');
  check('оставлен только результат в допустимых границах', filtered.length === 1, `получено ${filtered.length}`);
  check('в результат не попал пустой адрес', filtered.every((item) => item.address.length > 0));

  // --- Кэш -------------------------------------------------------------------
  console.log('\n--- кэш ---');
  clearGeocodeCache();
  let callCount = 0;
  responder = () => {
    callCount += 1;
    return { candidates: [candidate(55.06, 82.92, 99, 'Новосибирск, улица Ленина, 10')] };
  };
  await geocodeAddress('Новосибирск, улица Ленина, 10');
  await geocodeAddress('новосибирск, УЛИЦА ЛЕНИНА, 10');
  check('повторный запрос того же адреса не ходит в сеть', callCount === 1, `запросов: ${callCount}`);

  // --- Короткий запрос --------------------------------------------------------
  console.log('\n--- короткий запрос ---');
  callCount = 0;
  clearGeocodeCache();
  const tooShort = await geocodeAddress('ул');
  check('слишком короткий адрес не отправляется', tooShort.length === 0 && callCount === 0);

  // --- Обратное геокодирование ------------------------------------------------
  console.log('\n--- обратное геокодирование ---');
  clearGeocodeCache();
  responder = () => ({ address: { Match_addr: 'Новосибирск, улица Ленина, 10' } });
  const reversed = await reverseGeocode(55.0612, 82.9187);
  check('координаты разворачиваются в адрес', reversed === 'Новосибирск, улица Ленина, 10', String(reversed));
  check('в запрос уходят долгота,широта', lastUrl.includes('location=82.9187%2C55.0612') || lastUrl.includes('location=82.9187,55.0612'));

  // --- Деградация -------------------------------------------------------------
  console.log('\n--- сбой внешнего сервиса ---');
  clearGeocodeCache();
  const before = passed + failed;
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  const degraded = await geocodeAddress('Новосибирск, улица Ленина, 10');
  const degradedReverse = await reverseGeocode(55.0612, 82.9187);
  check('падение геокодера не бросает исключение', Array.isArray(degraded) && degraded.length === 0);
  check('падение обратного геокодирования не бросает исключение', degradedReverse === null);
  check('ошибка не ломает счётчик проверок', passed + failed > before);

  // --- Недопустимые координаты -------------------------------------------------
  clearGeocodeCache();
  const outOfRange = await reverseGeocode(10, 10);
  check('точка вне границ России отклоняется', outOfRange === null);

  globalThis.fetch = realFetch;

  console.log(`\nИТОГО: ${passed} прошло, ${failed} провалено\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  globalThis.fetch = realFetch;
  console.error('Тесты геокодирования упали:', error);
  process.exit(1);
});
