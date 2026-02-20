import React, { useState, useCallback } from "react";
import { Trash2, History, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useScheduleStore } from "../../../stores/scheduleStore";
import { useConfirm } from "../../../contexts/ConfirmContext";

const SnapshotManager = ({ isOpen, onClose }) => {
    const snapshots = useScheduleStore((state) => state.snapshots);
    const addSnapshot = useScheduleStore((state) => state.addSnapshot);
    const restoreSnapshot = useScheduleStore((state) => state.restoreSnapshot);
    const deleteSnapshot = useScheduleStore((state) => state.deleteSnapshot);
    const [label, setLabel] = useState("");
    const [isScrolling, setIsScrolling] = useState(false);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        clearTimeout(window.snapshotScrollTimeout);
        window.snapshotScrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);
    const { confirm } = useConfirm();

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!label.trim()) return;
        addSnapshot(label);
        setLabel("");
        toast.success("스냅샷 저장 완료");
    };

    const handleRestore = async (id) => {
        const ok = await confirm("현재 작업 내용이 스냅샷 내용으로 대체됩니다. 계속하시겠습니까?");
        if (!ok) return;
        restoreSnapshot(id);
        toast.success("복구 완료");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-96 max-h-[500px] flex flex-col overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <History size={18} className="text-blue-600" />
                        히스토리 / 스냅샷
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                            placeholder="버전 이름 입력 (예: 1차 수정)"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1 transition-colors"
                            onClick={handleCreate}
                        >
                            <Save size={14} /> 저장
                        </button>
                    </div>
                </div>

                <div
                    className={`scroll-container flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50 ${isScrolling ? 'scrolling' : ''}`}
                    onScroll={handleScroll}
                >
                    {snapshots.length === 0 && (
                        <div className="text-center text-gray-400 text-xs py-8">저장된 스냅샷이 없습니다.</div>
                    )}
                    {snapshots.map(snap => (
                        <div key={snap.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-gray-800 text-sm">{snap.label}</span>
                                <span className="text-[10px] text-gray-500">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex gap-2 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                    className="flex-1 bg-blue-50 text-blue-700 py-1 rounded text-xs hover:bg-blue-100 font-medium"
                                    onClick={() => handleRestore(snap.id)}
                                >
                                    복구
                                </button>
                                <button
                                    className="px-2 text-gray-400 hover:text-red-500 transition-colors"
                                    onClick={() => deleteSnapshot(snap.id)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SnapshotManager;
