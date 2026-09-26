// Реквизиты оператора персональных данных и условия оказания услуг.
//
// ВАЖНО ДЛЯ ЗАПУСКА В PRODUCTION: заполните все поля ниже. Пока реквизиты не
// заполнены, экран документов показывает незаполненные плейсхолдеры и
// помечается как неготовый к публикации, а согласие в ScreenAuth блокирует
// вход (см. isLegalReady).
//
// Значения по умолчанию можно переопределить переменными окружения VITE_*,
// но правки в этом файле надёжнее: они попадают в сборку и не зависят от
// конфигурации деплоя.

export interface LegalOperator {
  /** Полное наименование юридического лица или ИП, например: ООО «Сервис» */
  legalName: string;
  /** ИНН, 10 или 12 цифр. Обязателен по ст. 19 ФЗ-152. */
  inn: string;
  /** ОГРН или ОГРНИП, 13 или 15 цифр. */
  ogrn: string;
  /** КПП, 9 цифр. Не заполняется для ИП. */
  kpp: string;
  /** Юридический адрес. */
  address: string;
  /** Адрес для обращений и претензий, если он отличается от юридического. */
  claimsAddress: string;
  /** Почта для общих обращений. */
  email: string;
  /** Почта для обращений по персональным данным (ст. 14 ФЗ-152). */
  personalDataEmail: string;
  /** Телефон поддержки. */
  phone: string;
  /** Публичный адрес сайта. */
  siteUrl: string;
}

const operator: LegalOperator = {
  legalName: 'ЗАПОЛНИТЕ: ООО «Название компании»',
  inn: 'ЗАПОЛНИТЕ: ИНН',
  ogrn: 'ЗАПОЛНИТЕ: ОГРН',
  kpp: 'ЗАПОЛНИТЕ: КПП',
  address: 'ЗАПОЛНИТЕ: юридический адрес',
  claimsAddress: 'ЗАПОЛНИТЕ: адрес для обращений',
  email: 'ЗАПОЛНИТЕ: support@stobook.ru',
  personalDataEmail: 'ЗАПОЛНИТЕ: privacy@stobook.ru',
  phone: 'ЗАПОЛНИТЕ: +7 (000) 000-00-00',
  siteUrl: 'https://stobook.ru'
};

function readEnv(key: string, fallback: string): string {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  const value = raw?.trim();
  return value && value.length > 0 ? value : fallback;
}

export const LEGAL_OPERATOR: LegalOperator = {
  legalName: readEnv('VITE_LEGAL_NAME', operator.legalName),
  inn: readEnv('VITE_LEGAL_INN', operator.inn),
  ogrn: readEnv('VITE_LEGAL_OGRN', operator.ogrn),
  kpp: readEnv('VITE_LEGAL_KPP', operator.kpp),
  address: readEnv('VITE_LEGAL_ADDRESS', operator.address),
  claimsAddress: readEnv('VITE_LEGAL_CLAIMS_ADDRESS', operator.claimsAddress),
  email: readEnv('VITE_LEGAL_EMAIL', operator.email),
  personalDataEmail: readEnv('VITE_LEGAL_PERSONAL_DATA_EMAIL', operator.personalDataEmail),
  phone: readEnv('VITE_LEGAL_PHONE', operator.phone),
  siteUrl: readEnv('VITE_LEGAL_SITE_URL', operator.siteUrl)
};

const UNRESOLVED = /ЗАПОЛНИТЕ/i;

/**
 * Все ли реквизиты заполнены. Пока нет, документы нельзя публиковать:
 * в тексте согласия нельзя сослаться на несуществующий ИНН или ОГРН.
 */
export function isLegalReady(target: LegalOperator = LEGAL_OPERATOR): boolean {
  return !Object.values(target).some((value) => UNRESOLVED.test(value));
}

export { UNRESOLVED as LEGAL_UNRESOLVED_PATTERN };