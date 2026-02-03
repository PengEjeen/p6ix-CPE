import { useEffect } from "react";

const SCALE_OPTIONS = [1, 5, 10, 30];

export const useAutoScale = ({
    hasUserScaled,
    totalDays,
    pixelsPerUnit,
    dateScale,
    chartRef,
    setDateScale
}) => {
    useEffect(() => {
        if (hasUserScaled) return;
        if (!chartRef?.current || totalDays <= 0) return;

        const containerWidth = chartRef.current.clientWidth;
        if (!containerWidth) return;

        const requiredScale = (totalDays * pixelsPerUnit) / containerWidth;
        const nextScale = SCALE_OPTIONS.find((s) => s >= requiredScale) || SCALE_OPTIONS[SCALE_OPTIONS.length - 1];

        if (nextScale !== dateScale) {
            setDateScale(nextScale);
        }
    }, [hasUserScaled, totalDays, pixelsPerUnit, dateScale, chartRef, setDateScale]);
};
