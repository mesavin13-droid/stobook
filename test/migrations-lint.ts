/**
 * Структурная проверка SQL-миграций без Postgres.
 *
 * Миграции применяются на production-сборке до npm run build, поэтому
 * синтаксическая ошибка роняет весь деплой. Локального Postgres в проекте
 * нет, и этот скрипт ловит самые частые разрывы: незакрытые кавычки,
 * незакрытые скобки и выражения, начинающиеся не с SQL-ключа.
 *
 * Это не SQL-парсер: типы, вложенные запросы и корректность имён колонок он
 * не проверяет. Задача — ловить регрессии форматирования, а не заменить
 * PostgreSQL.
 *
 * Запуск: npm run lint:migrations
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations');

/** Ключи, с которых может начинаться отдельное выражение. */
const STATEMENT_KEYWORDS =
  /^(SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK|SET|ALTER|CREATE|DROP|WITH|GRANT|REVOKE|COMMENT|ANALYZE|VACUUM|REFRESH|DO|COPY|LOCK|EXPLAIN)\b/i;

let problems = 0;

function report(file: string, line: number, message: string) {
  problems += 1;
  console.log(`  FAIL: ${file}:${line} — ${message}`);
}

function lineOf(sql: string, index: number): number {
  return sql.slice(0, index).split('\n').length;
}

/** Убирает комментарии, а строковые литералы заменяет на пустые скобки. */
function strip(sql: string, file: string): string {
  let out = '';
  let single = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === '\n') {
        lineComment = false;
        out += ch;
      }
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (single) {
      if (ch === "'") {
        if (next === "'") {
          i += 1;
          continue;
        }
        single = false;
        out += "''";
      }
      continue;
    }
    if (ch === '-' && next === '-') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      single = true;
      continue;
    }
    out += ch;
  }

  if (single) report(file, lineOf(sql, sql.length), 'незакрытая строковая кавычка');
  if (blockComment) report(file, lineOf(sql, sql.length), 'незакрытый блочный комментарий');
  return out;
}

function main() {
  console.log('\n🔍 ПРОВЕРКА SQL-МИГРАЦИЙ\n');
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();

  for (const name of files) {
    const before = problems;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
    const text = strip(sql, name);

    let depth = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === '(') depth += 1;
      if (text[i] === ')') depth -= 1;
      if (depth < 0) {
        report(name, lineOf(sql, i), 'закрывающая скобка без открывающей');
        depth = 0;
      }
    }
    if (depth > 0) report(name, lineOf(sql, text.length), `незакрытых скобок: ${depth}`);

    for (const statement of text.split(';').map((part) => part.trim()).filter(Boolean)) {
      if (!STATEMENT_KEYWORDS.test(statement)) {
        report(name, 1, `выражение не начинается с SQL-ключа: ${statement.slice(0, 50).replace(/\s+/g, ' ')}`);
      }
    }

    if (problems === before) console.log(`  PASS: ${name}`);
  }

  console.log(`\nФайлов: ${files.length}, проблем: ${problems}\n`);
  if (problems > 0) process.exit(1);
}

main();
