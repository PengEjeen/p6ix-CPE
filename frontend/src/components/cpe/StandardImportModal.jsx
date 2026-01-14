import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown, Check } from 'lucide-react';
import { fetchProductivities } from '../../api/cpe_all/productivity';

/**
 * Reusable Accordion Component for the Modal (Dark Mode)
 */
const ModalAccordion = ({ title, count, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden mb-2 bg-[#232334] shadow-md">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#2a2a3d] hover:bg-[#32324a] transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    <span className="font-bold text-gray-200 text-sm">{title}</span>
                    <span className="text-xs text-gray-400 bg-[#181825] px-2 py-0.5 rounded-full font-mono">
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e1e2f] w-full max-w-5xl max-h-[85vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                {/* Header (Navy) */}
                <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-[#232334]">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"></span>
                            표준품셈 가져오기
                        </h2>
                        <p className="text-xs text-gray-400 mt-1 pl-3.5">
                            검증된 표준 생산성 데이터를 공정표에 적용합니다.
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
                <div className="p-4 bg-[#1e1e2f] border-b border-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="공종명, 항목명, 규격 검색..."
                            className="w-full bg-[#181825] border border-gray-700 text-gray-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition text-sm font-medium placeholder-gray-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content Area (Dark) */}
                <div className="flex-1 overflow-auto p-4 bg-[#181825] custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-64 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
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
                                    <div className="overflow-x-auto bg-[#1e1e2f]">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="bg-[#181825] text-gray-400 border-b border-gray-700/50 text-xs uppercase tracking-wider">
                                                    <th className="py-2 px-4 font-medium w-32">공종</th>
                                                    <th className="py-2 px-4 font-medium">항목명</th>
                                                    <th className="py-2 px-4 font-medium">규격</th>
                                                    <th className="py-2 px-4 font-medium w-20 text-center">단위</th>
                                                    <th className="py-2 px-4 font-medium w-28 text-right">일일생산성</th>
                                                    <th className="py-2 px-4 font-medium w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700/30">
                                                {categoryItems.map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => onSelect(item)}
                                                        className="group hover:bg-cyan-900/10 border-b border-gray-800 last:border-0 cursor-pointer transition-colors"
                                                    >
                                                        <td className="py-3 px-4 text-gray-500 font-medium">
                                                            {item.category}
                                                        </td>
                                                        <td className="py-3 px-4 text-gray-200 font-bold group-hover:text-cyan-400 transition-colors">
                                                            {item.item_name}
                                                        </td>
                                                        <td className="py-3 px-4 text-gray-500">
                                                            {item.standard || '-'}
                                                        </td>
                                                        <td className="py-3 px-4 text-center text-gray-500">
                                                            {item.unit}
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <span className="font-mono font-bold text-yellow-500">
                                                                {(item.pumsam_workload || 0).toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right" >
                                                            <button
                                                                className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded text-xs font-bold border border-cyan-500/20 hover:bg-cyan-500 hover:text-white transition opacity-0 group-hover:opacity-100"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onSelect(item);
                                                                }}
                                                            >
                                                                선택
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
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
