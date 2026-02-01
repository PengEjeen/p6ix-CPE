import React from "react";
import { Trash2, Link, RefreshCw, Plus, GripVertical } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ScheduleTableRow = ({ item, isLinked, handleChange, handleDeleteItem, handleAddItem, handleOpenImport, spanInfo, isOverlay, rowClassName = "", operatingRates = [], workDayType = "6d" }) => {
    // Auto-match operating rate by main_category
    const rateObj = operatingRates.find((rate) => rate.main_category === item.main_category);

    // Use auto-calculated operating_rate directly from WorkScheduleWeight
    let rateValue = item.operating_rate_value ?? 100;
    let runRate = null;
    if (rateObj) {
        rateValue = rateObj.operating_rate || 100;
        runRate = rateObj.work_week_days;
    }
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    // Ensure dragging item works if not overlay
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: 'relative',
        opacity: isDragging ? 0.3 : 1, // Dim original when dragging
    };

    // If it's the specific Overlay item, force opacity 1 and full cells
    if (isOverlay) {
        style.opacity = 1;
        style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
        style.backgroundColor = "white";
        // Overlay always shows full cells
        spanInfo = { mainRowSpan: 1, procRowSpan: 1, isMainFirst: true, isProcFirst: true };
    }

    return (
        <tr ref={setNodeRef} style={style} className={`hover:bg-white/5 transition-colors text-base ${rowClassName} ${isDragging && !isOverlay ? "bg-blue-900/20" : ""}`}>
            {/* Drag Handle */}
            <td className="border-r border-gray-700 text-center text-gray-400 cursor-grab active:cursor-grabbing p-1" {...attributes} {...listeners}>
                <GripVertical size={14} className="mx-auto" />
            </td>

            {/* Main Category */}
            <td className="border-r border-gray-700 px-2 py-1 text-center text-gray-200 text-base font-medium">
                {item.main_category}
            </td>

            {/* Process */}
            {(spanInfo.isProcFirst || isOverlay) && (
                <td
                    rowSpan={isOverlay ? 1 : spanInfo.procRowSpan}
                    className="border-r border-gray-700 bg-[#2c2c3a] p-1 align-top"
                >
                    <input
                        className="w-full bg-transparent outline-none font-medium text-gray-200 text-center text-base"
                        value={item.process}
                        onChange={(e) => handleChange(item.id, 'process', e.target.value)}
                    />
                </td>
            )}

            {/* Work Type */}
            <td className="border-r border-gray-700 px-2 py-1">
                <div className="flex items-center gap-1">
                    {isLinked && <Link size={12} className="text-blue-500" />}
                    <input
                        type="text"
                        className="w-full bg-transparent outline-none text-gray-200 p-1 rounded hover:bg-white/10 focus:bg-[#1f1f2b] focus:ring-1 focus:ring-blue-500/50 transition text-base font-medium"
                        value={item.work_type}
                        onChange={(e) => handleChange(item.id, 'work_type', e.target.value)}
                    />
                </div>
            </td>

            {/* Formula */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-right outline-none p-1 text-sm text-gray-400 bg-[#1f1f2b] rounded font-medium" value={item.quantity_formula || ''} placeholder="-" onChange={(e) => handleChange(item.id, 'quantity_formula', e.target.value)} />
            </td>

            {/* Unit */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-300 bg-[#1f1f2b] rounded text-base font-medium" value={item.unit} onChange={(e) => handleChange(item.id, 'unit', e.target.value)} />
            </td>

            {/* Quantity */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-right outline-none p-1 font-bold text-gray-100 bg-[#1f1f2b] rounded text-base tracking-tight" value={item.quantity} onChange={(e) => handleChange(item.id, 'quantity', e.target.value)} />
            </td>

            {/* Productivity */}
            <td className={`border-r border-gray-700 p-1 ${isLinked ? 'bg-blue-900/20' : ''}`}>
                <input className={`w-full text-right outline-none p-1 text-base bg-[#1f1f2b] rounded ${isLinked ? 'text-blue-300 font-bold' : 'text-gray-200 font-semibold'}`} value={item.productivity} disabled={isLinked} onChange={(e) => handleChange(item.id, 'productivity', e.target.value)} />
            </td>

            {/* Crew */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-200 bg-[#1f1f2b] rounded text-base font-semibold" value={item.crew_size} onChange={(e) => handleChange(item.id, 'crew_size', e.target.value)} />
            </td>

            {/* Daily Prod */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-gray-200 font-mono bg-[#1f1f2b] text-base font-semibold">
                {item.daily_production?.toLocaleString()}
            </td>

            {/* Apply Rate */}
            <td className="border-r border-gray-700 p-1">
                <input
                    className="w-full text-right outline-none p-1 text-gray-200 bg-[#1f1f2b] rounded text-base font-semibold"
                    type="number"
                    value={item.application_rate || 100}
                    onChange={(e) => handleChange(item.id, 'application_rate', e.target.value)}
                />
            </td>

            {/* Op Rate */}
            <td className="border-r border-gray-700 p-1">
                <div className="w-full text-base text-center text-gray-200 bg-[#1f1f2b] rounded font-medium py-1">
                    {rateValue}%
                </div>
            </td>

            {/* Cal Days */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-blue-300 font-bold font-mono bg-blue-900/20 text-base">
                {item.calendar_days}
                <span className="ml-1 text-sm text-blue-200 font-semibold">일</span>
            </td>

            {/* Remarks */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-sm outline-none p-1 text-gray-200 bg-[#1f1f2b] rounded font-medium" value={item.remarks} onChange={(e) => handleChange(item.id, 'remarks', e.target.value)} />
            </td>

            {/* Action */}
            <td className="p-1 text-center">
                <button className="text-gray-400 hover:text-red-500 transition-colors" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 size={16} />
                </button>
            </td>
        </tr>
    );
};

export default ScheduleTableRow;
