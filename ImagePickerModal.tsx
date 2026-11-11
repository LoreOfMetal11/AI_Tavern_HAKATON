import React, { useState } from 'react';
import { X, Check, Image as ImageIcon, Link as LinkIcon, Sparkles } from 'lucide-react';
import { GALLERY_ASSETS, GalleryAsset } from './galleryAssets';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currentUrl?: string;
  onSelectImage: (url: string) => void;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  title,
  currentUrl,
  onSelectImage,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'character' | 'cover'>('all');
  const [customUrl, setCustomUrl] = useState('');

  if (!isOpen) return null;

  const filteredAssets = GALLERY_ASSETS.filter((asset) => {
    if (activeCategory === 'all') return true;
    return asset.category === activeCategory;
  });

  const handleApplyCustom = () => {
    if (!customUrl.trim()) return;
    onSelectImage(customUrl.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-fantasy text-amber-200">{title}</h2>
              <p className="text-xs text-stone-400">
                Выберите готовую иллюстрацию из галереи или укажите ссылку
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-stone-800 bg-stone-950/40 text-xs">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-amber-600 text-stone-950 font-bold'
                : 'text-stone-400 hover:text-stone-200 bg-stone-900'
            }`}
          >
            Все иллюстрации ({GALLERY_ASSETS.length})
          </button>
          <button
            onClick={() => setActiveCategory('character')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCategory === 'character'
                ? 'bg-amber-600 text-stone-950 font-bold'
                : 'text-stone-400 hover:text-stone-200 bg-stone-900'
            }`}
          >
            Портреты героев
          </button>
          <button
            onClick={() => setActiveCategory('cover')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCategory === 'cover'
                ? 'bg-amber-600 text-stone-950 font-bold'
                : 'text-stone-400 hover:text-stone-200 bg-stone-900'
            }`}
          >
            Обложки & Локации
          </button>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredAssets.map((asset) => {
              const isSelected = currentUrl === asset.url;

              return (
                <div
                  key={asset.id}
                  onClick={() => {
                    onSelectImage(asset.url);
                    onClose();
                  }}
                  className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-lg'
                      : 'border-stone-800 hover:border-amber-600/60'
                  }`}
                >
                  <div className="aspect-square bg-stone-950 relative overflow-hidden">
                    <img
                      src={asset.url}
                      alt={asset.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 rounded-full bg-amber-500 text-stone-950 shadow-md">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-stone-950/90 border-t border-stone-800 text-left">
                    <div className="font-bold text-xs text-amber-200 truncate">{asset.title}</div>
                    <div className="text-[10px] text-stone-400 line-clamp-1 mt-0.5">
                      {asset.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom URL Input */}
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <span className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Или укажите прямую ссылку на изображение:</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/my-fantasy-avatar.jpg"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCustom()}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-stone-900 border border-stone-700 text-stone-200 placeholder:text-stone-400 font-mono"
              />
              <button
                onClick={handleApplyCustom}
                disabled={!customUrl.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors disabled:opacity-40"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
