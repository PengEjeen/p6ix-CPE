/**
 * Smart Gantt Editor - Solver Logic
 * 역산 로직 및 공기 산정 공통 함수
 */

/**
 * 기본 공기 산정 로직 (Forward Calculation)
 * 주어진 물량, 생산성, 인원, 가동율 정보를 바탕으로 공사기간을 계산
 */
export const calculateItem = (item, operatingRates = [], workDayType = '6d') => {
    const quantity = parseFloat(item.quantity) || 0;
    const productivity = parseFloat(item.productivity) || 0;
    const crew_size = parseFloat(item.crew_size) || 1;

    const daily_production = productivity * crew_size;
    const working_days = daily_production > 0 ? quantity / daily_production : 0;

    // 가동율 조회
    const rateObj = operatingRates.find(r => r.type === item.operating_rate_type);
    let rateValue = 100;

    if (item.operating_rate_value) {
        // 이미 아이템에 저장된 값이 있으면 우선 사용? 
        // 아니면 항상 최신 마스터 데이터 기준? -> 보통 마스터 기준이 맞음.
        // 하지만 여기서는 편의상 마스터 데이터가 없으면 저장된 값 사용
        rateValue = parseFloat(item.operating_rate_value);
    }

    // 마스터 데이터가 있으면 덮어씀
    if (rateObj) {
        if (workDayType === "7d") rateValue = parseFloat(rateObj.pct_7d);
        else if (workDayType === "5d") rateValue = parseFloat(rateObj.pct_5d);
        else rateValue = parseFloat(rateObj.pct_6d);
    }

    const calendar_days = rateValue > 0 ? working_days / (rateValue / 100) : 0;
    const calendar_months = calendar_days / 30;

    return {
        ...item,
        productivity: parseFloat(productivity.toFixed(3)),
        daily_production: parseFloat(daily_production.toFixed(3)),
        working_days: parseFloat(working_days.toFixed(2)),
        operating_rate_value: rateValue,
        calendar_days: parseFloat(calendar_days.toFixed(1)),
        calendar_months: parseFloat(calendar_months.toFixed(1))
    };
};

/**
 * 역산 로직 A: Crew Size 자동 조정
 * 사용자가 바를 줄이면 -> 인원을 늘려서 맞춘다.
 * 
 * 공식:
 * Target Calendar Days = (Quantity / (Prod * NewCrew)) / (OpRate / 100)
 * -> NewCrew = Quantity / (Prod * TargetWorkingDays)
 * -> TargetWorkingDays = TargetCalendarDays * (OpRate / 100)
 */
export const solveForCrewSize = (item, targetCalendarDays, baseProductivity = null) => {
    // 1. 방어 로직: 0일 이하는 1일로 처리
    const days = Math.max(0.5, targetCalendarDays); // 최소 0.5일

    // 2. 필요 순작업일수 역산
    const opRate = (item.operating_rate_value || 100) / 100;
    const targetWorkingDays = days * opRate;

    if (targetWorkingDays <= 0) return { ...item, calendar_days: days };

    // 3. 필요 일일작업량 역산
    // WorkingDays = Qty / DailyProd -> DailyProd = Qty / WorkingDays
    const quantity = parseFloat(item.quantity) || 0;
    if (quantity <= 0) return { ...item, calendar_days: days }; // 물량 없으면 그냥 기간만 변경

    const requiredDailyProduction = quantity / targetWorkingDays;

    // 4. 필요 인원 역산
    // DailyProd = Productivity * Crew -> Crew = DailyProd / Productivity
    // baseProductivity가 주어지면 그것을 우선 사용 (원복 로직)
    const productivity = baseProductivity !== null
        ? parseFloat(baseProductivity)
        : (parseFloat(item.productivity) || 0);

    if (productivity <= 0) {
        // 생산성 정보가 없으면 계산 불가, 기간만 변경해서 리턴
        return { ...item, calendar_days: days };
    }

    const exactCrewSize = requiredDailyProduction / productivity;

    // 5. 정수화 (올림 처리 - 인원은 모자라면 안되므로)
    const newCrewSize = Math.ceil(exactCrewSize);

    // 6. 결과 반영 (재계산하여 정합성 보장)
    // 인원을 정수로 맞추면 기간이 미세하게 달라질 수 있음 -> 이건 허용해야 함 (자연스러운 현상)
    // 하지만 사용자가 드래그한 값에 최대한 가깝게 보여주는 것이 UX 상 좋음.
    // 여기서는 일단 Crew를 업데이트하고, 다시 정방향 계산을 돌려서 최종 기간을 확정한다.

    const tempItem = {
        ...item,
        crew_size: newCrewSize,
        productivity: productivity // 생산성 원복 (만약 변경되었던 것이라면)
    };

    // 정방향 재계산 (operatingRates는 이미 값으로 들어있다고 가정)
    // 주의: calculateItem을 쓰려면 operatingRates 배열이 필요함. 
    // 여기서는 약식으로 내부 계산

    const newDailyProd = productivity * newCrewSize;
    const newWorkingDays = quantity / newDailyProd;
    const finalCalendarDays = opRate > 0 ? newWorkingDays / opRate : 0;

    return {
        ...tempItem,
        daily_production: parseFloat(newDailyProd.toFixed(3)),
        working_days: parseFloat(newWorkingDays.toFixed(2)),
        calendar_days: parseFloat(finalCalendarDays.toFixed(1))
    };
};

/**
 * 역산 로직 B: Productivity 자동 조정 (Default)
 * 사용자가 바를 줄이면 -> 생산성을 높여서(더 열심히 일해서) 맞춘다.
 * Crew Size는 고정.
 * 
 * 공식:
 * Target Calendar Days = (Quantity / (NewProd * Crew)) / (OpRate / 100)
 * -> NewProd = Quantity / (TargetWorkingDays * Crew)
 */
export const solveForProductivity = (item, targetCalendarDays) => {
    // 1. 방어 로직
    const days = Math.max(0.5, targetCalendarDays); // 최소 0.5일

    // 2. 필요 순작업일수 역산
    const opRate = (item.operating_rate_value || 100) / 100;
    const targetWorkingDays = days * opRate;

    if (targetWorkingDays <= 0) return { ...item, calendar_days: days };

    // 3. 필요 일일작업량 역산
    const quantity = parseFloat(item.quantity) || 0;
    if (quantity <= 0) return { ...item, calendar_days: days };

    const requiredDailyProduction = quantity / targetWorkingDays;

    // 4. 필요 생산성 역산
    const crewSize = parseFloat(item.crew_size) || 1;
    if (crewSize <= 0) return { ...item, calendar_days: days };

    const newProductivity = requiredDailyProduction / crewSize;

    // 5. 결과 반영 
    // 여기서는 정수화 필요 없음 (생산성은 소수점 가능)

    // 검증용 재계산
    const newDailyProd = newProductivity * crewSize;
    const newWorkingDays = quantity / newDailyProd;
    const finalCalendarDays = opRate > 0 ? newWorkingDays / opRate : 0;

    return {
        ...item,
        productivity: parseFloat(newProductivity.toFixed(3)),
        daily_production: parseFloat(newDailyProd.toFixed(3)),
        working_days: parseFloat(newWorkingDays.toFixed(2)),
        calendar_days: parseFloat(finalCalendarDays.toFixed(1))
    };
};
