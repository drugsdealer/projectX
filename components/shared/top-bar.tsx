import React from "react";
import { cn } from "@/lib/utils";
import { Container } from "./container" ;
import { Categories } from "./categories";
import { SortPopup } from "./sort-popup";

interface Props {
  className?: string;
  /** Показывать ли ряд основных категорий внутри TopBar */
  showCategories?: boolean;
  /** Скрыть TopBar (анимацией уезда вверх) */
  hide?: boolean;
  /** Показывать ли кнопку сортировки внутри TopBar */
  showSort?: boolean;
}

export const TopBar: React.FC<Props> = ({ className, showCategories = true, hide = false, showSort = true }) => {
    return (
        <div
          className={cn('sticky-under-header bg-white dark:bg-black py-6 shadow-lg shadow-black/0 z-[150]', className)}
        >
            <Container className="flex items-center justify-between gap-4">
              {/* Рендерим категории только при необходимости */}
              {showCategories && (
                <div className="flex-1 min-w-0">
                  <Categories mode="inline" />
                </div>
              )}
              {showSort && (
                <div className="flex-shrink-0">
                  <SortPopup />
                </div>
              )}
            </Container>
        </div>
    );
};