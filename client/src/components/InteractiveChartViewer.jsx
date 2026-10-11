import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLibRaw from 'pdfjs-dist/build/pdf.js';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
  Download,
  Eye
} from 'lucide-react';

// Configure PDF.js worker
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw;
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfjsWorker || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
}

export function InteractiveChartViewer({
  pdfUrl,
  chartName = 'Airport Chart',
  fallbackUrl = null
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // PDF Document State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // Viewport Transform State
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isNightMode, setIsNightMode] = useState(false);

  // Drag / Pan Tracking State
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStartRef = useRef({ x: 0, y: 0, dist: 0, initialZoom: 1.0 });

  // Original unscaled dimensions of rendered page
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // 1. Load PDF Document whenever pdfUrl changes
  useEffect(() => {
    if (!pdfUrl) return;

    let isCancelled = false;
    setLoading(true);
    setError(null);
    setUseIframeFallback(false);
    setCurrentPage(1);

    const loadDoc = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages || 1);
        setLoading(false);
      } catch (err) {
        if (isCancelled) return;
        console.warn('[ChartViewer] PDF.js rendering error, enabling iframe fallback:', err.message);
        setError(err.message || 'Failed to render PDF with canvas engine');
        setLoading(false);
        setUseIframeFallback(true);
      }
    };

    loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  // 2. Render Current Page onto High-DPI Canvas
  useEffect(() => {
    if (!pdfDoc || useIframeFallback) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (_) {}
          renderTaskRef.current = null;
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        // Base render resolution (2.0x scale provides crisp text and fine detail on zoom)
        const renderScale = 2.0;
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const displayWidth = viewport.width / renderScale;
        const displayHeight = viewport.height / renderScale;

        setPageSize({ width: displayWidth, height: displayHeight });

        // Initial auto-fit pan & zoom if resetting
        const container = containerRef.current;
        if (container) {
          const containerWidth = container.clientWidth || 800;
          const containerHeight = container.clientHeight || 800;
          // Calculate scale to fit page comfortably with padding
          const fitScale = Math.min(
            (containerWidth - 32) / displayWidth,
            (containerHeight - 32) / displayHeight,
            1.2
          );
          setZoom(Math.max(0.6, fitScale));
          setPan({ x: 0, y: 0 });
        }

        const renderContext = {
          canvasContext: ctx,
          viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.warn('[ChartViewer] Canvas render failed:', err.message);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (_) {}
      }
    };
  }, [pdfDoc, currentPage, useIframeFallback]);

  // 3. Zoom towards Cursor on Wheel Scroll
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Smooth zoom multiplier based on delta
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.4), 5.0);

        setPan((prevPan) => {
          const dx = mouseX - (rect.width / 2 + prevPan.x);
          const dy = mouseY - (rect.height / 2 + prevPan.y);
          const factor = nextZoom / prevZoom;
          return {
            x: prevPan.x - dx * (factor - 1),
            y: prevPan.y - dy * (factor - 1)
          };
        });

        return nextZoom;
      });
    },
    []
  );

  // Attach native non-passive wheel listener to allow preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // 4. Click-and-Drag Panning (Mouse)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Primary left button only
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 5. Touch Gestures (Mobile & Tablet: 1-finger pan, 2-finger pinch-zoom)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = {
        x: touch.clientX - pan.x,
        y: touch.clientY - pan.y
      };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      touchStartRef.current = {
        dist,
        initialZoom: zoom
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y
      });
    } else if (e.touches.length === 2 && touchStartRef.current.dist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchStartRef.current.dist;
      setZoom(Math.min(Math.max(touchStartRef.current.initialZoom * ratio, 0.4), 5.0));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // 6. Double Click / Double Tap to Toggle Zoom
  const handleDoubleClick = (e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (zoom > 1.4) {
      // Reset zoom to 1.0 centered
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
    } else {
      // Zoom in to 2.2x centered on clicked point
      const nextZoom = 2.2;
      const dx = mouseX - (rect.width / 2 + pan.x);
      const dy = mouseY - (rect.height / 2 + pan.y);
      const factor = nextZoom / zoom;
      setPan({
        x: pan.x - dx * (factor - 1),
        y: pan.y - dy * (factor - 1)
      });
      setZoom(nextZoom);
    }
  };

  // Reset View Actions
  const handleReset = () => {
    const container = containerRef.current;
    if (container && pageSize.width > 0) {
      const containerWidth = container.clientWidth || 800;
      const containerHeight = container.clientHeight || 800;
      const fitScale = Math.min(
        (containerWidth - 32) / pageSize.width,
        (containerHeight - 32) / pageSize.height,
        1.1
      );
      setZoom(Math.max(0.6, fitScale));
    } else {
      setZoom(1.0);
    }
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleFitWidth = () => {
    const container = containerRef.current;
    if (container && pageSize.width > 0) {
      const containerWidth = container.clientWidth - 40;
      const fitScale = containerWidth / pageSize.width;
      setZoom(Math.max(0.6, Math.min(fitScale, 3.0)));
      setPan({ x: 0, y: 0 });
    }
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z * 1.25, 5.0));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z * 0.8, 0.4));
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none relative">
      {/* Interactive Controls Toolbar */}
      <div className="px-3 py-2 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between font-mono text-xs z-20 flex-wrap gap-2">
        {/* Left: Zoom Controls & Presets */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition"
            title="Zoom Out (Mouse Wheel Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 py-0.5 text-[11px] font-bold text-cyan-400 bg-slate-900 border border-slate-800 rounded min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition"
            title="Zoom In (Mouse Wheel Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-[11px] border border-slate-800 transition hidden sm:inline-flex"
            title="Fit Page to View"
          >
            Fit Page
          </button>

          <button
            type="button"
            onClick={handleFitWidth}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-[11px] border border-slate-800 transition hidden md:inline-flex"
            title="Fit Width"
          >
            Fit Width
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center space-x-1"
            title={`Rotate 90° Clockwise (Current: ${rotation}°)`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            {rotation !== 0 && <span className="text-[10px] text-cyan-400">{rotation}°</span>}
          </button>

          <button
            type="button"
            onClick={() => setIsNightMode((v) => !v)}
            className={`p-1.5 rounded border transition flex items-center space-x-1 ${
              isNightMode
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={isNightMode ? 'Cockpit Night Mode (Inverted): ON' : 'Cockpit Night Mode: OFF'}
          >
            {isNightMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="text-[10px] hidden sm:inline">Night</span>
          </button>
        </div>

        {/* Right: Page Navigation & Fallback Toggle */}
        <div className="flex items-center space-x-1.5">
          {numPages > 1 && (
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-slate-300">
                {currentPage} / {numPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
                className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Toggle Native / Canvas Viewer */}
          <button
            type="button"
            onClick={() => setUseIframeFallback((v) => !v)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] border border-slate-800 transition"
            title="Switch between Canvas Viewer and Native PDF Viewer"
          >
            {useIframeFallback ? 'Canvas Mode' : 'Native View'}
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {useIframeFallback ? (
        <iframe
          src={pdfUrl}
          title={chartName}
          className="w-full h-full border-none bg-slate-950"
        />
      ) : (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          className={`flex-1 w-full h-full overflow-hidden relative flex items-center justify-center bg-slate-950 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ touchAction: 'none' }}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-10 text-slate-400 font-mono text-xs space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Rendering Chart Plate...</span>
            </div>
          )}

          {/* Transformable Canvas Container */}
          <div
            className="transition-transform duration-75 ease-out will-change-transform shadow-2xl rounded-sm"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              filter: isNightMode
                ? 'invert(0.92) hue-rotate(180deg) brightness(0.92) contrast(1.15)'
                : 'none'
            }}
          >
            <canvas
              ref={canvasRef}
              className="block bg-white shadow-xl pointer-events-none rounded-sm"
              style={{
                maxWidth: 'none',
                width: pageSize.width > 0 ? `${pageSize.width}px` : 'auto',
                height: pageSize.height > 0 ? `${pageSize.height}px` : 'auto'
              }}
            />
          </div>

          {/* Interactive Hint Overlay */}
          <div className="absolute bottom-2 right-3 pointer-events-none text-[10px] font-mono text-slate-500/70 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800/40 hidden sm:block">
            Scroll to Zoom • Drag to Pan • Double-click to Toggle
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractiveChartViewer;
