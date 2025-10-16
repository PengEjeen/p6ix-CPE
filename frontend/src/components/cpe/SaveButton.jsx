import React, { useEffect } from "react";

export default function SaveButton({ onSave, saving }) {
  // Ctrl + S 저장 핸들링
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!saving) onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, saving]);

  return (
    <button
      onClick={onSave}
      disabled={saving}
      className={`px-4 py-2 text-sm rounded border transition font-medium ${
        saving
          ? "bg-[#3b3b4f] border-gray-600 text-gray-400 cursor-not-allowed"
          : "bg-[#2c2c3a] hover:bg-[#3b3b4f] border-gray-600 text-gray-100 hover:text-white hover:border-gray-500"
      }`}
    >
      {saving ? "저장 중..." : "저장"}
    </button>
  );
}
