export const metadata = { title: "Risk Disclosure — Billinare Deal Option" };

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen bg-bg py-12 px-4">
      <div className="max-w-2xl mx-auto panel p-8 space-y-5 text-[13.5px] leading-relaxed text-dim border-t-4 border-t-redbar">
        <h1 className="text-xl font-extrabold text-ink">Risk Disclosure & Terms of Use</h1>
        <p>
          Billinare Deal Option is a demonstration trading platform. Unless a verified external
          broker or payment provider has been explicitly connected and disclosed, every balance,
          price, trade, and result you see is <strong className="text-ink">simulated for practice
          purposes</strong> and has no monetary value.
        </p>
        <h2 className="text-ink font-bold pt-2">Trading risk</h2>
        <p>
          Trading foreign exchange, contracts for difference, digital options, and other leveraged
          products carries a high level of risk and may not be suitable for all investors. The
          possibility exists that you could sustain a loss of some or all of your deposited funds.
          You should not trade with money you cannot afford to lose. Past performance — real or
          simulated — is not indicative of future results.
        </p>
        <h2 className="text-ink font-bold pt-2">No guarantees</h2>
        <p>
          Nothing on this platform constitutes financial advice or a recommendation to buy or sell
          any instrument. No statement, metric, backtest, or automated strategy implies guaranteed
          profit. Automated strategies ("bots") can lose money rapidly, and all risk limits exist
          because losses are expected to occur.
        </p>
        <h2 className="text-ink font-bold pt-2">Demo vs real</h2>
        <p>
          Demo trading uses a separate simulated ledger and a simulated price feed. Real-money
          trading remains disabled until a legitimate, licensed broker connection is configured;
          when enabled, real orders are routed only through that provider and identified with the
          provider's own order IDs and statuses.
        </p>
        <h2 className="text-ink font-bold pt-2">Jurisdictions</h2>
        <p>
          Access to real-money trading may be restricted in certain jurisdictions. It is your
          responsibility to ensure compliance with local law before enabling any live trading
          capability.
        </p>
      </div>
    </div>
  );
}
