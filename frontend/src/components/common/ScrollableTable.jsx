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
    <div className={`relative group/scroll ${className}`}>
      {/* Scrollable Container */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className="w-full overflow-x-auto overflow-y-visible no-scrollbar selection:bg-emerald-100"
      >
        {children}
      </div>

      {/* Floating Left Button */}
      {showLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 active:scale-95 transition-all duration-300 opacity-0 group-hover/scroll:opacity-100"
          aria-label="Scroll Left"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
      )}

      {/* Floating Right Button */}
      {showRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 active:scale-95 transition-all duration-300 opacity-0 group-hover/scroll:opacity-100"
          aria-label="Scroll Right"
        >
          <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      )}

      {/* Edge Indicator Gradients */}
      {showLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white/30 to-transparent pointer-events-none z-10 transition-opacity duration-300" />
      )}
      {showRight && (
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white/30 to-transparent pointer-events-none z-10 transition-opacity duration-300" />
      )}
    </div>
  );
};

export default ScrollableTable;
