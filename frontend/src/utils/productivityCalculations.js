export const calculateCipRow = (row, standards = []) => {
    const depth = (
        Number(row.layer_depth_clay || 0) +
        Number(row.layer_depth_sand || 0) +
        Number(row.layer_depth_weathered || 0) +
        Number(row.layer_depth_soft_rock || 0) +
        Number(row.layer_depth_hard_rock || 0) +
        Number(row.layer_depth_mixed || 0)
    );

    let timeSum = 0;
    if (standards.length > 0) {
        const layers = ['clay', 'sand', 'weathered', 'soft_rock', 'hard_rock', 'mixed'];
        layers.forEach((l) => {
            const layerDepth = Number(row[`layer_depth_${l}`] || 0);
            let diameterSpec = row.diameter_selection;
            if (!diameterSpec && row.drill_diameter) {
                const d = row.drill_diameter;
                if (d < 500) diameterSpec = "500미만";
                else if (d >= 500 && d < 600) diameterSpec = "500~600";
                else diameterSpec = "500이상";
            }

            let bitType = row[`bit_type_${l}`];
            if (!bitType && diameterSpec) {
                const validBits = standards.filter((s) =>
                    s.diameter_spec.trim() === diameterSpec.trim() &&
                    s[`value_${l}`] !== null
                );
                if (validBits.length === 1) {
                    bitType = validBits[0].bit_type;
                } else if (validBits.length > 0) {
                    const auger = validBits.find((s) => s.bit_type === "AUGER");
                    bitType = auger ? "AUGER" : validBits[0].bit_type;
                }
            }

            if (layerDepth > 0 && bitType && diameterSpec) {
                const std = standards.find((s) =>
                    s.diameter_spec.trim() === diameterSpec.trim() &&
                    s.bit_type === bitType
                );
                const unitTime = std ? std[`value_${l}`] : null;
                if (unitTime !== null && unitTime !== undefined) {
                    timeSum += layerDepth * unitTime;
                }
            }
        });
    }

    const finalT2 = standards.length > 0 ? parseFloat(timeSum.toFixed(2)) : Number(row.t2 || 0);
    const t1 = Number(row.t1 || 0);
    const t3 = Number(row.t3 || 0);

    let concreteLength = Number(row.concrete_pouring_length || 0);
    if ((!concreteLength || concreteLength === 0) && depth > 0) {
        concreteLength = parseFloat(depth.toFixed(2));
    }

    let t4 = 0;
    if (concreteLength > 0) {
        if (concreteLength < 10) t4 = 3;
        else if (concreteLength < 20) t4 = 5;
        else if (concreteLength < 30) t4 = 7;
        else t4 = 9;
    }

    const cycleRaw = t1 + finalT2 + t3 + t4;
    const f = Number(row.classification_factor || 0);
    const cycleTime = f > 0 ? cycleRaw / f : 0;
    const daily = cycleTime > 0 ? 480 / cycleTime : 0;
    const formulaStr = `(${t1}+${finalT2}+${t3}+${t4})/${f}`;

    return {
        ...row,
        total_depth: parseFloat(depth.toFixed(2)),
        concrete_pouring_length: concreteLength,
        t4,
        t2: finalT2,
        cycle_time: parseFloat(cycleTime.toFixed(2)),
        daily_production_count: parseFloat(daily.toFixed(2)),
        calculation_formula: formulaStr
    };
};

