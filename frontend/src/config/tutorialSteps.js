/**
 * Tutorial step configurations for different pages using driver.js
 * Each step follows driver.js step format:
 * - element: CSS selector for the element to highlight
 * - popover: Object containing title and description
 */

export const scheduleMasterListSteps = [
    {
        popover: {
            title: '공사기간 산정 기준 페이지에 오신 것을 환영합니다! 🎉',
            description: '이 튜토리얼에서는 일정표 작성 및 관리 기능을 단계별로 안내해드립니다.',
        }
    },
    {
        element: '[data-tutorial="standard-import"]',
        popover: {
            title: '📥 표준품셈 데이터 Import',
            description: '이 버튼을 클릭하여 공사기간 산정 기준 데이터를 불러올 수 있습니다. 표준품셈 데이터를 활용하여 공정을 빠르게 추가할 수 있습니다.',
        }
    },
    {
        element: '[data-tutorial="add-schedule"]',
        popover: {
            title: '➕ 일정 추가',
            description: '새로운 일정 항목을 추가하려면 이 버튼을 사용하세요. 각 대공종별로 세부 작업을 추가할 수 있습니다.',
        }
    },
    {
        element: '[data-tutorial="schedule-table"]',
        popover: {
            title: '📋 일정표 편집',
            description: '이 테이블에서 직접 데이터를 입력하고 수정할 수 있습니다.<br/>• 수량, 단위 작업량, 투입조 등을 입력<br/>• 자동으로 작업기간 계산<br/>• 드래그하여 순서 변경 가능',
        }
    },
    {
        element: '[data-tutorial="calendar-day"]',
        popover: {
            title: '📅 Calendar Day (공기)',
            description: '이 컬럼은 자동으로 계산된 작업기간을 표시합니다. 작업일수, 가동률 등을 고려한 실제 달력 기준 일수입니다.',
        }
    },
    {
        element: '[data-tutorial="gantt-view"]',
        popover: {
            title: '📊 Gantt 차트 보기',
            description: '이 버튼으로 시각화된 간트 차트를 확인할 수 있습니다. Critical Path와 작업 간 관계를 한눈에 파악할 수 있습니다.',
        }
    },
    {
        element: '[data-tutorial="save-button"]',
        popover: {
            title: '💾 저장',
            description: '작업 내용을 저장하려면 여기를 클릭하세요. 변경사항은 자동으로 저장되지 않으니 주기적으로 저장해주세요.',
        }
    },
    {
        element: '[data-tutorial="export-excel"]',
        popover: {
            title: '📤 Excel 내보내기',
            description: '완성된 일정표를 Excel 파일로 다운로드할 수 있습니다. 간트 차트와 함께 내보내기가 포함됩니다.',
        }
    },
    {
        popover: {
            title: '튜토리얼 완료! 🎊',
            description: '이제 공사기간 산정 기준 페이지를 자유롭게 사용하실 수 있습니다. 궁금한 점이 있으시면 언제든지 도움말을 참고하세요.',
        }
    },
];

// 표준품셈 모달 튜토리얼 (사용안함 - 제거)

// 표준품셈 페이지 튜토리얼
export const totalCalcSteps = [
    {
        popover: {
            title: '표준품셈 페이지에 오신 것을 환영합니다! 🏗️',
            description: '이 페이지에서는 공기 산정을 위한 생산성 데이터를 관리합니다.',
        }
    },
    {
        element: '[data-tutorial="save-button"]',
        popover: {
            title: '💾 저장',
            description: '데이터 수정 후 이 버튼을 클릭하여 변경사항을 저장하세요.',
        }
    },
    {
        element: '[data-tutorial="main-category"]',
        popover: {
            title: '📂 대분류 (Main Category)',
            description: '공종이 대분류별로 구분되어 있습니다. 대분류명을 클릭하면 이름을 수정할 수 있습니다.',
        }
    },
    {
        element: '[data-tutorial="add-subcategory"]',
        popover: {
            title: '➕ 공종 추가',
            description: '이 버튼을 클릭하여 해당 대분류에 새로운 공종을 추가할 수 있습니다.',
        }
    },
    {
        element: '[data-tutorial="subcategory"]',
        popover: {
            title: '📁 공종 (Category)',
            description: '각 공종을 펼쳐서 세부 항목을 확인하거나 수정할 수 있습니다. 공종명도 클릭하여 수정 가능합니다.',
        }
    },
    {
        element: '[data-tutorial="data-table"]',
        popover: {
            title: '📊 데이터 테이블',
            description: '각 항목의 상세 정보를 확인하고 수정할 수 있습니다.<br/>• 목차, 규격, 단위 등 기본 정보<br/>• 표준품셈, 국토부 가이드라인 생산량',
        }
    },
    {
        element: '[data-tutorial="add-main-category"]',
        popover: {
            title: '➕ 새 대분류 추가',
            description: '새로운 대분류를 추가하여 공종을 체계적으로 관리할 수 있습니다.',
        }
    },
    {
        popover: {
            title: '튜토리얼 완료! 🎊',
            description: '이제 표준품셈 데이터를 자유롭게 관리하실 수 있습니다.',
        }
    },
];

