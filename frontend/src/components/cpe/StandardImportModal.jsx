import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, ChevronDown, Check } from 'lucide-react';
import { fetchProductivities } from '../../api/cpe_all/productivity';

/**
 * Reusable Accordion Component for the Modal (Dark Mode)
 */
const ModalAccordion = ({ title, count, children, defaultOpen = false, isFirst = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div
            data-tutorial={isFirst ? "import-accordion" : undefined}
            className="border border-gray-700 rounded-lg overflow-hidden mb-2 bg-[#2c2c3a] shadow-md"
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#3a3a4a] hover:bg-[#424259] transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    <span className="font-bold text-gray-200 text-sm">{title}</span>
                    <span className="text-xs text-gray-400 bg-[#1f1f2b] px-2 py-0.5 rounded-full font-mono">
                        {count}개
                    </span>
                </div>
            </button>
            {isOpen && (
                <div className="border-t border-gray-700">
                    {children}
                </div>
            )}
        </div>
    );
};

export default function StandardImportModal({ isOpen, onClose, onSelect, project_id }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isScrolling, setIsScrolling] = useState(false);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        clearTimeout(window.importModalScrollTimeout);
        window.importModalScrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

    useEffect(() => {
        if (isOpen && project_id) {
            loadItems();
        }
    }, [isOpen, project_id]);

    const loadItems = async () => {
        setLoading(true);
        try {
            const data = await fetchProductivities(project_id);
            // Handle both array and paginated result structure
            const list = Array.isArray(data) ? data : (data.results || []);
            setItems(list);
        } catch (error) {
            console.error("Failed to load standard items:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter and Group Data
    const groupedItems = useMemo(() => {
        const filtered = items.filter(item => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                (item.item_name || '').toLowerCase().includes(term) ||
                (item.standard || '').toLowerCase().includes(term) ||
                (item.category || '').toLowerCase().includes(term) ||
                (item.main_category || '').toLowerCase().includes(term)
            );
        });

        // Group by Main Category
        const groups = {};
        filtered.forEach(item => {
            const main = item.main_category || '미분류';
            if (!groups[main]) groups[main] = [];
            groups[main].push(item);
        });

        // Sort keys
        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key];
            return acc;
        }, {});

    }, [items, searchTerm]);

    const handleSelectType = (item, type) => {
        let productivity = 0;
        let remark = '';

        switch (type) {
            case 'molit':
                productivity = item.molit_workload || 0;
                remark = '국토부 가이드라인 물량 기준';
                break;
            case 'pumsam':
                productivity = item.pumsam_workload || 0;
                remark = '표준품셈 물량 기준';
                break;
            case 'average':
                const avg = (item.pumsam_workload && item.molit_workload)
                    ? (item.pumsam_workload + item.molit_workload) / 2
                    : (item.pumsam_workload || item.molit_workload || 0);
                productivity = avg;
                remark = '평균 물량 기준';
                break;
        }

        onSelect({
            ...item,
            productivity,
            selectedType: type,
            remark
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#2c2c3a] w-full max-w-7xl max-h-[85vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                {/* Header (Navy) */}
                <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-[#3a3a4a]">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.45)]"></span>
                            표준품셈 가져오기
                        </h2>
                        <p className="text-xs text-gray-400 mt-1 pl-3.5">
                            국토부 가이드라인, 표준품셈, 평균 중 선택하여 적용합니다.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700/50 rounded-full transition text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar (Dark) */}
                <div className="p-4 bg-[#2c2c3a] border-b border-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            data-tutorial="import-search"
                            type="text"
                            placeholder="공종명, 항목명, 규격 검색..."
                            className="w-full bg-[#1f1f2b] border border-gray-700 text-gray-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition text-sm font-medium placeholder-gray-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content Area (Dark) */}
                <div
                    className={`scroll-container flex-1 overflow-auto p-4 bg-[#1f1f2b] ${isScrolling ? 'scrolling' : ''}`}
                    onScroll={handleScroll}
                >
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-64 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                            <span className="text-gray-500 text-sm">데이터 불러오는 중...</span>
                        </div>
                    ) : Object.keys(groupedItems).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Search size={40} className="mb-4 opacity-20" />
                            <p>검색 결과가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(groupedItems).map(([mainCategory, categoryItems]) => (
                                <ModalAccordion
                                    key={mainCategory}
                                    title={mainCategory}
                                    count={categoryItems.length}
                                    defaultOpen={true}
                                >
                                    <div className="overflow-x-auto bg-[#2c2c3a]">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="bg-[#1f1f2b] text-gray-400 border-b border-gray-700/50 text-xs uppercase tracking-wider">
                                                    <th className="py-2 px-4 font-medium w-28">공종</th>
                                                    <th className="py-2 px-4 font-medium">항목명</th>
                                                    <th className="py-2 px-4 font-medium">규격</th>
                                                    <th className="py-2 px-4 font-medium w-16 text-center">단위</th>
                                                    <th className="py-2 px-4 font-medium w-28 text-right">국토부</th>
                                                    <th className="py-2 px-4 font-medium w-28 text-right">표준품셈</th>
                                                    <th className="py-2 px-4 font-medium w-28 text-right">평균</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700/30">
                                                {categoryItems.map((item) => {
                                                    const avgValue = (item.pumsam_workload && item.molit_workload)
                                                        ? (item.pumsam_workload + item.molit_workload) / 2
                                                        : (item.pumsam_workload || item.molit_workload || 0);

                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className="group hover:bg-blue-900/10 border-b border-gray-800 last:border-0 transition-colors"
                                                        >
                                                            <td className="py-3 px-4 text-gray-500 font-medium">
                                                                {item.category}
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-200 font-bold">
                                                                {item.item_name}
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-500">
                                                                {item.standard || '-'}
                                                            </td>
                                                            <td className="py-3 px-4 text-center text-gray-500">
                                                                {item.unit}
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    onClick={() => handleSelectType(item, 'molit')}
                                                                    className="w-full px-2 py-1.5 bg-blue-500/10 text-blue-300 rounded text-xs font-bold border border-blue-500/20 hover:bg-blue-500 hover:text-white transition"
                                                                    disabled={!item.molit_workload}
                                                                >
                                                                    {item.molit_workload ? (
                                                                        <span className="font-mono">{item.molit_workload.toLocaleString()}</span>
                                                                    ) : '-'}
                                                                </button>
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    onClick={() => handleSelectType(item, 'pumsam')}
                                                                    className="w-full px-2 py-1.5 bg-blue-500/10 text-blue-300 rounded text-xs font-bold border border-blue-500/20 hover:bg-blue-500 hover:text-white transition"
                                                                    disabled={!item.pumsam_workload}
                                                                >
                                                                    {item.pumsam_workload ? (
                                                                        <span className="font-mono">{item.pumsam_workload.toLocaleString()}</span>
                                                                    ) : '-'}
                                                                </button>
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    onClick={() => handleSelectType(item, 'average')}
                                                                    className="w-full px-2 py-1.5 bg-blue-500/10 text-blue-300 rounded text-xs font-bold border border-blue-500/20 hover:bg-blue-500 hover:text-white transition"
                                                                    disabled={!avgValue}
                                                                >
                                                                    {avgValue ? (
                                                                        <span className="font-mono">{avgValue.toLocaleString()}</span>
                                                                    ) : '-'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </ModalAccordion>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
