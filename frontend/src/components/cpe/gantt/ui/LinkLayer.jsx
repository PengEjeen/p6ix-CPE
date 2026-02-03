import React from "react";

export default function LinkLayer({
    links,
    selectedLinkId,
    itemIndexById,
    subtaskIndexById,
    getAnchorX,
    getSubtaskAnchorX,
    getAnchorY,
    buildLinkPath,
    deriveAnchorForType,
    pxFactor,
    rowH,
    itemCount,
    onLinkClick,
    linkDrag
}) {
    return (
        <svg
            className="absolute inset-0 z-20 pointer-events-none"
            style={{ width: "100%", height: itemCount * rowH }}
        >
            <defs>
                <marker id="arrowhead-link" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
                </marker>
            </defs>
            <style>{`
                .gantt-link-path {
                    stroke-dasharray: 6 4;
                    animation: gantt-link-dash 2.2s linear infinite;
                }
                @keyframes gantt-link-dash {
                    to { stroke-dashoffset: -20; }
                }
            `}</style>
            {Array.isArray(links) && links.map((link) => {
                const fromTask = itemIndexById.get(link.from);
                const toTask = itemIndexById.get(link.to);
                const fromSub = subtaskIndexById.get(link.from);
                const toSub = subtaskIndexById.get(link.to);
                if (!fromTask && !fromSub) return null;
                if (!toTask && !toSub) return null;

                const anchors = deriveAnchorForType(link.type);
                const lagValue = parseFloat(link.lag) || 0;

                const fromX = fromTask
                    ? getAnchorX(fromTask.item, anchors.from)
                    : getSubtaskAnchorX(fromSub.subtask, anchors.from);
                const toXBase = toTask
                    ? getAnchorX(toTask.item, anchors.to)
                    : getSubtaskAnchorX(toSub.subtask, anchors.to);
                const toX = toXBase + (lagValue * pxFactor);

                const fromY = getAnchorY((fromTask || fromSub).index);
                const toY = getAnchorY((toTask || toSub).index);
                const linkOffset = anchors.from === "start" ? -10 : 10;
                const path = buildLinkPath(fromX, fromY, toX, toY, anchors.from, linkOffset);
                const isSelected = link.id === selectedLinkId;
                return (
                    <g key={link.id}>
                        <path
                            d={path}
                            fill="none"
                            stroke={isSelected ? "#f59e0b" : "#94a3b8"}
                            strokeWidth={isSelected ? 2.6 : 2}
                            markerEnd="url(#arrowhead-link)"
                            className="opacity-90 gantt-link-path"
                            pointerEvents="none"
                        />
                        <path
                            d={path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="10"
                            pointerEvents="stroke"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onLinkClick) onLinkClick(link.id, e.clientX, e.clientY);
                            }}
                        />
                    </g>
                );
            })}
            {linkDrag && (
                <path
                    d={buildLinkPath(
                        linkDrag.fromX,
                        linkDrag.fromY,
                        linkDrag.x,
                        linkDrag.y,
                        linkDrag.fromAnchor,
                        linkDrag.fromAnchor === "start" ? -10 : 10
                    )}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    className="opacity-90"
                    pointerEvents="none"
                />
            )}
        </svg>
    );
}
