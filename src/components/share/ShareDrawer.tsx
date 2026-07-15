import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { domToPng, domToBlob } from 'modern-screenshot';
import { useBuilderStore } from '../../store/builderStore';
import type { RiskBand } from '../../data/types';
import { SLICE_COLORS_DARK } from '../portfolio/AllocationDonut';
import { blendedStockHoldings } from '../../lib/stockHoldings';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { ShareCard } from './ShareCard';
import styles from './ShareDrawer.module.css';

/** Cap on how long we'll wait for /api/holdings-count to settle before rendering with partial data. */
const HOLDINGS_WAIT_CAP_MS = 8000;

function slugify(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return slug ? `${slug}-plan.png` : 'my-portfolio-plan.png';
}

interface ShareDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ShareDrawer({ open, onClose }: ShareDrawerProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [waitElapsed, setWaitElapsed] = useState(false);
  const [busy, setBusy] = useState<'download' | 'copy' | 'share' | null>(null);

  const positions = useBuilderStore((s) => s.positions);
  const portfolioName = useBuilderStore((s) => s.portfolioName);
  const etfCache = useBuilderStore((s) => s.etfCache);
  const holdingsLoading = useBuilderStore((s) => s.holdingsLoading);
  const getBlendedExpenseRatio = useBuilderStore((s) => s.getBlendedExpenseRatio);
  const getBlendedDividendYield = useBuilderStore((s) => s.getBlendedDividendYield);
  const getBlended1YReturn = useBuilderStore((s) => s.getBlended1YReturn);
  const getBlendedRisk = useBuilderStore((s) => s.getBlendedRisk);
  const getRemainingPct = useBuilderStore((s) => s.getRemainingPct);

  // Wait cap: once elapsed, render with whatever holdings data resolved.
  useEffect(() => {
    if (!open) {
      setWaitElapsed(false);
      return;
    }
    const t = setTimeout(() => setWaitElapsed(true), HOLDINGS_WAIT_CAP_MS);
    return () => clearTimeout(t);
  }, [open]);

  const etfsHydrated = positions.every((p) => {
    const etf = etfCache.get(p.ticker);
    return etf != null && etf.hydrated !== false;
  });
  const ready = etfsHydrated && (!holdingsLoading || waitElapsed);

  const etfSlices = useMemo(
    () =>
      positions.map((p, i) => ({
        label: p.ticker,
        fullLabel: etfCache.get(p.ticker)?.name,
        value: p.weight,
        color: SLICE_COLORS_DARK[i % SLICE_COLORS_DARK.length],
      })),
    [positions, etfCache]
  );

  const stockHoldings = useMemo(
    () => blendedStockHoldings(positions, etfCache),
    [positions, etfCache]
  );

  const stockSlices = useMemo(
    () =>
      stockHoldings.map((h, i) => ({
        label: h.symbol || h.name,
        value: h.blended,
        color: SLICE_COLORS_DARK[i % SLICE_COLORS_DARK.length],
      })),
    [stockHoldings]
  );

  const stockRows = useMemo(
    () =>
      stockHoldings.map((h, i) => ({
        symbol: h.symbol,
        name: h.name,
        blended: h.blended,
        color: SLICE_COLORS_DARK[i % SLICE_COLORS_DARK.length],
      })),
    [stockHoldings]
  );

  const stockUnallocatedPct = Math.max(
    0,
    100 - stockSlices.reduce((sum, s) => sum + s.value, 0)
  );

  const filename = slugify(portfolioName);
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard && typeof ClipboardItem !== 'undefined';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setBusy('download');
    try {
      const dataUrl = await domToPng(cardRef.current, { scale: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } finally {
      setBusy(null);
    }
  }, [filename]);

  const handleCopy = useCallback(async () => {
    if (!cardRef.current) return;
    setBusy('copy');
    try {
      const blob = await domToBlob(cardRef.current, { scale: 2 });
      if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } finally {
      setBusy(null);
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setBusy('share');
    try {
      const blob = await domToBlob(cardRef.current, { scale: 2 });
      if (!blob) return;
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) return;
      await navigator.share({ files: [file], title: portfolioName });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('Share failed:', err);
      }
    } finally {
      setBusy(null);
    }
  }, [filename, portfolioName]);

  if (positions.length === 0) return null;

  return (
    <Drawer open={open} onClose={onClose} title="Share your plan">
      {!ready ? (
        <div className={styles.loading}>
          <div className={styles.loadingBar} />
          <p>Loading your plan...</p>
        </div>
      ) : (
        <>
          <ShareCard
            ref={cardRef}
            portfolioName={portfolioName}
            etfSlices={etfSlices}
            etfUnallocatedPct={getRemainingPct()}
            stockSlices={stockSlices}
            stockRows={stockRows}
            stockUnallocatedPct={stockUnallocatedPct}
            stockHoldingsAvailable={stockHoldings.length > 0}
            expenseRatio={getBlendedExpenseRatio()}
            dividendYield={getBlendedDividendYield()}
            risk={getBlendedRisk() as RiskBand | null}
            return1Y={getBlended1YReturn()}
          />
          <div className={styles.actions}>
            <Button onClick={handleDownload} disabled={busy != null}>
              {busy === 'download' ? 'Downloading...' : 'Download PNG'}
            </Button>
            {canCopy && (
              <Button variant="ghost" onClick={handleCopy} disabled={busy != null}>
                {busy === 'copy' ? 'Copying...' : 'Copy'}
              </Button>
            )}
            {canShare && (
              <Button variant="ghost" onClick={handleShare} disabled={busy != null}>
                {busy === 'share' ? 'Sharing...' : 'Share'}
              </Button>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
