import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

interface Props {
    className?: string;
}

const SORT_OPTIONS = [
    "Популярное",
    "Сначала дешевое",
    "Сначала дорогое",
];

export const SortPopup: React.FC<Props> = ({ className }) => {
    const [currentSortIndex, setCurrentSortIndex] = useState(0);
    
    const handleSortChange = () => {
        setCurrentSortIndex((prevIndex) => (prevIndex + 1) % SORT_OPTIONS.length);
    };

    return (
        <div 
            className={cn('inline-flex items-center gap-2 bg-gray-200 px-5 h-[52px] rounded-2xl cursor-pointer', className)}
            onClick={handleSortChange}
        >
            <ArrowUpDown size={16} />
            <b>Сортировка:</b>
            <b className="text-primary">{SORT_OPTIONS[currentSortIndex]}</b>
        </div>
    );
};