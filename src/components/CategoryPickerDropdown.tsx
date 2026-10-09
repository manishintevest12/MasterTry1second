import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Sparkles, X, Grid, Search, SlidersHorizontal } from 'lucide-react';
import { VerticalCategory } from '../data/categoriesData';

interface CategoryPickerDropdownProps {
  categories: VerticalCategory[];
  selectedCategoryId: string;
  onSelectCategory: (category: VerticalCategory) => void;
  accentColor?: string; // e.g. 'orange', 'emerald', 'amber', 'purple'
  className?: string;
  labelPrefix?: string;
}

export const CategoryPickerDropdown: React.FC<CategoryPickerDropdownProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  accentColor = 'orange',
  className = '',
  labelPrefix = 'Category',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMatch = (c: VerticalCategory, val: string) => {
    if (!val) return false;
    const v = val.toLowerCase().trim();
    if (v === 'all' || v === 'all categories' || v === 'all aisles' || v === 'all products') {
      return c.id.endsWith('-all');
    }
    return (
      c.id.toLowerCase() === v ||
      c.name.toLowerCase() === v ||
      (c.shortName && c.shortName.toLowerCase() === v) ||
      (v.length > 2 && c.name.toLowerCase().includes(v))
    );
  };

  const selectedCategory =
    categories.find((c) => isMatch(c, selectedCategoryId)) || categories[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = filterText.trim()
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(filterText.toLowerCase()) ||
          c.description.toLowerCase().includes(filterText.toLowerCase()) ||
          (c.shortName && c.shortName.toLowerCase().includes(filterText.toLowerCase()))
      )
    : categories;

  // Color theme helpers
  const getBadgeStyle = () => {
    switch (accentColor) {
      case 'emerald':
        return 'bg-emerald-500/20 text-white border-white/40 hover:bg-emerald-500/30';
      case 'amber':
        return 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 shadow-sm font-black';
      case 'purple':
        return 'bg-purple-100 text-purple-900 border-purple-200 hover:bg-purple-200';
      default:
        return 'bg-orange-500/20 text-white border-white/40 hover:bg-orange-500/30';
    }
  };

  const getAccentTheme = () => {
    switch (accentColor) {
      case 'emerald':
        return {
          selectedBg: 'bg-emerald-50/90 border-emerald-400',
          hoverText: 'group-hover:text-emerald-700',
          sampleText: 'text-emerald-700/90',
          badgeBg: 'bg-emerald-600',
          resetText: 'text-emerald-700 hover:text-emerald-800',
          iconColor: 'text-emerald-600',
          focusRing: 'focus:border-emerald-500',
        };
      case 'amber':
        return {
          selectedBg: 'bg-amber-50/90 border-amber-400',
          hoverText: 'group-hover:text-amber-800',
          sampleText: 'text-amber-750 font-medium',
          badgeBg: 'bg-amber-500 text-slate-950',
          resetText: 'text-amber-800 hover:text-amber-900',
          iconColor: 'text-amber-600',
          focusRing: 'focus:border-amber-500',
        };
      default:
        return {
          selectedBg: 'bg-orange-50/90 border-orange-400',
          hoverText: 'group-hover:text-orange-600',
          sampleText: 'text-orange-600/80',
          badgeBg: 'bg-orange-600',
          resetText: 'text-orange-600 hover:text-orange-700',
          iconColor: 'text-orange-600',
          focusRing: 'focus:border-orange-500',
        };
    }
  };

  const theme = getAccentTheme();
  const isDefaultAll = selectedCategory.id.endsWith('-all');

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* The Main "All Categories ▾" Button Near Search Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-11 sm:h-12 px-3 sm:px-4 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 border font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 select-none ${
          isDefaultAll
            ? 'bg-white/95 hover:bg-white text-slate-900 border-slate-200 shadow-sm'
            : getBadgeStyle()
        }`}
        title={`Click to view all ${categories.length} categories`}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-base shrink-0 leading-none">{selectedCategory.emoji}</span>
          <span className="truncate max-w-[125px] sm:max-w-[160px] font-black">
            {isDefaultAll ? `All Categories (${categories.length})` : selectedCategory.name}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Popup Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[320px] sm:w-[440px] max-w-[94vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900">
          {/* Header with Search and Stats */}
          <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Grid className={`w-3.5 h-3.5 ${theme.iconColor}`} />
                <span>All {labelPrefix} Options ({categories.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title="Close category menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick search inside categories */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search all categories (e.g. Biryani, Milk, Phones)..."
                className={`w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden ${theme.focusRing} transition-colors placeholder:text-slate-400 text-slate-900`}
                autoFocus
              />
            </div>
          </div>

          {/* Category List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 p-1.5">
            {filtered.map((cat) => {
              const isSelected =
                cat.id === selectedCategory.id ||
                isMatch(cat, selectedCategoryId);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat);
                    setIsOpen(false);
                    setFilterText('');
                  }}
                  className={`w-full p-2.5 rounded-xl text-left flex items-start justify-between gap-3 transition-colors cursor-pointer group ${
                    isSelected
                      ? theme.selectedBg
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      {cat.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold text-slate-900 ${theme.hoverText} transition-colors`}>
                          {cat.name}
                        </span>
                        {cat.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            {cat.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug line-clamp-1 mt-0.5">
                        {cat.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {cat.itemCount}
                        </span>
                        {cat.sampleItem && (
                          <span className={`text-[10px] font-medium truncate ${theme.sampleText}`}>
                            • e.g. {cat.sampleItem}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className={`w-5 h-5 rounded-full ${theme.badgeBg} text-white flex items-center justify-center shrink-0 mt-1 shadow-xs`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No category matches "{filterText}"
              </div>
            )}
          </div>

          {/* Footer with Reset */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
              Active: <strong>{selectedCategory.name}</strong>
            </span>
            {!isDefaultAll && (
              <button
                type="button"
                onClick={() => {
                  onSelectCategory(categories[0]);
                  setIsOpen(false);
                }}
                className={`text-xs font-bold ${theme.resetText} hover:underline cursor-pointer`}
              >
                Reset to All Categories
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
