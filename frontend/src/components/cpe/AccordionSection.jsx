import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function AccordionSection({
  title,
  meta,
  action,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
      <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-2 text-left"
        >
          <ChevronDown
            size={16}
            className={`text-gray-300 transition-transform ${open ? "rotate-180" : ""}`}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm md:text-md font-semibold text-white">
              {title}
            </span>
            {meta ? <span className="text-xs text-gray-400">{meta}</span> : null}
          </div>
        </button>
        {action ? <div className="flex items-center">{action}</div> : null}
      </div>
      <div className={open ? "block" : "hidden"}>{children}</div>
    </section>
  );
}
