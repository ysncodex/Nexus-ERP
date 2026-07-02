import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { UsePaginationReturn } from '@/hooks/usePagination';

export interface PaginationProps {
  pagination: UsePaginationReturn;
  showPageSizeSelector?: boolean;
  showPageInfo?: boolean;
  className?: string;
}

/**
 * Reusable Pagination Component
 * Works with the usePagination hook
 * 
 * @example
 * ```tsx
 * const pagination = usePagination({ initialPageSize: 20 });
 * 
 * return (
 *   <>
 *     <YourDataDisplay data={paginatedData} />
 *     <Pagination pagination={pagination} />
 *   </>
 * );
 * ```
 */
export const Pagination = ({
  pagination,
  showPageSizeSelector = true,
  showPageInfo = true,
  className = '',
}: PaginationProps) => {
  const {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    canGoNext,
    canGoPrevious,
    goToFirstPage,
    goToPreviousPage,
    goToNextPage,
    goToLastPage,
    goToPage,
    setPageSize,
    pageSizeOptions,
    startIndex,
    endIndex,
  } = pagination;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);

      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if we're near the beginning or end
      if (currentPage <= 3) {
        end = Math.min(4, totalPages - 1);
      } else if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - 3);
      }

      // Add ellipsis if needed
      if (start > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }

      // Show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Page Info */}
      {showPageInfo && (
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-800">{totalItems > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-semibold text-slate-800">{endIndex}</span> of{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> results
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Page Size Selector */}
        {showPageSizeSelector && (
          <div className="flex items-center gap-2 mr-4">
            <label htmlFor="pageSize" className="text-sm text-slate-600">
              Show:
            </label>
            <select
              id="pageSize"
              value={pageSize >= totalItems && totalItems > 0 ? 'all' : pageSize}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  setPageSize(totalItems || 999999);
                } else {
                  setPageSize(Number(value));
                }
              }}
              className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              <option value="all">All</option>
            </select>
          </div>
        )}

        {/* Pagination Controls */}
        <nav className="flex items-center gap-1" aria-label="Pagination">
          {/* First Page */}
          <button
            onClick={goToFirstPage}
            disabled={!canGoPrevious}
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            title="First page"
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Previous Page */}
          <button
            onClick={goToPreviousPage}
            disabled={!canGoPrevious}
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page Numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {pageNumbers.map((pageNum, idx) => {
              if (pageNum === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-3 py-1.5 text-slate-400">
                    ...
                  </span>
                );
              }

              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum as number)}
                  className={`min-w-[36px] px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-white border border-amber-500'
                      : 'border border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Current Page (Mobile) */}
          <div className="sm:hidden px-3 py-1.5 text-sm font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </div>

          {/* Next Page */}
          <button
            onClick={goToNextPage}
            disabled={!canGoNext}
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>

          {/* Last Page */}
          <button
            onClick={goToLastPage}
            disabled={!canGoNext}
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            title="Last page"
          >
            <ChevronsRight size={16} />
          </button>
        </nav>
      </div>
    </div>
  );
};
