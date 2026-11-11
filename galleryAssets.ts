import { DmMood } from './dnd';

export interface GalleryAsset {
  id: string;
  category: 'character' | 'cover' | 'item' | 'location';
  title: string;
  description: string;
  url: string;
}

export const GALLERY_ASSETS: GalleryAsset[] = [
  // Character portraits
  {
    id: 'art-char-elf',
    category: 'character',
    title: 'Лесной следопыт (Эльф)',
    description: 'Ловкий разведчик в зеленом капюшоне с композитным луком',
    url: new URL('./hero_elf_ranger_1793967564845.jpg', import.meta.url).href,
  },
  {
    id: 'art-char-dwarf',
    category: 'character',
    title: 'Паладин наковальни (Дворф)',
    description: 'Закаленный рыцарь в рунных латах с боевым молотом',
    url: new URL('./hero_dwarf_paladin_1793967564468.jpg', import.meta.url).href,
  },
  {
    id: 'art-char-mage',
    category: 'character',
    title: 'Чародейка арканных тайн',
    description: 'Магичка в расшитой звездами бархатной мантии с фиолетовыми рунами',
    url: new URL('./avatar_mage_sorceress_1793979257712.jpg', import.meta.url).href,
  },
  {
    id: 'art-char-rogue',
    category: 'character',
    title: 'Теневой плут / Ассасин',
    description: 'Опасный вор в кожаном капюшоне с парными кинжалами',
    url: new URL('./avatar_rogue_assassin_1793979260604.jpg', import.meta.url).href,
  },
  {
    id: 'art-char-dm',
    category: 'character',
    title: 'Мастер Подземелий (Dungeon Master)',
    description: 'Загадочный сказитель со звездным капюшоном и золотым d20',
    url: new URL('./avatar_dm_master_mystic_1793979259583.jpg', import.meta.url).href,
  },

  // Covers / Locations
  {
    id: 'art-cover-citadel',
    category: 'cover',
    title: 'Цитадель Штормов',
    description: 'Величественные гранитные врата замка с факелами и горным туманом',
    url: new URL('./dnd_campaign_cover_1793967562693.jpg', import.meta.url).href,
  },
  {
    id: 'art-cover-tavern',
    category: 'cover',
    title: 'Таверна «Пьяный Дракон»',
    description: 'Уютный средневековый трактир с камином, картами и кружками эля',
    url: new URL('./dnd_tavern_interior_1793967564891.jpg', import.meta.url).href,
  },
  {
    id: 'art-cover-crypt',
    category: 'cover',
    title: 'Гробница Короля-Лича',
    description: 'Зловещие катакомбы с каменными саркофагами и изумрудным пламенем',
    url: new URL('./dnd_crypt_dungeon_cover_1793979259913.jpg', import.meta.url).href,
  },
  {
    id: 'art-cover-feywild',
    category: 'cover',
    title: 'Шепчущий Лес Фей (Feywild)',
    description: 'Волшебный сумеречный лес со светящимися грибами и древними рунами',
    url: new URL('./dnd_feywild_forest_cover_1793979260394.jpg', import.meta.url).href,
  },
];

export const DM_MOOD_CONFIG: Record<
  DmMood,
  {
    title: string;
    description: string;
    glowClass: string;
    borderColor: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  neutral: {
    title: 'Загадочный Сказитель',
    description: 'Атмосферное классическое повествование мастера',
    glowClass: 'shadow-[0_0_15px_rgba(245,158,11,0.25)]',
    borderColor: 'border-amber-600/50',
    badgeBg: 'bg-amber-950/80',
    badgeText: 'text-amber-300',
  },
  combat: {
    title: 'Ярость Битвы',
    description: 'Напряженный бой, звон клинков и смертельная схватка',
    glowClass: 'shadow-[0_0_20px_rgba(225,29,72,0.4)]',
    borderColor: 'border-rose-600/70',
    badgeBg: 'bg-rose-950/80',
    badgeText: 'text-rose-300',
  },
  mystery: {
    title: 'Шепот Древних Тайн',
    description: 'Магия, странные знаки, скрытые проходы и арканные загадки',
    glowClass: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
    borderColor: 'border-purple-600/70',
    badgeBg: 'bg-purple-950/80',
    badgeText: 'text-purple-300',
  },
  triumph: {
    title: 'Великий Триумф',
    description: 'Победа, сокровища, преодоление невозможного',
    glowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/70',
    badgeBg: 'bg-emerald-950/80',
    badgeText: 'text-emerald-300',
  },
  peril: {
    title: 'Смертельная Угроза',
    description: 'Катастрофическая опасность, ловушки и нависшая тьма',
    glowClass: 'shadow-[0_0_20px_rgba(234,88,12,0.4)]',
    borderColor: 'border-orange-600/70',
    badgeBg: 'bg-orange-950/80',
    badgeText: 'text-orange-300',
  },
};
