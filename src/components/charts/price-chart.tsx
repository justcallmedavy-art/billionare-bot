"use client";

import { useEffect, useRef } from "react";
import {
  createChart, ColorType, CrosshairMode, type IChartApi, type ISeriesApi,
  type CandlestickData, type LineData, type Time, type IPriceLine,
} from "lightweight-charts";

export type ChartCandle = { time: number; open: number; high: number; low: number; close: number };

export type PriceChartProps = {
  candles: ChartCandle[];
  chartType?: "candles" | "area";
  digits?: number;
  livePrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  entries?: Array<{ price: number; side: "buy" | "sell" }>;
  expiryMarker?: { time: number; label: string } | null;
  onLastBarUpdate?: (c: ChartCandle) => void;
};

export function PriceChart({
  candles, chartType = "candles", digits = 5,
  livePrice, sl, tp, entries = [],
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#5a6a8c",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(227,232,240,.9)" },
        horzLines: { color: "rgba(227,232,240,.9)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#e3e8f0" },
      timeScale: { borderColor: "#e3e8f0", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // (Re)create series when type changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }
    if (chartType === "candles") {
      seriesRef.current = chart.addCandlestickSeries({
        upColor: "#12a150", downColor: "#e11d2e",
        borderUpColor: "#12a150", borderDownColor: "#e11d2e",
        wickUpColor: "rgba(18,161,80,.85)", wickDownColor: "rgba(225,29,46,.85)",
      });
    } else {
      seriesRef.current = chart.addAreaSeries({
        lineColor: "#2563eb", topColor: "rgba(37,99,235,.18)", bottomColor: "rgba(37,99,235,0)",
        lineWidth: 2,
      });
    }
    // Force data re-render on series change
    setPriceLinesRef.current?.();
  }, [chartType]);

  // Data updates
  const hadDataRef = useRef(false);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (chartType === "candles") {
      (series as ISeriesApi<"Candlestick">).setData(
        candles.map((c) => ({
          time: c.time as Time,
          open: c.open, high: c.high, low: c.low, close: c.close,
        })) as CandlestickData<Time>[],
      );
    } else {
      (series as ISeriesApi<"Area">).setData(
        candles.map((c) => ({ time: c.time as Time, value: c.close })) as LineData<Time>[],
      );
    }
    // Fit the view when the first batch of history arrives (or history resets
    // on symbol switch) so short histories fill the viewport nicely.
    if (candles.length === 0) {
      hadDataRef.current = false;
    } else if (!hadDataRef.current) {
      hadDataRef.current = true;
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles, chartType]);

  // Price lines (current, SL, TP, entries)
  const setPriceLinesRef = useRef<(() => void) | null>(null);
  setPriceLinesRef.current = () => {
    const series = seriesRef.current;
    if (!series) return;
    for (const l of priceLinesRef.current) {
      try { series.removePriceLine(l); } catch { /* noop */ }
    }
    priceLinesRef.current = [];
    const mk = (price: number, color: string, title: string, dashed = true) => {
      try {
        priceLinesRef.current.push(
          series.createPriceLine({
            price, color, title,
            lineStyle: dashed ? 2 /* dashed */ : 0,
            lineWidth: 1, axisLabelVisible: true,
          }),
        );
      } catch { /* noop */ }
    };
    if (livePrice) mk(livePrice, "#2563eb", "LIVE");
    if (sl) mk(sl, "#e11d2e", "SL");
    if (tp) mk(tp, "#12a150", "TP");
    for (const e of entries) mk(e.price, "#8b97b0", e.side === "buy" ? "BUY" : "SELL", false);
  };

  useEffect(() => { setPriceLinesRef.current?.(); }, [livePrice, sl, tp, entries]);

  return <div ref={containerRef} className="w-full h-full min-h-[280px]" />;
}
