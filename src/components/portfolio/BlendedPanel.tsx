import { useBuilderStore } from '../../store/builderStore';
import { percent, currency } from '../../lib/format';
import type { RiskBand } from '../../data/types';
import { Stat } from '../ui/Stat';
import { RiskMeter } from '../ui/RiskMeter';
import styles from './BlendedPanel.module.css';

export function BlendedPanel() {
  const positions = useBuilderStore((s) => s.positions);
  const portfolioValue = useBuilderStore((s) => s.portfolioValue);
  const taxRate = useBuilderStore((s) => s.taxRate);
  const setPortfolioValue = useBuilderStore((s) => s.setPortfolioValue);
  const setTaxRate = useBuilderStore((s) => s.setTaxRate);
  const etfCache = useBuilderStore((s) => s.etfCache);
  const priceCache = useBuilderStore((s) => s.priceCache);
  const getBlendedExpenseRatio = useBuilderStore((s) => s.getBlendedExpenseRatio);
  const getBlendedDividendYield = useBuilderStore((s) => s.getBlendedDividendYield);
  const getBlended1YReturn = useBuilderStore((s) => s.getBlended1YReturn);
  const getBlendedRisk = useBuilderStore((s) => s.getBlendedRisk);
  const getAssetClassMix = useBuilderStore((s) => s.getAssetClassMix);

  // etfCache/priceCache are subscribed above so this component re-renders
  // when caches populate after rehydration (the getter functions are stable
  // references that alone wouldn't trigger re-renders).
  void etfCache, priceCache;

  const hasPositions = positions.length > 0;
  const expenseRatio = hasPositions ? getBlendedExpenseRatio() : null;
  const dividendYield = hasPositions ? getBlendedDividendYield() : null;
  const return1Y = hasPositions ? getBlended1YReturn() : null;
  const risk = hasPositions ? getBlendedRisk() : null;
  const assetMix = hasPositions ? getAssetClassMix() : [];

  // return1Y is a total return (dividends reinvested), so price-only
  // appreciation must back the dividend yield out of it to avoid counting
  // the same dividend cash flow twice (once here, once as dividendIncome).
  const dividendIncome = dividendYield != null ? portfolioValue * dividendYield : null;
  const afterTaxDividend = dividendIncome != null ? dividendIncome * (1 - taxRate / 100) : null;
  const unrealizedGain = return1Y != null && dividendYield != null
    ? portfolioValue * (return1Y - dividendYield)
    : null;
  const totalReturn = afterTaxDividend != null && unrealizedGain != null
    ? afterTaxDividend + unrealizedGain
    : null;

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Blended Metrics</h3>

      {/* User inputs */}
      <div className={styles.inputs}>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Portfolio Value</span>
          <div className={styles.inputWrap}>
            <span className={styles.inputPrefix}>$</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="1000"
              value={portfolioValue}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v >= 0) setPortfolioValue(v);
              }}
              aria-label="Portfolio value in dollars"
            />
          </div>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Tax Rate</span>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              type="number"
              min="0"
              max="100"
              step="1"
              value={taxRate}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v >= 0 && v <= 100) setTaxRate(v);
              }}
              aria-label="Dividend tax rate"
            />
            <span className={styles.inputSuffix}>%</span>
          </div>
        </label>
      </div>

      {/* Percentage metrics */}
      <div className={styles.metrics}>
        <Stat
          label="Expense Ratio"
          value={percent(expenseRatio)}
          size="small"
        />
        <Stat
          label="Dividend Yield"
          value={percent(dividendYield)}
          size="small"
        />
        <div>
          <span className={styles.riskLabel}>Risk Band</span>
          {risk != null ? (
            <RiskMeter risk={risk as RiskBand} showLabel />
          ) : (
            <span className="num" style={{ fontSize: '0.875rem' }}>--</span>
          )}
        </div>
      </div>

      {/* Dollar metrics */}
      <div className={styles.dollarSection}>
        <span className={styles.sectionLabel}>Annual Estimates (1Y)</span>
        <div className={styles.metrics}>
          <Stat
            label="Dividend Income"
            value={dividendIncome != null ? currency(dividendIncome) : '--'}
            size="small"
          />
          <Stat
            label={`After-Tax Dividend (${taxRate}%)`}
            value={afterTaxDividend != null ? currency(afterTaxDividend) : '--'}
            size="small"
          />
          <Stat
            label="Unrealized Gain (1Y)"
            value={unrealizedGain != null ? currency(unrealizedGain) : '--'}
            size="small"
          />
          <Stat
            label="Total Return (1Y)"
            value={totalReturn != null ? currency(totalReturn) : '--'}
            size="small"
          />
        </div>
      </div>

      {/* Asset class mix bars */}
      <div className={styles.mixSection}>
        <span className={styles.sectionLabel}>Asset Class Mix</span>
        {assetMix.length === 0 ? (
          <p className={styles.emptyNote}>Add ETFs with known asset classes to see the mix.</p>
        ) : (
          <div className={styles.mixBars}>
            {assetMix.map((m) => (
              <div key={m.assetClass} className={styles.mixRow}>
                <span className={styles.mixName}>{m.assetClass}</span>
                <div className={styles.mixBar}>
                  <div
                    className={styles.mixFill}
                    style={{ transform: `scaleX(${Math.min(m.weight, 100) / 100})` }}
                  />
                </div>
                <span className={styles.mixValue}>{m.weight.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
