import React from 'react';

/**
 * Общие каркасные элементы кабинета владельца.
 *
 * Раньше Card и Row были объявлены прямо в ScreenOwnerManage, и вкладка
 * историй не могла их использовать. Дублировать разметку в двух местах —
 * значило бы через месяц получить две разные карточки, поэтому вынесено
 * сюда.
 */
export const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 space-y-3">{children}</div>
);

export const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2">{children}</div>
);
