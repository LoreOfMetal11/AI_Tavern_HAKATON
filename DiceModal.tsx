import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { CheckRequest, Character, StatName } from './dnd';
import { rollDie, formatModifier, getModifier, playSoundEffect, DND_SKILLS } from './rules';

interface DiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCheck?: CheckRequest | null;
  activeCharacter: Character;
  onApplyResult: (resultText: string, checkData?: CheckRequest) => void;
}

export const DiceModal: React.FC<DiceModalProps> = ({
  isOpen,
  onClose,
  activeCheck,
  activeCharacter,
  onApplyResult,
}) => {
  const [dieSides, setDieSides] = useState<number>(20);
  const [dieCount, setDieCount] = useState<number>(1);
  const [selectedStat, setSelectedStat] = useState<StatName>('DEX');
  const [useProficiency, setUseProficiency] = useState<boolean>(false);
  const [rollMode, setRollMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [dcTarget, setDcTarget] = useState<number | null>(null);

  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [rollResult, setRollResult] = useState<{
    rolls: number[];
    chosenNatural: number;
    modifier: number;
    total: number;
    isCritSuccess: boolean;
    isCritFail: boolean;
  } | null>(null);

  // Initialize from active check if present
  useEffect(() => {
    if (activeCheck) {
      setDieSides(20);
      setDieCount(1);
      setSelectedStat(activeCheck.stat);
      setDcTarget(activeCheck.dc);

      // Check if character is proficient in this skill
      if (activeCheck.skillName) {
        const found = DND_SKILLS.find(
          (s) => s.nameRu.toLowerCase() === activeCheck.skillName?.toLowerCase()
        );
        if (found && activeCharacter.skills[found.key]) {
          setUseProficiency(true);
        } else {
          setUseProficiency(false);
        }
      } else {
        setUseProficiency(false);
      }
    } else {
      setDcTarget(null);
    }
  }, [activeCheck, activeCharacter]);

  if (!isOpen) return null;

  const currentStatModifier = getModifier(activeCharacter.stats[selectedStat]);
  const totalModifier = currentStatModifier + (useProficiency ? activeCharacter.profBonus : 0);

  const handleRoll = () => {
    setIsRolling(true);
    playSoundEffect('dice');

    // Quick rolling jitter effect
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count >= 5) {
        clearInterval(interval);

        let rolls: number[] = [];
        let chosenNatural = 0;

        if (dieSides === 20 && rollMode !== 'normal') {
          const r1 = rollDie(20);
          const r2 = rollDie(20);
          rolls = [r1, r2];
          chosenNatural = rollMode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
        } else {
          for (let i = 0; i < dieCount; i++) {
            rolls.push(rollDie(dieSides));
          }
          chosenNatural = rolls.reduce((a, b) => a + b, 0);
        }

        const total = chosenNatural + totalModifier;
        const isCritSuccess = dieSides === 20 && chosenNatural === 20;
        const isCritFail = dieSides === 20 && chosenNatural === 1;

        if (isCritSuccess) playSoundEffect('crit');
        else if (isCritFail) playSoundEffect('fail');

        setRollResult({
          rolls,
          chosenNatural,
          modifier: totalModifier,
          total,
          isCritSuccess,
          isCritFail,
        });
        setIsRolling(false);
      }
    }, 60);
  };

  const handleSendToChat = () => {
    if (!rollResult) return;

    let outcomeText = '';
    let passed = false;

    if (dcTarget !== null) {
      if (rollResult.isCritSuccess) {
        passed = true;
        outcomeText = 'КРИТИЧЕСКИЙ УСПЕХ (Натуральная 20!)';
      } else if (rollResult.isCritFail) {
        passed = false;
        outcomeText = 'КРИТИЧЕСКИЙ ПРОВАЛ (Натуральная 1!)';
      } else {
        passed = rollResult.total >= dcTarget;
        outcomeText = passed ? `УСПЕХ (Итог ${rollResult.total} >= DC ${dcTarget})` : `ПРОВАЛ (Итог ${rollResult.total} < DC ${dcTarget})`;
      }
    }

    const checkTitle = activeCheck?.description || `Бросок ${dieCount}d${dieSides}${totalModifier !== 0 ? formatModifier(totalModifier) : ''}`;
    const formattedResult = `[БРОСОК КУБИКА: ${activeCharacter.name} | ${checkTitle}]\n` +
      `Выпало: ${rollResult.rolls.join(', ')} (Итог кости: ${rollResult.chosenNatural}) + Модификатор (${formatModifier(totalModifier)}) = ${rollResult.total}` +
      (outcomeText ? ` -> ${outcomeText}` : '');

    const checkData: CheckRequest | undefined = activeCheck
      ? {
          ...activeCheck,
          rollResult: rollResult.chosenNatural,
          modifierApplied: totalModifier,
          totalScore: rollResult.total,
          passed,
        }
      : undefined;

    onApplyResult(formattedResult, checkData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-xl shadow-2xl p-6 text-stone-100 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div>
            <h2 className="text-lg font-bold font-fantasy text-amber-200 tracking-wide">
              {activeCheck ? 'Проверка от Мастера (D&D 5e)' : 'Бросок костей судьбы'}
            </h2>
            <p className="text-xs text-stone-400">
              Персонаж: <span className="text-amber-300 font-medium">{activeCharacter.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active check banner if triggered by AI */}
        {activeCheck && (
          <div className="p-3 bg-amber-950/40 border border-amber-600/30 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between text-amber-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Требуется проверка: {activeCheck.stat} {activeCheck.skillName ? `(${activeCheck.skillName})` : ''}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700/50 font-mono">
                Сложность DC: {activeCheck.dc}
              </span>
            </div>
            <p className="text-stone-300 text-[11px]">{activeCheck.description}</p>
          </div>
        )}

        {/* Die Selection & Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Тип кости:</span>
            <div className="flex items-center gap-1">
              {[4, 6, 8, 10, 12, 20, 100].map((sides) => (
                <button
                  key={sides}
                  onClick={() => {
                    setDieSides(sides);
                    setRollResult(null);
                  }}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                    dieSides === sides
                      ? 'bg-amber-600 text-stone-900 font-bold'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  d{sides}
                </button>
              ))}
            </div>
          </div>

          {dieSides === 20 && (
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Режим броска:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRollMode('normal')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    rollMode === 'normal'
                      ? 'bg-stone-700 text-stone-100 font-medium'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                  }`}
                >
                  Обычный
                </button>
                <button
                  onClick={() => setRollMode('advantage')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    rollMode === 'advantage'
                      ? 'bg-emerald-800 text-emerald-100 font-medium'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                  }`}
                >
                  Преимущество
                </button>
                <button
                  onClick={() => setRollMode('disadvantage')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    rollMode === 'disadvantage'
                      ? 'bg-rose-900 text-rose-100 font-medium'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                  }`}
                >
                  Помеха
                </button>
              </div>
            </div>
          )}

          {/* Stat & Modifier selector */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-stone-950/60 rounded-lg border border-stone-800/80 text-xs">
            <div>
              <label className="text-stone-400 block mb-1">Характеристика:</label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value as StatName)}
                className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200"
              >
                {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as StatName[]).map((st) => (
                  <option key={st} value={st}>
                    {st} ({activeCharacter.stats[st]} → {formatModifier(getModifier(activeCharacter.stats[st]))})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-stone-300">
                <input
                  type="checkbox"
                  checked={useProficiency}
                  onChange={(e) => setUseProficiency(e.target.checked)}
                  className="rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-0"
                />
                <span>Владение (+{activeCharacter.profBonus})</span>
              </label>
              <div className="text-[11px] text-stone-400 mt-1">
                Итоговый бонус: <span className="font-mono text-amber-300">{formatModifier(totalModifier)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Result Stage */}
        <div className="py-4 px-6 bg-stone-950 rounded-xl border border-stone-800 flex flex-col items-center justify-center min-h-[130px] relative overflow-hidden">
          {isRolling ? (
            <div className="flex flex-col items-center gap-2 text-amber-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-xs font-mono tracking-wider animate-pulse">Бросаем кости...</span>
            </div>
          ) : rollResult ? (
            <div className="flex flex-col items-center text-center space-y-1">
              <div className="flex items-baseline gap-3">
                <span className={`text-4xl font-extrabold font-mono tabular-nums ${
                  rollResult.isCritSuccess
                    ? 'text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : rollResult.isCritFail
                    ? 'text-rose-500'
                    : 'text-stone-100'
                }`}>
                  {rollResult.total}
                </span>

                <span className="text-xs text-stone-400 font-mono">
                  ({rollResult.chosenNatural} + {formatModifier(rollResult.modifier)})
                </span>
              </div>

              {rollResult.rolls.length > 1 && (
                <div className="text-xs text-stone-400 font-mono">
                  Броски: [{rollResult.rolls.join(', ')}]
                </div>
              )}

              {rollResult.isCritSuccess && (
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> КРИТИЧЕСКИЙ УСПЕХ!
                </span>
              )}

              {rollResult.isCritFail && (
                <span className="text-xs font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> КРИТИЧЕСКИЙ ПРОВАЛ!
                </span>
              )}

              {dcTarget !== null && !rollResult.isCritSuccess && !rollResult.isCritFail && (
                <div className="text-xs font-medium pt-1">
                  {rollResult.total >= dcTarget ? (
                    <span className="text-emerald-400 flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Проверка пройдена (DC {dcTarget})
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Проверка провалена (DC {dcTarget})
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-stone-400">Нажмите кнопку ниже для броска d{dieSides}</span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleRoll}
            disabled={isRolling}
            className="flex-1 py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-stone-900 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-lg transition-colors shadow-md disabled:opacity-50"
          >
            {rollResult ? 'Перебросить' : 'Бросить кость'}
          </button>

          {rollResult && (
            <button
              onClick={handleSendToChat}
              className="py-2.5 px-4 text-xs font-semibold text-stone-100 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors border border-stone-700 whitespace-nowrap"
            >
              Передать Мастеру
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
