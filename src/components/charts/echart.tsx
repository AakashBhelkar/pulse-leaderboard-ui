"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils/cn";

echarts.use([
  LineChart,
  BarChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  CanvasRenderer,
]);

export type EChartsInstance = echarts.ECharts;

interface EChartProps {
  option: EChartsOption;
  className?: string;
  style?: React.CSSProperties;
  /** Replaces the whole option tree — use when series count changes. */
  notMerge?: boolean;
  onGridClick?: (dataIndex: number) => void;
  /**
   * Series values, indexed [series][dataIndex]. When supplied, the tooltip is
   * driven manually and only appears while the pointer is within
   * `proximityPx` of a plotted value — hovering empty plot area shows nothing.
   * The chart's own `tooltip.triggerOn` must be `"none"` for this to take over.
   */
  proximitySeries?: (number | null)[][];
  proximityPx?: number;
  ariaLabel?: string;
}

/**
 * Thin React binding for ECharts. Kept in-house rather than pulling a wrapper
 * package so the instance lifecycle, resize behaviour, hit-testing and click
 * handling stay explicit and version-independent.
 */
export function EChart({
  option,
  className,
  style,
  notMerge = false,
  onGridClick,
  proximitySeries,
  proximityPx = 42,
  ariaLabel,
}: EChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);

  // Handlers and hit-test data live in refs so the chart instance is created
  // once and never torn down when the parent re-renders.
  const clickRef = useRef(onGridClick);
  const proxRef = useRef<{ series: (number | null)[][]; px: number } | null>(null);

  useEffect(() => {
    clickRef.current = onGridClick;
  }, [onGridClick]);

  useEffect(() => {
    proxRef.current = proximitySeries ? { series: proximitySeries, px: proximityPx } : null;
  }, [proximitySeries, proximityPx]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const zr = chart.getZr();

    const indexAt = (offsetX: number, offsetY: number): number | null => {
      const point = [offsetX, offsetY];
      if (!chart.containPixel({ gridIndex: 0 }, point)) return null;
      const [index] = chart.convertFromPixel({ seriesIndex: 0 }, point) as number[];
      return Number.isFinite(index) ? Math.round(index) : null;
    };

    const handleClick = (event: { offsetX: number; offsetY: number }) => {
      if (!clickRef.current) return;
      const index = indexAt(event.offsetX, event.offsetY);
      if (index !== null) clickRef.current(index);
    };

    const handleMove = (event: { offsetX: number; offsetY: number }) => {
      const prox = proxRef.current;
      if (!prox) return;

      const index = indexAt(event.offsetX, event.offsetY);
      if (index === null) {
        chart.dispatchAction({ type: "hideTip" });
        return;
      }

      // Vertical distance from the cursor to the closest plotted value at this
      // index. Beyond the threshold the cursor is over empty plot area.
      let nearest = Number.POSITIVE_INFINITY;
      for (const series of prox.series) {
        const value = series[index];
        if (value === null || value === undefined) continue;
        const pixel = chart.convertToPixel({ seriesIndex: 0 }, [index, value]) as
          | number[]
          | null;
        if (!pixel) continue;
        nearest = Math.min(nearest, Math.abs(pixel[1] - event.offsetY));
      }

      if (nearest <= prox.px) {
        chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
      } else {
        chart.dispatchAction({ type: "hideTip" });
      }
    };

    const handleOut = () => chart.dispatchAction({ type: "hideTip" });

    zr.on("click", handleClick);
    zr.on("mousemove", handleMove);
    zr.on("globalout", handleOut);

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      zr.off("click", handleClick);
      zr.off("mousemove", handleMove);
      zr.off("globalout", handleOut);
      chart.dispose();
      chartRef.current = null;
    };
    // Instance lifecycle only — option updates are handled below.
  }, []);

  useEffect(() => {
    // Rendered synchronously, and without entrance animation while the document
    // is hidden. Both animation and lazy updates depend on requestAnimationFrame,
    // which browsers throttle in background tabs — a chart restored in a
    // background tab, or captured for print, would otherwise stay blank.
    chartRef.current?.setOption(
      { ...option, animation: !document.hidden },
      { notMerge, lazyUpdate: false },
    );
  }, [option, notMerge]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={ariaLabel}
      className={cn("w-full", onGridClick && "cursor-pointer", className)}
      style={style}
    />
  );
}
