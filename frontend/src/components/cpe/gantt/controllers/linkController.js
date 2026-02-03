export const deriveLinkType = (fromAnchor, toAnchor) => {
    if (fromAnchor === "start" && toAnchor === "start") return "SS";
    if (fromAnchor === "end" && toAnchor === "end") return "FF";
    if (fromAnchor === "start" && toAnchor === "end") return "SF";
    return "FS";
};

export const buildLink = ({ fromId, fromAnchor, toId, toAnchor }) => ({
    id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from: fromId,
    to: toId,
    type: deriveLinkType(fromAnchor, toAnchor),
    lag: 0
});

export const isDuplicateLink = (links, link) => {
    if (!Array.isArray(links)) return false;
    return links.some(
        (existing) =>
            existing.from === link.from &&
            existing.to === link.to &&
            existing.type === link.type &&
            (parseFloat(existing.lag) || 0) === 0
    );
};
