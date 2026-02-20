import React, { useEffect } from "react";

export default function SaveButton({ onSave, saving, ...props }) {
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
      {...props}
      onClick={onSave}
      disabled={saving}
      className={`px-4 py-2 text-sm rounded border transition font-medium ${saving
          ? "bg-[var(--navy-surface-3)] border-[var(--navy-border)] text-[var(--navy-text-muted)] cursor-not-allowed"
          : "bg-[var(--navy-surface)] hover:bg-[var(--navy-surface-3)] border-[var(--navy-border)] text-[var(--navy-text)]"
        }`}
    >
      {saving ? "저장 중..." : "저장"}
    </button>
  );
}
