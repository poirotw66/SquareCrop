import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Download, Trash2, X, Scissors, Image as ImageIcon, Check, MousePointer2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Selection {
  id: string;
  x: number;
  y: number;
  size: number;
}

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentSquare, setCurrentSquare] = useState<Selection | null>(null);
  const [mode, setMode] = useState<'select' | 'move'>('select');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [crops, setCrops] = useState<{ id: string; dataUrl: string }[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle image upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setImageName(file.name.split('.')[0]);
          setSelections([]);
          setCrops([]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  } as any);

  // Draw canvas
  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw existing selections
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    selections.forEach((sel) => {
      const isHovered = hoveredId === sel.id;
      const isDragging = draggingId === sel.id;
      
      ctx.strokeStyle = isDragging ? '#3b82f6' : (isHovered ? '#10b981' : '#10b981'); // blue-500 if dragging
      ctx.lineWidth = isDragging || isHovered ? 3 : 2;
      ctx.setLineDash([]);
      
      ctx.strokeRect(sel.x, sel.y, sel.size, sel.size);
      // Add a semi-transparent fill
      ctx.fillStyle = isDragging ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.1)';
      ctx.fillRect(sel.x, sel.y, sel.size, sel.size);
      
      // Draw 9-grid (Rule of Thirds)
      ctx.strokeStyle = isDragging ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1;
      const third = sel.size / 3;
      
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(sel.x + third, sel.y);
      ctx.lineTo(sel.x + third, sel.y + sel.size);
      ctx.moveTo(sel.x + 2 * third, sel.y);
      ctx.lineTo(sel.x + 2 * third, sel.y + sel.size);
      // Horizontal lines
      ctx.moveTo(sel.x, sel.y + third);
      ctx.lineTo(sel.x + sel.size, sel.y + third);
      ctx.moveTo(sel.x, sel.y + 2 * third);
      ctx.lineTo(sel.x + sel.size, sel.y + 2 * third);
      ctx.stroke();

      // Draw ID label
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px Inter';
      ctx.fillText(`CROP`, sel.x + 5, sel.y + 15);

      // Draw resize handles if hovered or selected in move mode
      if (mode === 'move' && (isHovered || isDragging || resizingId === sel.id)) {
        const handleSize = 8;
        ctx.fillStyle = isDragging || resizingId === sel.id ? '#3b82f6' : '#10b981';
        ctx.setLineDash([]);
        
        // TL
        ctx.fillRect(sel.x - handleSize/2, sel.y - handleSize/2, handleSize, handleSize);
        // TR
        ctx.fillRect(sel.x + sel.size - handleSize/2, sel.y - handleSize/2, handleSize, handleSize);
        // BL
        ctx.fillRect(sel.x - handleSize/2, sel.y + sel.size - handleSize/2, handleSize, handleSize);
        // BR
        ctx.fillRect(sel.x + sel.size - handleSize/2, sel.y + sel.size - handleSize/2, handleSize, handleSize);
      }
    });

    // Draw current drawing square
    if (currentSquare) {
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentSquare.x, currentSquare.y, currentSquare.size, currentSquare.size);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(currentSquare.x, currentSquare.y, currentSquare.size, currentSquare.size);

      // Draw 9-grid for current square
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.2)';
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      const third = currentSquare.size / 3;
      ctx.beginPath();
      ctx.moveTo(currentSquare.x + third, currentSquare.y);
      ctx.lineTo(currentSquare.x + third, currentSquare.y + currentSquare.size);
      ctx.moveTo(currentSquare.x + 2 * third, currentSquare.y);
      ctx.lineTo(currentSquare.x + 2 * third, currentSquare.y + currentSquare.size);
      ctx.moveTo(currentSquare.x, currentSquare.y + third);
      ctx.lineTo(currentSquare.x + currentSquare.size, currentSquare.y + third);
      ctx.moveTo(currentSquare.x, currentSquare.y + 2 * third);
      ctx.lineTo(currentSquare.x + currentSquare.size, currentSquare.y + 2 * third);
      ctx.stroke();
    }
  }, [image, selections, currentSquare]);

  // Handle mouse events for selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (mode === 'move') {
      const handleThreshold = 15;
      
      // Check for handles first
      for (const sel of [...selections].reverse()) {
        const handles = [
          { type: 'tl' as const, x: sel.x, y: sel.y },
          { type: 'tr' as const, x: sel.x + sel.size, y: sel.y },
          { type: 'bl' as const, x: sel.x, y: sel.y + sel.size },
          { type: 'br' as const, x: sel.x + sel.size, y: sel.y + sel.size },
        ];
        
        const hitHandle = handles.find(h => 
          Math.abs(x - h.x) < handleThreshold && Math.abs(y - h.y) < handleThreshold
        );
        
        if (hitHandle) {
          setResizingId(sel.id);
          setResizeHandle(hitHandle.type);
          return;
        }
      }

      // Find if we clicked inside a selection
      const clickedSel = [...selections].reverse().find(sel => 
        x >= sel.x && x <= sel.x + sel.size &&
        y >= sel.y && y <= sel.y + sel.size
      );
      
      if (clickedSel) {
        setDraggingId(clickedSel.id);
        setDragOffset({ x: x - clickedSel.x, y: y - clickedSel.y });
      }
    } else {
      setIsDrawing(true);
      setStartPos({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (mode === 'move') {
      if (resizingId && resizeHandle) {
        setSelections(prev => prev.map(sel => {
          if (sel.id === resizingId) {
            let anchorX = sel.x;
            let anchorY = sel.y;
            
            if (resizeHandle === 'br') { anchorX = sel.x; anchorY = sel.y; }
            else if (resizeHandle === 'tl') { anchorX = sel.x + sel.size; anchorY = sel.y + sel.size; }
            else if (resizeHandle === 'tr') { anchorX = sel.x; anchorY = sel.y + sel.size; }
            else if (resizeHandle === 'bl') { anchorX = sel.x + sel.size; anchorY = sel.y; }
            
            const dx = x - anchorX;
            const dy = y - anchorY;
            const size = Math.max(5, Math.max(Math.abs(dx), Math.abs(dy)));
            
            // Re-calculate top-left based on anchor and direction
            const newX = dx >= 0 ? anchorX : anchorX - size;
            const newY = dy >= 0 ? anchorY : anchorY - size;
            
            // Constrain to image bounds
            const finalX = Math.max(0, Math.min(newX, canvas.width - size));
            const finalY = Math.max(0, Math.min(newY, canvas.height - size));
            const finalSize = Math.min(size, Math.min(canvas.width - finalX, canvas.height - finalY));
            
            return { ...sel, x: finalX, y: finalY, size: finalSize };
          }
          return sel;
        }));
      } else if (draggingId) {
        const offset = dragOffset || { x: 0, y: 0 };
        setSelections(prev => prev.map(sel => {
          if (sel.id === draggingId) {
            // Constrain to image bounds
            let newX = x - offset.x;
            let newY = y - offset.y;
            newX = Math.max(0, Math.min(newX, canvas.width - sel.size));
            newY = Math.max(0, Math.min(newY, canvas.height - sel.size));
            return { ...sel, x: newX, y: newY };
          }
          return sel;
        }));
      } else {
        // Handle hover state
        const hovered = [...selections].reverse().find(sel => 
          x >= sel.x && x <= sel.x + sel.size &&
          y >= sel.y && y <= sel.y + sel.size
        );
        setHoveredId(hovered?.id || null);
      }
    } else if (isDrawing && startPos) {
      // Calculate square size (force square aspect ratio)
      const dx = x - startPos.x;
      const dy = y - startPos.y;
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      
      // Determine top-left corner based on drag direction
      const squareX = dx >= 0 ? startPos.x : startPos.x - size;
      const squareY = dy >= 0 ? startPos.y : startPos.y - size;
      
      setCurrentSquare({
        id: Math.random().toString(36).substr(2, 9),
        x: squareX,
        y: squareY,
        size: size
      });
    }
  };

  const handleMouseUp = () => {
    if (mode === 'move') {
      if (draggingId || resizingId) {
        const targetId = draggingId || resizingId;
        const movedSel = selections.find(s => s.id === targetId);
        if (movedSel) {
          updateCrop(movedSel);
        }
      }
      setDraggingId(null);
      setResizingId(null);
      setResizeHandle(null);
      setDragOffset(null);
    } else {
      if (isDrawing && currentSquare && currentSquare.size > 5) {
        setSelections(prev => [...prev, currentSquare]);
        generateCrop(currentSquare);
      }
      setIsDrawing(false);
      setStartPos(null);
      setCurrentSquare(null);
    }
  };

  // Update specific crop
  const updateCrop = (selection: Selection) => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const scaleX = image.naturalWidth / canvas.width;
    const scaleY = image.naturalHeight / canvas.height;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 256;
    offscreenCanvas.height = 256;
    const ctx = offscreenCanvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(
        image,
        selection.x * scaleX,
        selection.y * scaleY,
        selection.size * scaleX,
        selection.size * scaleY,
        0,
        0,
        256,
        256
      );
      
      const dataUrl = offscreenCanvas.toDataURL('image/png');
      setCrops(prev => prev.map(c => c.id === selection.id ? { ...c, dataUrl } : c));
    }
  };

  // Generate 256x256 crop
  const generateCrop = (selection: Selection) => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const scaleX = image.naturalWidth / canvas.width;
    const scaleY = image.naturalHeight / canvas.height;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 256;
    offscreenCanvas.height = 256;
    const ctx = offscreenCanvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(
        image,
        selection.x * scaleX,
        selection.y * scaleY,
        selection.size * scaleX,
        selection.size * scaleY,
        0,
        0,
        256,
        256
      );
      
      const dataUrl = offscreenCanvas.toDataURL('image/png');
      setCrops(prev => [...prev, { id: selection.id, dataUrl }]);
    }
  };

  const removeSelection = (id: string) => {
    setSelections(prev => prev.filter(s => s.id !== id));
    setCrops(prev => prev.filter(c => c.id !== id));
  };

  const clearAll = () => {
    setSelections([]);
    setCrops([]);
  };

  const downloadAll = async () => {
    if (crops.length === 0) return;
    
    if (crops.length === 1) {
      saveAs(crops[0].dataUrl, `${imageName}_crop.png`);
      return;
    }

    const zip = new JSZip();
    crops.forEach((crop, index) => {
      const base64Data = crop.dataUrl.split(',')[1];
      zip.file(`${imageName}_crop_${index + 1}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${imageName}_crops.zip`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Scissors size={20} />
          </div>
          <div>
            <h1 className="font-bold text-xl leading-tight tracking-tight">SquareCrop</h1>
            <p className="text-[10px] text-black/40 uppercase font-black tracking-[0.2em]">Image Batch Processor</p>
          </div>
        </div>
        
        {image && (
          <div className="flex items-center gap-3">
            <button 
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-50 text-red-600 transition-all active:scale-95"
            >
              <Trash2 size={16} />
              清除全部
            </button>
            <button 
              onClick={downloadAll}
              disabled={crops.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-200 active:scale-95"
            >
              <Download size={16} />
              下載全部 ({crops.length})
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Editor Area */}
        <div className="space-y-6">
          {!image ? (
            <div 
              {...getRootProps()} 
              className={cn(
                "aspect-video rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-6 transition-all cursor-pointer group",
                isDragActive ? "border-emerald-500 bg-emerald-50/50" : "border-black/10 bg-white hover:border-emerald-500/30 hover:bg-emerald-50/20"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-500 ease-out">
                <Upload size={36} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-bold tracking-tight">拖放圖片到這裡</p>
                <p className="text-sm text-black/40 font-medium">或點擊選擇檔案 (支援 JPG, PNG, WebP)</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-black/5 shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                      <ImageIcon size={18} />
                    </div>
                    <span className="font-bold text-sm tracking-tight">{imageName}</span>
                  </div>
                  
                  {/* Mode Switcher */}
                  <div className="flex items-center bg-[#f5f5f5] p-1 rounded-xl border border-black/5">
                    <button
                      onClick={() => setMode('select')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                        mode === 'select' ? "bg-white text-emerald-600 shadow-sm" : "text-black/40 hover:text-black/60"
                      )}
                    >
                      <Scissors size={14} />
                      框選模式
                    </button>
                    <button
                      onClick={() => setMode('move')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                        mode === 'move' ? "bg-white text-blue-600 shadow-sm" : "text-black/40 hover:text-black/60"
                      )}
                    >
                      <MousePointer2 size={14} />
                      調整模式
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => setImage(null)}
                  className="p-2 hover:bg-red-50 rounded-xl transition-colors text-black/30 hover:text-red-500"
                >
                  <X size={18} />
                </button>
              </div>

              <div 
                ref={containerRef}
                className="relative bg-white rounded-[2.5rem] border border-black/5 p-6 shadow-sm overflow-hidden flex items-center justify-center min-h-[500px]"
              >
                <canvas
                  ref={canvasRef}
                  width={image.naturalWidth > 1200 ? 1200 : image.naturalWidth}
                  height={(image.naturalHeight / image.naturalWidth) * (image.naturalWidth > 1200 ? 1200 : image.naturalWidth)}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    setHoveredId(null);
                    if (draggingId) handleMouseUp();
                  }}
                  className={cn(
                    "max-w-full h-auto rounded-xl shadow-2xl shadow-black/5 bg-[#fafafa] transition-all",
                    mode === 'select' ? "cursor-crosshair" : "cursor-default"
                  )}
                />
                
                {selections.length === 0 && !isDrawing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="bg-[#1a1a1a]/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-3 animate-bounce">
                      {mode === 'select' ? <Scissors size={16} className="text-emerald-400" /> : <MousePointer2 size={16} className="text-blue-400" />}
                      {mode === 'select' ? "在圖片上點擊並拖動來框選正方形" : "點擊並拖動已有的框來調整位置"}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-6 text-[10px] text-black/40 font-black uppercase tracking-[0.2em] px-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                  <span>已選取區域</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-black/20" />
                  <span>拖動中</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar / Preview Area */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-black/5 p-8 shadow-sm min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-lg tracking-tight">截取預覽 <span className="text-black/30 font-medium">(256x256)</span></h2>
              <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm shadow-emerald-200">
                {crops.length}
              </span>
            </div>

            {crops.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-black/20">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-black/5 flex items-center justify-center">
                  <Scissors size={32} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-bold tracking-tight">尚未有任何截取<br/><span className="font-medium opacity-60">請在左側框選區域</span></p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[calc(100vh-320px)] pr-2 custom-scrollbar">
                {crops.map((crop) => (
                  <div key={crop.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-black/5 bg-[#f9f9f9] shadow-sm hover:shadow-md transition-all">
                    <img 
                      src={crop.dataUrl} 
                      alt="Crop preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-emerald-500/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                      <button 
                        onClick={() => removeSelection(crop.id)}
                        className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 hover:scale-110 active:scale-90 transition-all shadow-lg"
                        title="刪除"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button 
                        onClick={() => saveAs(crop.dataUrl, `${imageName}_crop_${crop.id.slice(0,4)}.png`)}
                        className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 hover:scale-110 active:scale-90 transition-all shadow-lg"
                        title="下載"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {crops.length > 0 && (
              <div className="mt-8 pt-8 border-t border-black/5">
                <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-6">
                  <Check size={14} />
                  <span>Auto-scaled to 256x256</span>
                </div>
                <button 
                  onClick={downloadAll}
                  className="w-full py-4 rounded-2xl bg-[#1a1a1a] text-white text-sm font-bold hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/10 active:scale-95"
                >
                  <Download size={18} />
                  打包下載 ZIP
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-[#1a1a1a] rounded-[2rem] p-8 text-white space-y-5 shadow-xl shadow-black/5">
            <h3 className="font-bold text-sm flex items-center gap-3 text-emerald-400">
              <Scissors size={16} />
              操作指南
            </h3>
            <ul className="text-xs space-y-3 font-medium text-white/60">
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">01</span>
                <span>點擊並拖動滑鼠來框選區域</span>
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">02</span>
                <span>系統會自動強制正方形比例</span>
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">03</span>
                <span>可以連續框選多個不同位置</span>
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">04</span>
                <span>點擊預覽圖上的垃圾桶可刪除</span>
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">05</span>
                <span>點擊「下載全部」可取得 ZIP 檔</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.1);
        }
      `}} />
    </div>
  );
}
