export const SCHEDULE_MASTER_TABLE_COLUMNS = [
    { key: "select", label: "", width: 40, sticky: "select", alwaysVisible: true, toggleable: false },
    { key: "drag", label: "", width: 36, sticky: "drag", alwaysVisible: true, toggleable: false },
    { key: "process", label: "중공종", width: 180, toggleable: true },
    { key: "sub_process", label: "공정", width: 180, toggleable: true },
    { key: "work_type", label: "세부공종", width: 260, toggleable: true },
    { key: "quantity_formula", label: "수량산출(개산)", width: 130, toggleable: true },
    { key: "unit", label: "단위", width: 70, toggleable: true },
    { key: "quantity", label: "내역수량", width: 90, toggleable: true },
    { key: "productivity", label: "단위 작업량", width: 90, toggleable: true },
    { key: "crew_size", label: "투입조", width: 72, toggleable: true },
    { key: "daily_production", label: "생산량/일", width: 90, toggleable: true },
    { key: "cp_checked", label: "CP", width: 72, toggleable: true },
    { key: "parallel_rate", label: "병행률(%)", width: 86, toggleable: true },
    { key: "reflection_rate", label: "반영률(%)", width: 86, toggleable: true },
    { key: "working_days", label: "작업기간 W/D", width: 90, toggleable: true },
    { key: "operating_rate_key", label: "가동률", width: 80, toggleable: true },
    { key: "calendar_days", label: "Cal Day", width: 170, toggleable: true, accent: true },
    { key: "note", label: "비고", width: 280, toggleable: true },
    { key: "action", label: "", width: 64, alwaysVisible: true, toggleable: false }
];

export const SCHEDULE_MASTER_TOGGLEABLE_COLUMNS = SCHEDULE_MASTER_TABLE_COLUMNS.filter(
    (column) => column.toggleable
);

export const SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS = SCHEDULE_MASTER_TOGGLEABLE_COLUMNS.map(
    (column) => column.key
);
