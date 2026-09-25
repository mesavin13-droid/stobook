import React, { useState, useEffect } from 'react';
import { SearchBar, Button } from '../design-system';
import { ArrowLeft, Sparkles, Check, AlertCircle, ArrowRight } from 'lucide-react';

export interface ScreenProblemSearchProps {
  initialQuery?: string;
  onBack: () => void;
  onFindServices: (problemTitle: string, suggestedServices: string[]) => void;
}

const PROBLEM_CATEGORIES = [
  { id: 'engine', label: 'Двигатель', icon: '🔧', defaultProblem: 'Троит или горит Check Engine' },
  { id: 'wheels', label: 'Колёса', icon: '🛞', defaultProblem: 'Вибрация руля на скорости 80+ км/ч' },
  { id: 'brakes', label: 'Тормоза', icon: '🛑', defaultProblem: 'При торможении появился скрип' },
  { id: 'electric', label: 'Электрика', icon: '🔋', defaultProblem: 'Не заводится, разряжается аккумулятор' },
  { id: 'ac', label: 'Кондиционер', icon: '❄️', defaultProblem: 'Не дует холодным или появился запах' },
  { id: 'body', label: 'Кузов', icon: '🚗', defaultProblem: 'Вмятина или покраска элемента' },
  { id: 'transmission', label: 'Коробка', icon: '⚙️', defaultProblem: 'Пинки при переключении передач' },
  { id: 'diag', label: 'Диагностика', icon: '🔍', defaultProblem: 'Комплексная диагностика перед покупкой' }
];

export const ScreenProblemSearch: React.FC<ScreenProblemSearchProps> = ({
  initialQuery = '',
  onBack,
  onFindServices
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery.toLowerCase().includes('тормоз') || initialQuery.toLowerCase().includes('скрип')) {
      setSelectedCategory('brakes');
    }
  }, [initialQuery]);

  // AI suggestions engine based on input
  const getAiDiagnosis = () => {
    const q = query.toLowerCase();
    if (q.includes('вибрац') || selectedCategory === 'wheels') {
      return {
        title: 'Колёса и подвеска',
        causes: ['Балансировка колёс', 'Состояние шин и дисков', 'Люфт в элементах подвески'],
        recommended: 'Рекомендуем начать с диагностики ходовой части и балансировки',
        services: ['Диагностика ходовой части', 'Балансировка колёс', 'Проверка геометрии подвески']
      };
    }
    if (q.includes('масл') || q.includes('то')) {
      return {
        title: 'Регулярное ТО',
        causes: ['Выработан ресурс масла', 'Засорение масляного и воздушного фильтра'],
        recommended: 'Рекомендуем плановое ТО: замена масла и фильтров',
        services: ['Замена моторного масла', 'Замена масляного фильтра', 'Замена воздушного фильтра']
      };
    }
    // Default / Brakes case
    return {
      title: 'Замена тормозных колодок',
      causes: ['Износ фрикционного слоя колодок', 'Неравномерный износ тормозного диска', 'Закисание направляющих суппорта'],
      recommended: 'Рекомендуем начать с диагностики тормозной системы',
      services: ['Диагностика тормозной системы', 'Замена тормозных колодок', 'Проверка тормозных дисков']
    };
  };

  const aiResult = getAiDiagnosis();

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
            placeholder="Например: При торможении появился скрип"
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

        {/* AI Smart Diagnosis Breakdown (Shows when query exists) */}
        {(query.trim().length > 0 || selectedCategory) && (
          <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-4 sm:p-5 space-y-4 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#111315]">
              <div className="w-6 h-6 rounded-[8px] bg-[#B8F23A] flex items-center justify-center text-[#111315]">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>Похоже, вам может понадобиться</span>
            </div>

            <div className="space-y-2">
              {aiResult.services.map((srv, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-2.5 rounded-[12px] bg-[#F6F7F8] text-xs font-bold text-[#111315]"
                >
                  <div className="w-5 h-5 rounded-full bg-[#B8F23A] text-[#111315] flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{srv}</span>
                </div>
              ))}
            </div>

            {/* Recommendation badge */}
            <div className="p-3 rounded-[14px] bg-[#ECEFF1] text-xs text-[#111315] font-medium leading-relaxed">
              💡 <span className="font-bold">{aiResult.recommended}</span>
            </div>

            {/* Disclaimer */}
            <p className="text-[11px] text-[#70777D] leading-tight">
              Предварительная рекомендация. Точную причину определит специалист.
            </p>
          </div>
        )}
      </div>

      {/* Bottom CTA to proceed to Marketplace */}
      <div className="pt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() =>
            onFindServices(
              query.trim() || 'Замена тормозных колодок',
              aiResult.services
            )
          }
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
