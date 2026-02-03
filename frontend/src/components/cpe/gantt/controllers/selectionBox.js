export const getSelectionBoxIds = ({ itemsWithTiming, pxFactor, rowH, box }) => {
    if (!box) return [];
    const boxRight = box.x + box.width;
    const boxBottom = box.y + box.height;

    const selected = [];
    itemsWithTiming.forEach((item, index) => {
        const leftPx = item.startDay * pxFactor;
        const widthPx = Math.max(item.durationDays * pxFactor, 20);
        const rightPx = leftPx + widthPx;
        const rowTop = index * rowH;
        const rowBottom = rowTop + rowH;

        const intersects = rightPx >= box.x && leftPx <= boxRight && rowBottom >= box.y && rowTop <= boxBottom;
        if (intersects) selected.push(item.id);
    });
    return selected;
};
