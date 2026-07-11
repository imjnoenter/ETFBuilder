import { useState, useCallback, useMemo } from 'react';
import { useTheme } from '../../lib/useThemeTokens';
import { AnimatePresence, motion } from 'motion/react';
import { useBuilderStore } from '../../store/builderStore';
import { Button } from '../ui/Button';
import { AllocationDonut, SLICE_COLORS, SLICE_COLORS_DARK } from './AllocationDonut';
import { AllocationModeToggle, type AllocationMode } from './AllocationModeToggle';
import { PositionRow } from './PositionRow';
import { EmptyState } from './EmptyState';
import styles from './PortfolioPanel.module.css';

export function PortfolioPanel() {
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('etf');
  const [showSaved, setShowSaved] = useState(false);
  const theme = useTheme();
  const sliceColors = theme === 'dark' ? SLICE_COLORS_DARK : SLICE_COLORS;

  const positions = useBuilderStore((s) => s.positions);
  const portfolioName = useBuilderStore((s) => s.portfolioName);
  const savedPortfolios = useBuilderStore((s) => s.savedPortfolios);
  const setPortfolioName = useBuilderStore((s) => s.setPortfolioName);
  const setWeight = useBuilderStore((s) => s.setWeight);
  const removePosition = useBuilderStore((s) => s.removePosition);
  const equalizeWeights = useBuilderStore((s) => s.equalizeWeights);
  const balanceTo100 = useBuilderStore((s) => s.balanceTo100);
  const reset = useBuilderStore((s) => s.reset);
  const savePortfolio = useBuilderStore((s) => s.savePortfolio);
  const loadPortfolio = useBuilderStore((s) => s.loadPortfolio);
  const deletePortfolio = useBuilderStore((s) => s.deletePortfolio);
  const etfCache = useBuilderStore((s) => s.etfCache);
  const getAllocatedPct = useBuilderStore((s) => s.getAllocatedPct);
  const getRemainingPct = useBuilderStore((s) => s.getRemainingPct);
  const getAssetClassMix = useBuilderStore((s) => s.getAssetClassMix);
  void etfCache;
  const allocatedPct = getAllocatedPct();
  const remainingPct = getRemainingPct();
  const assetClassMix = getAssetClassMix();

  const othersTotal = useCallback(
    (ticker: string) => {
      const total = positions.reduce((s, p) => s + (p.ticker === ticker ? 0 : p.weight), 0);
      return Math.round(total * 100) / 100;
    },
    [positions]
  );

  const handleWeightChange = useCallback(
    (ticker: string, weight: number) => setWeight(ticker, weight),
    [setWeight]
  );

  const handleRemove = useCallback(
    (ticker: string) => removePosition(ticker),
    [removePosition]
  );

  const donutSlices = useMemo(() => {
    if (allocationMode === 'etf') {
      return positions.map((p, i) => ({
        label: p.ticker,
        value: p.weight,
        color: sliceColors[i % sliceColors.length],
      }));
    }
    return assetClassMix.map((m, i) => ({
      label: m.assetClass,
      value: m.weight,
      color: sliceColors[i % sliceColors.length],
    }));
  }, [positions, assetClassMix, allocationMode, sliceColors]);

  if (positions.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Portfolio</h2>
          {savedPortfolios.length > 0 && (
            <Button variant="ghost" size="small" onClick={() => setShowSaved(!showSaved)}>
              Load saved
            </Button>
          )}
        </div>
        {showSaved && (
          <div className={styles.savedList}>
            {savedPortfolios.map((p, i) => (
              <div key={p.name} className={styles.savedRow}>
                <span className={styles.savedName}>{p.name}</span>
                <span className={styles.savedInfo}>{p.positions.length} ETFs</span>
                <Button size="small" onClick={() => { loadPortfolio(i); setShowSaved(false); }}>
                  Load
                </Button>
              </div>
            ))}
          </div>
        )}
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Portfolio name + save/load */}
      <div className={styles.headerRow}>
        <input
          className={styles.nameInput}
          type="text"
          value={portfolioName}
          onChange={(e) => setPortfolioName(e.target.value)}
          aria-label="Portfolio name"
        />
        <div className={styles.headerActions}>
          <Button variant="ghost" size="small" onClick={savePortfolio}>
            Save
          </Button>
          {savedPortfolios.length > 0 && (
            <Button variant="ghost" size="small" onClick={() => setShowSaved(!showSaved)}>
              {showSaved ? 'Close' : 'Load'}
            </Button>
          )}
        </div>
      </div>

      {/* Saved portfolios dropdown */}
      {showSaved && savedPortfolios.length > 0 && (
        <div className={styles.savedList}>
          {savedPortfolios.map((p, i) => (
            <div key={p.name} className={styles.savedRow}>
              <span className={styles.savedName}>{p.name}</span>
              <span className={styles.savedInfo}>{p.positions.length} ETFs</span>
              <Button size="small" onClick={() => { loadPortfolio(i); setShowSaved(false); }}>
                Load
              </Button>
              <button
                className={styles.deleteBtn}
                onClick={() => deletePortfolio(i)}
                aria-label={`Delete ${p.name}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Allocation summary */}
      <div className={styles.allocationRow}>
        <span className={styles.allocation}>
          <span className={styles.allocatedValue}>
            {allocatedPct.toFixed(1)}% allocated
          </span>
          {allocatedPct >= 100 ? (
            <> &mdash; <span className={styles.fullyBuilt}>fully built</span></>
          ) : (
            <> &middot; {remainingPct.toFixed(1)}% to go</>
          )}
        </span>
      </div>

      {/* Donut + mode toggle */}
      <div className={styles.donutSection}>
        <AllocationModeToggle mode={allocationMode} onChange={setAllocationMode} />
        <AllocationDonut
          slices={donutSlices}
          unallocatedPct={remainingPct}
        />
      </div>

      {/* Position list */}
      <div className={styles.positionsList}>
        <AnimatePresence initial={false}>
          {positions.map((p, i) => (
            <motion.div
              key={p.ticker}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{
                type: 'tween',
                ease: [0.16, 1, 0.3, 1],
                duration: 0.3,
                delay: i * 0.04,
              }}
              layout
            >
              <PositionRow
                ticker={p.ticker}
                weight={p.weight}
                maxWeight={Math.round((100 - othersTotal(p.ticker)) * 100) / 100}
                onWeightChange={handleWeightChange}
                onRemove={handleRemove}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Weight actions */}
      <div className={styles.actions}>
        <Button variant="ghost" size="small" onClick={equalizeWeights}>
          Equal weight
        </Button>
        <Button variant="ghost" size="small" onClick={balanceTo100}>
          Balance to 100%
        </Button>
        <Button variant="ghost" size="small" onClick={reset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