export const calculatePileRow = (row, standards = []) => {
    const depth = (
        Number(row.layer_depth_clay || 0) +
        Number(row.layer_depth_sand || 0) +
        Number(row.layer_depth_weathered || 0) +
        Number(row.layer_depth_soft_rock || 0) +
        Number(row.layer_depth_hard_rock || 0) +
        Number(row.layer_depth_mixed || 0)
    );

    let timeSum = 0;
    if (standards.length > 0) {
        const layers = ['clay', 'sand', 'weathered', 'soft_rock', 'hard_rock', 'mixed'];
        layers.forEach((l) => {
            const layerDepth = Number(row[`layer_depth_${l}`] || 0);
            let diameterSpec = row.diameter_selection;
            if (!diameterSpec && row.pile_diameter) {
                const d = row.pile_diameter;
                if (d < 500) diameterSpec = "500미만";
                else if (d >= 500 && d <= 600) diameterSpec = "500~600";
                else if (d >= 700 && d <= 800) diameterSpec = "700~800";
                else diameterSpec = "500~600";
            }

            let pileType = row[`pile_type_${l}`];
            if (!pileType && diameterSpec) {
                const validPiles = standards.filter((s) =>
                    s.diameter_spec.trim() === diameterSpec.trim() &&
                    s[`value_${l}`] !== null
                );
                if (validPiles.length === 1) {
                    pileType = validPiles[0].pile_type;
                } else if (validPiles.length > 0) {
                    pileType = validPiles[0].pile_type;
                }
            }

            if (layerDepth > 0 && pileType && diameterSpec) {
                const std = standards.find((s) =>
                    s.diameter_spec.trim() === diameterSpec.trim() &&
                    s.pile_type === pileType
                );
                const unitTime = std ? std[`value_${l}`] : null;
                if (unitTime !== null && unitTime !== undefined) {
                    timeSum += layerDepth * unitTime;
                }
            }
        });
    }

    const finalT2 = standards.length > 0 ? parseFloat(timeSum.toFixed(2)) : Number(row.t2 || 0);
    const t1 = Number(row.t1 || 5);
    const t3 = Number(row.t3 || 8);

    const getT4 = (d, ds, numericDia) => {
        const depthVal = Number(d || 0);
        let spec = String(ds || "").trim();
        if (!spec && numericDia) {  
            const dia = Number(numericDia);
            if (dia < 500) spec = "500미만";
            else if (dia <= 600) spec = "500~600";
            else spec = "700~800";
        }
        if (depthVal < 10) return spec === "700~800" ? 4 : 2;
        if (depthVal < 20) return spec === "700~800" ? 6 : 4;
        if (depthVal < 30) return spec === "700~800" ? 8 : 6;
        return spec === "700~800" ? 10 : 8;
    };

    const t4 = getT4(depth, row.diameter_selection, row.pile_diameter);

    const getT5 = (wDia) => {
        const d = Number(wDia || 500);
        if (d <= 400) return 14;
        if (d <= 450) return 16;
        if (d <= 500) return 18;
        if (d <= 600) return 22;
        if (d <= 700) return 26;
        if (d <= 800) return 30;
        return 18;
    };

    const t5 = Number(row.t5 || getT5(row.welding_diameter));
    const f = Number(row.classification_factor || 0.85);
    const cycleRaw = t1 + finalT2 + t3 + t4 + t5;
    const cycleTime = f > 0 ? cycleRaw / f : 0;
    const daily = cycleTime > 0 ? 480 / cycleTime : 0;
    const formulaStr = `(${t1}+${finalT2.toFixed(2)}+${t3}+${t4}+${t5})/${f}`;

    return {
        ...row,
        total_depth: parseFloat(depth.toFixed(2)),
        t2: finalT2,
        t4,
        cycle_time: parseFloat(cycleTime.toFixed(2)),
        daily_production_count: parseFloat(daily.toFixed(2)),
        calculation_formula: formulaStr
    };
};

export const calculateBoredRow = (row, standards = []) => {
    const layers = ['clay', 'sand', 'gravel', 'weathered', 'soft_rock', 'hard_rock'];
    const total_depth = layers.reduce((acc, l) => acc + Number(row[`layer_depth_${l}`] || 0), 0);

    let t2 = 0;
    if (standards.length > 0) {
        layers.forEach((l) => {
            const depth = Number(row[`layer_depth_${l}`] || 0);
            const diameter = row.diameter_selection || (row.pile_diameter ? String(row.pile_diameter) : "");
            const layerMethod = row[`method_${l}`];
            const method = layerMethod || row.method_selection || row.method;
            if (depth > 0 && method && diameter) {
                const std = standards.find((s) =>
                    s.method === method &&
                    String(s.diameter_spec).trim() === String(diameter).trim()
                );
                const unitTime = std ? std[`value_${l}`] : null;
                if (unitTime != null) {
                    t2 += depth * unitTime;
                }
            }
        });
    }

    const t1 = Number(row.t1 || 2.0);
    const f = Number(row.classification_factor || 0.85);
    const cycle_time = f > 0 ? (t1 + t2) / f : 0;
    const daily_production_count = cycle_time > 0 ? 8 / cycle_time : 0;
    const formula = `(${t1} + ${t2.toFixed(2)}) / ${f}`;

    return {
        ...row,
        total_depth: parseFloat(total_depth.toFixed(2)),
        t2: parseFloat(t2.toFixed(3)),
        cycle_time: parseFloat(cycle_time.toFixed(3)),
        daily_production_count: parseFloat(daily_production_count.toFixed(3)),
        calculation_formula: formula
    };
};