// CIP생산성 근거 페이지 튜토리얼
export const cipBasisSteps = [
    {
        popover: {
            title: 'CIP 생산성 산출 근거 페이지 🏗️',
            description: 'CIP 공법의 생산성 분석을 위한 기준 데이터 및 산출 내역을 관리합니다.',
        }
    },
    {
        element: '[data-tutorial="cip-result"]',
        popover: {
            title: '📊 CIP 작업 결과표',
            description: '말뚝직경, 굴착 깊이, 장비를 설정하고 일일 생산성을 확인하세요.',
        }
    },
    {
        element: '[data-tutorial="cip-standard"]',
        popover: {
            title: '📋 천공 속도/시간 기준표',
            description: '비트 타입별 천공 속도 기준값을 참고하세요. 이 값으로 t2가 계산됩니다.',
        }
    },
    {
        element: '[data-tutorial="cip-basis"]',
        popover: {
            title: '📑 생산성 산출 내역',
            description: '각 조건별 생산성 산출 상세 내역을 확인하고 수정할 수 있습니다.',
        }
    },
    {
        popover: {
            title: '튜토리얼 완료! 🎊',
            description: '이제 CIP 생산성 데이터를 관리하실 수 있습니다.',
        }
    },
];

// 현장타설말뚝(Bored Pile) 생산성 근거 페이지 튜토리얼
export const boredPileBasisSteps = [
    {
        popover: {
            title: '현장타설말뚝 생산성 근거 페이지 🏗️',
            description: 'RCD, 요동식, 전회전식 공법별 생산성 분석 및 기준 데이터를 관리합니다.',
        }
    },
    {
        element: '[data-tutorial="bored-result"]',
        popover: {
            title: '📊 작업 결과표',
            description: '직경, 굴착 깊이, 공법을 설정하고 일일 생산성을 확인하세요.',
        }
    },
    {
        element: '[data-tutorial="bored-standard"]',
        popover: {
            title: '📋 굴착 속도 기준표',
            description: '공법별 굴착 속도 기준값을 참고하세요. 이 값으로 t2가 계산됩니다.',
        }
    },
    {
        element: '[data-tutorial="bored-basis"]',
        popover: {
            title: '📑 생산성 산출 내역',
            description: '각 조건별 생산성 산출 상세 내역을 확인하고 수정할 수 있습니다.',
        }
    },
    {
        popover: {
            title: '튜토리얼 완료! 🎊',
            description: '이제 현장타설말뚝 생산성 데이터를 관리하실 수 있습니다.',
        }
    },
];

// 기성말뚝 생산성 근거 페이지 튜토리얼
export const pileBasisSteps = [
    {
        popover: {
            title: '기성말뚝 생산성 근거 페이지 🏗️',
            description: '기성말뚝 기초의 생산성 분석을 위한 기준 데이터 및 산출 내역을 관리합니다.',
        }
    },
    {
        element: '[data-tutorial="pile-result"]',
        popover: {
            title: '📊 작업 결과표',
            description: '말뚝직경, 굴착 깊이, 용접 직경을 설정하고 일일 생산성을 확인하세요.',
        }
    },
    {
        element: '[data-tutorial="pile-standard"]',
        popover: {
            title: '📋 항타 속도/시간 기준표',
            description: '말뚝 종류별 항타 속도 기준값을 참고하세요.',
        }
    },
    {
        element: '[data-tutorial="pile-basis"]',
        popover: {
            title: '📑 생산성 산출 내역',
            description: '각 조건별 생산성 산출 상세 내역을 확인하고 수정할 수 있습니다.',
        }
    },
    {
        popover: {
            title: '튜토리얼 완료! 🎊',
            description: '이제 기성말뚝 생산성 데이터를 관리하실 수 있습니다.',
        }
    },
];

// 가동률 페이지 튜토리얼
export const operatingRateSteps = [
    {
        popover: {
            title: '가동률 입력 페이지 📊',
            description: '대공종별 가동률 및 기후 조건을 입력하는 페이지입니다.',
        }
    },
    {
        element: '[data-tutorial="rate-settings"]',
        popover: {
            title: '⚙️ 설정',
            description: '지역 선택 및 데이터 적용 기간을 설정하세요. 기상청 데이터를 기반으로 기후불능일이 계산됩니다.',
        }
    },
    {
        element: '[data-tutorial="rate-table"]',
        popover: {
            title: '📋 가동률 입력표',
            description: '대공종별로 동절기, 혹서기, 강우량, 강설량 등 기후조건을 입력하세요. 저장 시 가동률이 자동 계산됩니다.',
        }
    },
    {
        popover: {
            title: '튜토리얼 완료! 🎊',
            description: '이제 가동률 데이터를 관리하실 수 있습니다.',
        }
    },
];

// 간트차트 튜토리얼
export const ganttChartSteps = [
    {
        popover: {
            title: '간트차트에 오신 것을 환영합니다! 📊',
            description: '공사 일정을 시각적으로 관리하는 간트차트입니다.',
        }
    },
    {
        element: '[data-tutorial="gantt-toolbar"]',
        popover: {
            title: '🔧 도구 모음',
            description: '날짜 스케일 변경, 링크 편집, 부공종 추가 기능을 사용할 수 있습니다.',
        }
    },
    {
        element: '[data-tutorial="gantt-sidebar"]',
        popover: {
            title: '📋 일정 목록',
            description: '대공종/공종별로 정리된 일정 목록입니다. 클릭하면 해당 작업이 하이라이트됩니다.',
        }
    },
    {
        element: '[data-tutorial="gantt-chart"]',
        popover: {
            title: '📈 차트 영역',
            description: '작업 바를 드래그하여 일정을 조정하세요. 바 끝을 드래그하여 기간을 변경할 수 있습니다.',
        }
    },
    {
        popover: {
            title: '튜토리얼 완료! 🎊',
            description: '간트차트를 자유롭게 사용하세요. 빨간색은 Critical Path, 회색은 병행작업을 의미합니다.',
        }
    },
];
