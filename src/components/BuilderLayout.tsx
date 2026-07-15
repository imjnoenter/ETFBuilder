import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { dataSource } from '../data';
import { useBuilderStore } from '../store/builderStore';
import { initTheme } from '../lib/useThemeTokens';
import { useHoldingsCount } from '../lib/useHoldingsCount';
import { ScreenerPanel } from './screener/ScreenerPanel';
import { PortfolioPanel } from './portfolio/PortfolioPanel';
import { BlendedPanel } from './portfolio/BlendedPanel';
import { ProfileDrawer } from './profile/ProfileDrawer';
import { ShareButton } from './share/ShareButton';
import { ShareDrawer } from './share/ShareDrawer';
import { ThemeToggle } from './ui/ThemeToggle';
import styles from './BuilderLayout.module.css';

const PerformanceChart = lazy(() => import('./performance/PerformanceChart'));
const HoldingsTable = lazy(() => import('./holdings/HoldingsTable'));
const TopHoldingsTable = lazy(() => import('./holdings/TopHoldingsTable'));

type MobileTab = 'screener' | 'portfolio';
type LeftView = 'screener' | 'holdings';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function BuilderLayout() {
  const [profileTicker, setProfileTicker] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('screener');
  const [leftView, setLeftView] = useState<LeftView>('screener');
  const [shareOpen, setShareOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => { initTheme(); }, []);

  const positions = useBuilderStore((s) => s.positions);

  useEffect(() => {
    async function rehydrate() {
      const { positions: pos, cacheEtf, cachePrices } = useBuilderStore.getState();
      for (const p of pos) {
        const etf = await dataSource.getEtf(p.ticker);
        if (etf) cacheEtf(p.ticker, etf);
        const prices = await dataSource.getPriceHistory(p.ticker);
        cachePrices(p.ticker, prices);
      }
      const { cachePrices: cp } = useBuilderStore.getState();
      const spyPrices = await dataSource.getPriceHistory('SPY');
      cp('SPY', spyPrices);
      const qqqPrices = await dataSource.getPriceHistory('QQQ');
      cp('QQQ', qqqPrices);
    }

    if (useBuilderStore.persist.hasHydrated()) {
      rehydrate();
    }
    return useBuilderStore.persist.onFinishHydration(() => rehydrate());
  }, []);

  useHoldingsCount();

  useEffect(() => {
    if (positions.length === 0 && leftView === 'holdings') {
      setLeftView('screener');
    }
  }, [positions.length, leftView]);

  // When a position is added on mobile, auto-switch to portfolio tab
  const handleEtfClick = useCallback((ticker: string) => {
    setProfileTicker(ticker);
  }, []);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.brand}>ETFbuilder</h1>
        <ShareButton disabled={positions.length === 0} onClick={() => setShareOpen(true)} />
        <ThemeToggle />
      </header>

      {/* Mobile tab bar */}
      {isMobile && (
        <div className={styles.tabBar} role="tablist" aria-label="View toggle">
          <button
            className={`${styles.tab} ${mobileTab === 'screener' ? styles.tabActive : ''}`}
            role="tab"
            aria-selected={mobileTab === 'screener'}
            onClick={() => setMobileTab('screener')}
          >
            Screener
          </button>
          <button
            className={`${styles.tab} ${mobileTab === 'portfolio' ? styles.tabActive : ''}`}
            role="tab"
            aria-selected={mobileTab === 'portfolio'}
            onClick={() => setMobileTab('portfolio')}
          >
            Portfolio
            {positions.length > 0 && (
              <span className={styles.tabBadge}>{positions.length}</span>
            )}
          </button>
        </div>
      )}

      <div className={styles.columns}>
        <div className={`${styles.leftCol} ${isMobile && mobileTab !== 'screener' ? styles.mobileHidden : ''}`}>
          {positions.length > 0 && (
            <div className={styles.viewToggle} role="tablist" aria-label="Left panel view">
              <button
                className={`${styles.viewTab} ${leftView === 'screener' ? styles.viewTabActive : ''}`}
                role="tab"
                aria-selected={leftView === 'screener'}
                onClick={() => setLeftView('screener')}
              >
                Screener
              </button>
              <button
                className={`${styles.viewTab} ${leftView === 'holdings' ? styles.viewTabActive : ''}`}
                role="tab"
                aria-selected={leftView === 'holdings'}
                onClick={() => setLeftView('holdings')}
              >
                Top Holdings
              </button>
            </div>
          )}
          {leftView === 'screener' ? (
            <ScreenerPanel onEtfClick={handleEtfClick} />
          ) : (
            <Suspense fallback={null}>
              <TopHoldingsTable embedded />
            </Suspense>
          )}
        </div>
        <div className={`${styles.rightCol} ${isMobile && mobileTab !== 'portfolio' ? styles.mobileHidden : ''}`}>
          <PortfolioPanel />
        </div>
      </div>

      <div className={styles.bottomRow}>
        <BlendedPanel />
        <Suspense fallback={<div className={styles.chartFallback}>Loading chart...</div>}>
          <PerformanceChart />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <HoldingsTable />
      </Suspense>

      <ProfileDrawer ticker={profileTicker} onClose={() => setProfileTicker(null)} />
      <ShareDrawer open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
