import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const ScrollableTable = ({ children, className = "" }) => {
  const containerRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScroll();

    // Efficiently handle both resize and DOM additions (important for loading tables)
    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(el);

    // Also observing children changes for dynamic content loading
    const mutationObserver = new MutationObserver(() => checkScroll());
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  const scroll = (direction) => {
    if (containerRef.current) {
      const scrollAmount = 300;
      containerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <style>
        {`
          .custom-table-scrollbar::-webkit-scrollbar {
            height: 8px;
          }
          .custom-table-scrollbar::-webkit-scrollbar-track {
            background: #F3F4F6;
            border-radius: 4px;
          }
          .custom-table-scrollbar::-webkit-scrollbar-thumb {
            background: #D1D5DB;
            border-radius: 4px;
          }
          .custom-table-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #9CA3AF;
          }
        `}
      </style>
      <div className={`relative group/scroll flex flex-col ${className}`}>
        {/* Scrollable Container */}
        <div
          ref={containerRef}
          onScroll={checkScroll}
          className="w-full overflow-x-auto overflow-y-visible custom-table-scrollbar selection:bg-emerald-100"
        >
          {children}
        </div>

        {/* Floating Left Button */}
        {showLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-[42px] h-[42px] rounded-full bg-[#073318] shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-center text-white hover:bg-[#0a4d25] hover:scale-110 active:scale-95 transition-all duration-300 opacity-0 group-hover/scroll:opacity-100 border border-white/10"
            aria-label="Scroll Left"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
        )}

        {/* Floating Right Button */}
        {showRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-[42px] h-[42px] rounded-full bg-[#073318] shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-center text-white hover:bg-[#0a4d25] hover:scale-110 active:scale-95 transition-all duration-300 opacity-0 group-hover/scroll:opacity-100 border border-white/10"
            aria-label="Scroll Right"
          >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
          </button>
        )}

        {/* Edge Indicator Gradients */}
        {showLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white/30 to-transparent pointer-events-none z-10 transition-opacity duration-300 rounded-l-[20px]" />
        )}
        {showRight && (
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white/30 to-transparent pointer-events-none z-10 transition-opacity duration-300 rounded-r-[20px]" />
        )}
      </div>
    </>
  );
};

export default ScrollableTable;
