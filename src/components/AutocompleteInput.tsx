import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Sparkles,
  Plane,
  X,
  ChevronDown,
  Building2,
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Calendar,
  Crosshair,
} from 'lucide-react';
import {
  AutocompleteSuggestion,
  getFilteredSuggestions,
} from '../data/autocompleteData';
import { useApp } from '../context/AppContext';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string, suggestion?: AutocompleteSuggestion) => void;
  placeholder?: string;
  type?: 'city' | 'product' | 'grocery' | 'food' | 'date' | 'location' | 'all';
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
  presetList?: string[]; // for category or date presets
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  dropdownAlign?: 'left' | 'right' | 'full';
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Search...',
  type = 'all',
  className = '',
  inputClassName = '',
  icon,
  presetList,
  onKeyDown,
  dropdownAlign = 'left',
}) => {
  const { userLocation, detectGpsLocation, isGpsLocating } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive suggestions
  const suggestions: AutocompleteSuggestion[] = React.useMemo(() => {
    if (presetList && presetList.length > 0) {
      const q = value.toLowerCase().trim();
      const filtered = q
        ? presetList.filter((item) => item.toLowerCase().includes(q))
        : presetList;
      return filtered.slice(0, 8).map((item) => ({
        text: item,
        type: 'category' as const,
        badge: 'Category',
      }));
    }
    return getFilteredSuggestions(value, type, 14);
  }, [value, type, presetList]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggText: string, suggObj?: AutocompleteSuggestion) => {
    onChange(suggText);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (onSelect) {
      onSelect(suggText, suggObj);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(
          suggestions[highlightedIndex].text,
          suggestions[highlightedIndex]
        );
      } else if (isOpen) {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const renderIcon = (sugg: AutocompleteSuggestion) => {
    if (sugg.type === 'city') return <Plane className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    if (sugg.type === 'grocery') return <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    if (sugg.type === 'food') return <Utensils className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
    if (sugg.type === 'date') return <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
    if (sugg.type === 'location') return <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    if (sugg.type === 'category') return <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
    return <ShoppingBag className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            {icon}
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          className={`w-full bg-transparent focus:outline-hidden font-bold text-slate-900 transition-colors ${
            icon ? 'pl-8' : ''
          } ${value ? 'pr-7' : ''} ${inputClassName}`}
        />

        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Clear text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Autocomplete Floating Dropdown Menu */}
      {isOpen && suggestions.length > 0 && (
        <div
          className={`absolute z-50 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150 ${
            dropdownAlign === 'right'
              ? 'right-0 w-80 sm:w-96'
              : dropdownAlign === 'full'
              ? 'left-0 right-0 w-full'
              : 'left-0 w-80 sm:w-96'
          }`}
          style={{ maxHeight: '340px', overflowY: 'auto' }}
        >
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold tracking-wide uppercase">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-orange-500" />
              <span>Instant Autocomplete Suggestions</span>
            </span>
            <span className="font-mono text-[9px] text-slate-400">↑↓ to navigate · ↵ select</span>
          </div>

          {/* 1-Tap Live GPS Auto-Detection Option for Cities & Locations */}
          {(type === 'city' || type === 'location') && (
            <button
              type="button"
              onMouseDown={async (e) => {
                e.preventDefault();
                await detectGpsLocation();
                const detectedText =
                  type === 'city'
                    ? userLocation.city
                    : `${userLocation.locality} (${userLocation.pincode})`;
                if (detectedText) {
                  handleSelect(detectedText);
                }
              }}
              className="w-full px-3.5 py-2.5 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 text-left flex items-center justify-between border-b border-emerald-100 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Crosshair className={`w-3.5 h-3.5 ${isGpsLocating ? 'animate-spin' : ''}`} />
                </div>
                <div className="min-w-0 truncate">
                  <div className="text-xs font-black text-emerald-950 truncate flex items-center gap-1.5">
                    <span>Use Exact Current Location (GPS)</span>
                    <span className="text-[9px] font-bold bg-emerald-200 text-emerald-900 px-1 rounded-sm uppercase tracking-wide">
                      Live
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-700 truncate font-medium">
                    {userLocation.address || 'Auto-detect exact Indian city & doorstep pincode'}
                  </div>
                </div>
              </div>

              <span className="shrink-0 text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md border border-emerald-300">
                Auto-Fill
              </span>
            </button>
          )}

          <div className="py-1">
            {suggestions.map((sugg, idx) => {
              const isSelected = highlightedIndex === idx;
              return (
                <button
                  key={`${sugg.text}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(sugg.text, sugg);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-start justify-between gap-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-orange-50/80 text-orange-950'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5">{renderIcon(sugg)}</div>
                    <div className="min-w-0 truncate">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {sugg.text}
                      </div>
                      {sugg.subtext && (
                        <div className="text-[10px] text-slate-500 truncate leading-snug">
                          {sugg.subtext}
                        </div>
                      )}
                    </div>
                  </div>

                  {sugg.badge && (
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        isSelected
                          ? 'bg-orange-100 text-orange-700 border-orange-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {sugg.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
