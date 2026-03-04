import React, { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiX, FiSearch } from 'react-icons/fi';

const Combobox = ({
    options = [],
    value,
    onChange,
    placeholder = "선택해주세요",
    className = "",
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredOptions, setFilteredOptions] = useState(options);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        setFilteredOptions(
            options.filter((option) =>
                String(option.label || option).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [searchTerm, options]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 값이 외부에서 변경되었을 때 검색어도 초기화하거나 업데이트할 필요가 있는지?
    // 여기서는 단순히 선택된 값을 보여주는 용도로는 value를 사용하지 않고, 
    // 선택된 항목의 라벨을 input에 표시하는 방식이 아니라,
    // trigger 버튼에 값을 표시하고, dropdown 내부에 검색 input이 있는 형태로 구현.

    const selectedOption = options.find(o => (o.value || o) === value);
    const displayValue = selectedOption ? (selectedOption.label || selectedOption.value || selectedOption) : null;

    const handleSelect = (option) => {
        onChange(option.value || option);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
          flex items-center justify-between w-full
          bg-[#181825] border border-gray-700 rounded px-3 py-1.5 
          text-sm text-gray-200 cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-500'}
          ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : ''}
        `}
            >
                <span className={`block truncate ${!displayValue ? 'text-gray-500' : ''}`}>
                    {displayValue || placeholder}
                </span>
                <FiChevronDown className={`ml-2 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[#1f1f2b] border border-gray-700 rounded-lg shadow-xl max-h-60 flex flex-col">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-700 sticky top-0 bg-[#1f1f2b] rounded-t-lg">
                        <div className="relative">
                            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                ref={inputRef}
                                autoFocus
                                type="text"
                                className="w-full bg-[#181825] text-gray-200 text-sm rounded border border-gray-600 pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500"
                                placeholder="검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                검색 결과가 없습니다.
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => {
                                const optValue = option.value || option;
                                const optLabel = option.label || option.value || option;
                                const isSelected = optValue === value;

                                return (
                                    <div
                                        key={index}
                                        onClick={() => handleSelect(option)}
                                        className={`
                      px-3 py-2 text-sm rounded cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-white/5'}
                    `}
                                    >
                                        {optLabel}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Combobox;
