"use client";

import React, {
    useState,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
} from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface SearchableDropdownProps {
    items: any[];
    placeholder?: string;
    displayProperty?: string;
    valueProperty?: string;
    styleProperty?: string;
    value?: number | string | null;
    onChange?: (value: any) => void;
    onSelectionChange?: (item: any) => void;
    onInputChange?: (searchTerm: string) => void;
    onAddNew?: () => void;
    showAddButton?: boolean;
    error?: string;
    disabled?: boolean;
}

const SearchableDropdown = forwardRef<HTMLDivElement, SearchableDropdownProps>(
    (
        {
            items = [],
            placeholder = 'Select...',
            displayProperty = 'name',
            valueProperty = 'id',
            styleProperty = '',
            value,
            onChange,
            onSelectionChange,
            onInputChange,
            onAddNew,
            showAddButton = true,
            error,
            disabled = false,
        },
        ref
    ) => {
        const [selectedItem, setSelectedItem] = useState<any>(null);
        const [isOpen, setIsOpen] = useState(false);
        const [searchTerm, setSearchTerm] = useState('');
        const [filteredItems, setFilteredItems] = useState<any[]>([]);
        const [highlightedIndex, setHighlightedIndex] = useState(-1);
        const [isTouched, setIsTouched] = useState(false);

        const dropdownRef = useRef<HTMLDivElement>(null);
        const searchInputRef = useRef<HTMLInputElement>(null);

        useImperativeHandle(ref, () => dropdownRef.current!);

        // Initialize filtered items
        useEffect(() => {
            setFilteredItems([...items]);
        }, [items]);

        // Update selected item when value or items change
        useEffect(() => {
            if (value !== null && value !== undefined && value !== '' && items.length > 0) {
                // Handle both string and number comparison
                const item = items.find((item) => {
                    const itemValue = item[valueProperty];
                    if (itemValue === value) return true;
                    if (String(itemValue).trim().toLowerCase() === String(value).trim().toLowerCase()) return true;
                    if (!isNaN(Number(itemValue)) && !isNaN(Number(value)) && String(itemValue).trim() !== '' && String(value).trim() !== '') {
                        return Number(itemValue) === Number(value);
                    }
                    return false;
                });
                setSelectedItem(item || null);
            } else {
                setSelectedItem(null);
            }
        }, [value, items, valueProperty]);

        // Handle click outside
        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    dropdownRef.current &&
                    !dropdownRef.current.contains(event.target as Node)
                ) {
                    setIsOpen(false);
                    if (!isTouched) {
                        setIsTouched(true);
                    }
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [isTouched]);

        const toggleDropdown = () => {
            if (disabled) return;

            setIsOpen(!isOpen);
            if (!isOpen) {
                setSearchTerm('');
                filterItems('');
                setTimeout(() => {
                    searchInputRef.current?.focus();
                }, 0);
            } else {
                if (!isTouched) {
                    setIsTouched(true);
                }
            }
        };

        const filterItems = (term: string = searchTerm) => {
            if (!term.trim()) {
                setFilteredItems([...items]);
            } else {
                const lowerTerm = term.toLowerCase();
                const filtered = items.filter((item) =>
                    item[displayProperty]?.toLowerCase().includes(lowerTerm)
                );
                setFilteredItems(filtered);
            }
            setHighlightedIndex(filteredItems.length > 0 ? 0 : -1);

            // Emit the search term to parent
            if (onInputChange) {
                onInputChange(term);
            }
        };

        const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const term = e.target.value;
            setSearchTerm(term);
            filterItems(term);
        };

        const selectItem = (item: any) => {
            setSelectedItem(item);
            setIsOpen(false);
            setIsTouched(true);

            if (onChange) {
                onChange(item[valueProperty]);
            }
            if (onSelectionChange) {
                onSelectionChange(item);
            }
        };

        const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
            switch (event.key) {
                case 'ArrowDown':
                case 'Down':
                    event.preventDefault();
                    if (!isOpen) {
                        toggleDropdown();
                    } else {
                        highlightNext();
                    }
                    break;
                case 'ArrowUp':
                case 'Up':
                    event.preventDefault();
                    if (isOpen) {
                        highlightPrevious();
                    }
                    break;
                case 'Enter':
                case ' ':
                case 'Spacebar':
                    event.preventDefault();
                    if (!isOpen) {
                        toggleDropdown();
                    } else if (highlightedIndex >= 0 && filteredItems.length > 0) {
                        selectItem(filteredItems[highlightedIndex]);
                    }
                    break;
                case 'Escape':
                case 'Esc':
                    event.preventDefault();
                    if (isOpen) {
                        setIsOpen(false);
                    }
                    break;
                case 'Tab':
                    if (isOpen) {
                        setIsOpen(false);
                    }
                    break;
            }
        };

        const handleSearchKeyDown = (event: React.KeyboardEvent) => {
            switch (event.key) {
                case 'ArrowDown':
                case 'Down':
                    event.preventDefault();
                    highlightNext();
                    break;
                case 'ArrowUp':
                case 'Up':
                    event.preventDefault();
                    highlightPrevious();
                    break;
                case 'Enter':
                    event.preventDefault();
                    if (highlightedIndex >= 0 && filteredItems.length > 0) {
                        selectItem(filteredItems[highlightedIndex]);
                    }
                    break;
                case 'Escape':
                case 'Esc':
                    event.preventDefault();
                    setIsOpen(false);
                    break;
            }
        };

        const highlightNext = () => {
            if (filteredItems.length === 0) return;

            setHighlightedIndex((prevIndex) => {
                const newIndex =
                    prevIndex < filteredItems.length - 1 ? prevIndex + 1 : 0;
                scrollToHighlighted(newIndex);
                return newIndex;
            });
        };

        const highlightPrevious = () => {
            if (filteredItems.length === 0) return;

            setHighlightedIndex((prevIndex) => {
                const newIndex =
                    prevIndex > 0 ? prevIndex - 1 : filteredItems.length - 1;
                scrollToHighlighted(newIndex);
                return newIndex;
            });
        };

        const scrollToHighlighted = (index: number) => {
            setTimeout(() => {
                const highlightedElement = dropdownRef.current?.querySelector(
                    `li:nth-child(${index + 1})`
                );
                if (highlightedElement) {
                    highlightedElement.scrollIntoView({ block: 'nearest' });
                }
            }, 0);
        };

        const handleAddNew = (event: React.MouseEvent) => {
            event.stopPropagation();
            if (onAddNew) {
                onAddNew();
            }
        };

        return (
            <div ref={dropdownRef} className="relative w-full">
                {/* Trigger Button */}
                <button
                    type="button"
                    onClick={toggleDropdown}
                    onKeyDown={handleTriggerKeyDown}
                    disabled={disabled}
                    className={`w-full rounded-lg border bg-white px-5 py-3.5 text-sm transition flex items-center justify-between
            focus:ring-0.5 focus:outline-none focus:ring-gray-400 focus:border-gray-400
            ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          `}
                >
                    <span className={`${selectedItem ? 'text-gray-900' : 'text-gray-500'}`}>
                        {selectedItem ? selectedItem[displayProperty] : placeholder}
                    </span>
                    <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'transform rotate-180' : ''
                            }`}
                    />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div
                        className={`${styleProperty ||
                            'absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-xl shadow-lg'
                            } bg-white border border-gray-200`}
                    >
                        {/* Search Input */}
                        <div className="sticky top-0 bg-white p-3 border-b border-gray-200">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Search..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                            />
                        </div>

                        {/* Items List */}
                        <ul className="py-1">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item, index) => (
                                    <li
                                        key={item[valueProperty]}
                                        onClick={() => selectItem(item)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${highlightedIndex === index
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-900 hover:bg-gray-50'
                                            } ${selectedItem &&
                                                selectedItem[valueProperty] === item[valueProperty]
                                                ? 'font-medium bg-blue-50 text-blue-700'
                                                : ''
                                            }`}
                                    >
                                        {item[displayProperty]}
                                    </li>
                                ))
                            ) : (
                                <li className="px-4 py-3 text-sm text-gray-500 text-center">
                                    No results found
                                </li>
                            )}
                        </ul>

                        {/* Add New Button */}
                        {showAddButton && onAddNew && (
                            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-2">
                                <button
                                    type="button"
                                    onClick={handleAddNew}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add New
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
);

SearchableDropdown.displayName = 'SearchableDropdown';

export default SearchableDropdown;
