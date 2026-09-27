import React, { useState, useMemo } from 'react';
import { SearchBar, Button } from '../design-system';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export interface ScreenProblemSearchProps {
  initialQuery?: string;
  onBack: () => void;
  onFindServices: (problemTitle: string) => void;
}

const PROBLEM_CATEGORIES = [
  { id: 'engine', label: 'Двигатель', icon: '🔧', defaultProblem: 'Ремонт двигателя' },
  { id: 'wheels', label: 'Колёса', icon: '🛞', defaultProblem: 'Шиномонтаж' },
  { id: 'brakes', label: 'Тормоза', icon: '🛑', defaultProblem: 'Замена тормозных колодок' },
  { id: 'electric', label: 'Электрика', icon: '🔋', defaultProblem: 'Диагностика электрики' },
  { id: 'ac', label: 'Кондиционер', icon: '❄️', defaultProblem: 'Кондиционер' },
  { id: 'body', label: 'Кузов', icon: '🚗', defaultProblem: 'Кузовной ремонт' },
  { id: 'transmission', label: 'Коробка', icon: '⚙️', defaultProblem: 'Ремонт трансмиссии' },
  { id: 'diag', label: 'Диагностика', icon: '🔍', defaultProblem: 'Комплексная диагностика' }
];

export const ScreenProblemSearch: React.FC<ScreenProblemSearchProps> = ({
  initialQuery = '',
  onBack,
  onFindServices
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Категории подставляют конкретное название услуги: без «ИИ» подсказки
  // перечисляют работы, которых у выбранного СТО может не быть.
  const trimmedQuery = useMemo(() => query.trim(), [query]);

  const handleSelectCategory = (cat: typeof PROBLEM_CATEGORIES[0]) => {
    setSelectedCategory(cat.id);
    setQuery(cat.defaultProblem);
  };

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-4 sm:p-6 pb-8">
      <div className="space-y-5">
        {/* Top Back Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#111315] tracking-tight">
              Что случилось?
            </h1>
            <p className="text-xs text-[#70777D]">
              Опишите своими словами — мы подберём подходящие СТО
            </p>
          </div>
        </div>

        {/* Large Input with Mic */}
        <div>
          <SearchBar
            autoFocus
            value={query}
            onChange={(val) => setQuery(val)}
            placeholder="Например: замена масла, шиномонтаж"
            onClear={() => setQuery('')}
            onMicClick={() => setQuery('Когда еду больше 80 начинается вибрация руля')}
          />
        </div>

        {/* Categories Grid: "Или выберите проблему" */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
            Или выберите проблему
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PROBLEM_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`p-3 rounded-[16px] text-left transition-all border flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-[#111315] text-[#B8F23A] border-[#111315] shadow-xs'
                      : 'bg-white text-[#111315] border-[#E1E4E6] hover:border-[#111315]/40'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-xs font-bold tracking-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Bottom CTA to proceed to Marketplace */}
      <div className="pt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={trimmedQuery.length === 0}
          onClick={() => onFindServices(trimmedQuery)}
          icon={<ArrowRight className="w-5 h-5" />}
          iconPosition="right"
          className="h-[54px] font-extrabold shadow-sm"
        >
          Найти СТО
        </Button>
      </div>
    </div>
  );
};
