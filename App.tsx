import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BlockType, 
  Routine, 
  StepBlock, 
  NavigatorState, 
  HistoryEntry,
  ViewName
} from './types';

// --- UTILS & HELPERS ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Robust Audio Context Beeper
const playSound = (type: 'tick' | 'start' | 'end') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === 'tick') {
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'start') {
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'end') {
      // Success chord
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now); // E5
      gain2.gain.setValueAtTime(0.5, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 1);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 1);
      osc2.stop(now + 1);
    }
  } catch (e) {
    console.error("Audio error", e);
  }
};

const sendNotification = (title: string, body: string) => {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.png' });
  }
};

const getBlockColor = (type: BlockType) => {
  switch (type) {
    case BlockType.WORK: return 'text-blue-500 bg-blue-500/10 border-l-blue-500';
    case BlockType.REST: return 'text-emerald-500 bg-emerald-500/10 border-l-emerald-500';
    case BlockType.PREP: return 'text-orange-500 bg-orange-500/10 border-l-orange-500';
    default: return 'text-pink-500 bg-pink-500/10 border-l-pink-500';
  }
};

const getBlockIcon = (type: BlockType) => {
  switch (type) {
    case BlockType.WORK: return 'fitness_center';
    case BlockType.REST: return 'snooze';
    case BlockType.PREP: return 'self_improvement';
    default: return 'timer';
  }
};

// Initial Seed Data
const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'r1',
    name: 'Entrenamiento Tabata',
    totalDuration: 240,
    lastPlayed: Date.now() - 86400000,
    coverImage: 'https://picsum.photos/seed/tabata/400/200',
    blocks: [
      { id: 'b1', name: 'Calentamiento', duration: 60, type: BlockType.PREP },
      { id: 'b2', name: 'Sprints', duration: 20, type: BlockType.WORK },
      { id: 'b3', name: 'Descanso', duration: 10, type: BlockType.REST },
      { id: 'b4', name: 'Sprints', duration: 20, type: BlockType.WORK },
      { id: 'b5', name: 'Descanso', duration: 10, type: BlockType.REST },
      { id: 'b6', name: 'Enfriamiento', duration: 90, type: BlockType.REST },
    ]
  },
  {
    id: 'r2',
    name: 'Pomodoro Estudio',
    totalDuration: 1800,
    coverImage: 'https://picsum.photos/seed/study/400/200',
    blocks: [
      { id: 'p1', name: 'Enfoque', duration: 1500, type: BlockType.WORK },
      { id: 'p2', name: 'Descanso', duration: 300, type: BlockType.REST },
    ]
  }
];

// --- COMPONENTS ---

// 1. HOME SCREEN
const HomeScreen = ({ 
  routines, 
  onNavigate, 
  onDelete,
  onStart,
  hasActiveSession
}: { 
  routines: Routine[], 
  onNavigate: (view: NavigatorState['currentView'], data?: any) => void,
  onDelete: (id: string) => void,
  onStart: (r: Routine) => void,
  hasActiveSession: boolean
}) => {
  return (
    <div className={`flex flex-col h-full bg-background overflow-y-auto no-scrollbar ${hasActiveSession ? 'pb-32' : 'pb-24'}`}>
      {/* Header */}
      <header className="px-6 pt-12 pb-6 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-3xl filled">timer</span>
            <span className="font-bold text-xl tracking-tight text-white">Cronos</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">Hola, Usuario</h1>
        <p className="text-gray-400 font-medium">¿Listo para enfocarte hoy?</p>
      </header>

      {/* CTA New Routine */}
      <div className="px-6 mb-8">
        <div 
          onClick={() => onNavigate('EDITOR')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 border border-white/10 p-6 shadow-2xl cursor-pointer active:scale-95 transition-transform"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Nueva Rutina</h2>
              <p className="text-blue-200 text-xs">Diseña tu flujo perfecto</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-white">add</span>
            </div>
          </div>
        </div>
      </div>

      {/* Routine List */}
      <div className="px-6 flex-1">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-white">Mis Rutinas</h3>
        </div>

        <div className="flex flex-col gap-5">
          {routines.map(routine => (
            <div key={routine.id} className="group relative bg-surface rounded-2xl p-4 border border-white/5 hover:border-primary/30 transition-all hover:shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getBlockColor(routine.blocks[0]?.type || BlockType.OTHER).split(' ')[1]} ${getBlockColor(routine.blocks[0]?.type || BlockType.OTHER).split(' ')[0]}`}>
                    <span className="material-symbols-outlined">{getBlockIcon(routine.blocks[0]?.type || BlockType.OTHER)}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg leading-tight">{routine.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="material-symbols-outlined text-gray-500 text-sm">schedule</span>
                      <span className="text-xs text-gray-400 font-medium">{Math.ceil(routine.totalDuration / 60)} min</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                   <button 
                      onClick={(e) => { e.stopPropagation(); onNavigate('EDITOR', routine); }}
                      className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400"
                    >
                       <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button 
                       onClick={(e) => { e.stopPropagation(); onDelete(routine.id); }}
                       className="w-8 h-8 rounded-full hover:bg-red-500/10 flex items-center justify-center text-gray-400 hover:text-red-500"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
              </div>

              {/* Cover Image Area */}
              <div className="relative w-full h-32 rounded-xl overflow-hidden mt-2 group-hover:opacity-90 transition-opacity">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10"></div>
                <img src={routine.coverImage || `https://picsum.photos/seed/${routine.id}/400/200`} alt="cover" className="w-full h-full object-cover" />
                
                <button 
                  onClick={() => onStart(routine)}
                  className="absolute bottom-3 right-3 z-20 bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
                >
                  Iniciar <span className="material-symbols-outlined text-lg filled">play_arrow</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 2. EDITOR SCREEN
const EditorScreen = ({ 
  routineToEdit, 
  onSave, 
  onCancel 
}: { 
  routineToEdit?: Routine, 
  onSave: (r: Routine) => void, 
  onCancel: () => void 
}) => {
  const [name, setName] = useState(routineToEdit?.name || '');
  const [blocks, setBlocks] = useState<StepBlock[]>(routineToEdit?.blocks || []);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const totalDuration = blocks.reduce((acc, b) => acc + b.duration, 0);

  const addBlock = () => {
    const newBlock: StepBlock = {
      id: generateId(),
      name: 'Nuevo Bloque',
      duration: 60,
      type: BlockType.WORK
    };
    setBlocks([...blocks, newBlock]);
    setEditingBlockId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<StepBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (editingBlockId === id) setEditingBlockId(null);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === blocks.length - 1)) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  const handleSave = () => {
    if (!name.trim() || blocks.length === 0) return;
    const routine: Routine = {
      id: routineToEdit?.id || generateId(),
      name,
      totalDuration,
      blocks,
      lastPlayed: routineToEdit?.lastPlayed,
      coverImage: routineToEdit?.coverImage
    };
    onSave(routine);
  };

  return (
    <div className="flex flex-col h-full bg-background relative z-20">
      <div className="flex items-center justify-between p-4 bg-background/95 backdrop-blur-md sticky top-0 z-20 border-b border-white/5">
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-surface text-gray-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="font-bold text-white">{routineToEdit ? 'Editar Rutina' : 'Nueva Rutina'}</h2>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 no-scrollbar">
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Nombre</label>
          <div className="relative">
             <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-4 text-xl font-bold text-white focus:outline-none focus:border-primary transition-all"
              placeholder="Ej: Entrenamiento de Fuerza"
            />
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary">edit</span>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined">timer</span>
            <span className="font-bold">Duración Total</span>
          </div>
          <span className="font-mono text-xl font-bold text-white">{formatTime(totalDuration)}</span>
        </div>

        <div className="flex flex-col gap-3">
          {blocks.map((block, index) => (
            <div 
              key={block.id}
              onClick={() => setEditingBlockId(block.id)}
              className={`relative flex items-center justify-between p-3 rounded-2xl bg-surface border-l-[6px] transition-all active:scale-[0.99] cursor-pointer ${getBlockColor(block.type).split(' ').pop()}`}
            >
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getBlockColor(block.type).replace('border', '')}`}>
                  <span className="material-symbols-outlined">{getBlockIcon(block.type)}</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-white font-bold truncate pr-2">{block.name}</span>
                  <span className={`text-xs font-bold uppercase ${getBlockColor(block.type).split(' ')[0]}`}>
                    {block.type === BlockType.WORK ? 'Trabajo' : block.type === BlockType.REST ? 'Descanso' : 'Prep'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-2">
                <span className="font-mono text-gray-400 font-medium">{formatTime(block.duration)}</span>
                <div className="h-8 w-px bg-white/10"></div>
                <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className="text-gray-500 hover:text-white disabled:opacity-30">
                     <span className="material-symbols-outlined text-lg">keyboard_arrow_up</span>
                  </button>
                  <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30">
                     <span className="material-symbols-outlined text-lg">keyboard_arrow_down</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addBlock} className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-gray-500 font-bold hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">add_circle</span> Agregar Bloque
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent z-20">
        <button onClick={handleSave} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95">
          Guardar Rutina
        </button>
      </div>

      {editingBlockId && (() => {
        const block = blocks.find(b => b.id === editingBlockId);
        if (!block) return null;
        return (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="w-full max-w-md bg-surface-highlight rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Editar Bloque</h3>
                <button onClick={() => setEditingBlockId(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                  <span className="material-symbols-outlined text-white">close</span>
                </button>
              </div>
              <div className="mb-6">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[BlockType.WORK, BlockType.REST, BlockType.PREP].map(type => (
                    <button key={type} onClick={() => updateBlock(block.id, { type })} className={`py-3 rounded-xl flex flex-col items-center gap-1 border transition-all ${block.type === type ? 'bg-surface border-primary ring-1 ring-primary' : 'bg-surface/50 border-transparent opacity-60 hover:opacity-100'}`}>
                      <span className={`material-symbols-outlined ${type === BlockType.WORK ? 'text-blue-500' : type === BlockType.REST ? 'text-emerald-500' : 'text-orange-500'}`}>{getBlockIcon(type)}</span>
                      <span className="text-[10px] font-bold uppercase text-white">{type === BlockType.WORK ? 'Trabajo' : type === BlockType.REST ? 'Descanso' : 'Prep'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Nombre</label>
                 <input value={block.name} onChange={(e) => updateBlock(block.id, { name: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white font-bold focus:border-primary focus:outline-none" />
              </div>
              <div className="mb-8">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Duración (MM:SS)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input type="number" value={Math.floor(block.duration / 60)} onChange={(e) => updateBlock(block.id, { duration: (parseInt(e.target.value || '0') * 60) + (block.duration % 60) })} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-center font-mono text-2xl font-bold text-white focus:border-primary focus:outline-none" />
                    <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-500">MIN</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-500">:</span>
                  <div className="flex-1 relative">
                    <input type="number" value={block.duration % 60} onChange={(e) => { const s = Math.min(59, parseInt(e.target.value || '0')); const m = Math.floor(block.duration / 60); updateBlock(block.id, { duration: (m * 60) + s }); }} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-center font-mono text-2xl font-bold text-white focus:border-primary focus:outline-none" />
                    <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-500">SEG</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                 <button onClick={() => { const copy = { ...block, id: generateId(), name: `${block.name} (Copia)` }; setBlocks([...blocks, copy]); setEditingBlockId(null); }} className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold flex items-center justify-center gap-2"><span className="material-symbols-outlined text-sm">content_copy</span> Duplicar</button>
                 <button onClick={() => deleteBlock(block.id)} className="py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold flex items-center justify-center gap-2"><span className="material-symbols-outlined text-sm">delete</span> Eliminar</button>
              </div>
              <button onClick={() => setEditingBlockId(null)} className="w-full bg-primary hover:bg-blue-600 py-4 rounded-xl text-white font-bold">Listo</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// 3. RUNNER SCREEN
const RunnerScreen = ({ 
  routine, 
  currentBlockIndex,
  timeLeft,
  isPaused,
  onTogglePause,
  onSkip,
  onAdjustTime,
  onMinimize,
  onQuit
}: { 
  routine: Routine,
  currentBlockIndex: number,
  timeLeft: number,
  isPaused: boolean,
  onTogglePause: () => void,
  onSkip: () => void,
  onAdjustTime: (s: number) => void,
  onMinimize: () => void,
  onQuit: () => void
}) => {
  const currentBlock = routine.blocks[currentBlockIndex];
  const nextBlock = routine.blocks[currentBlockIndex + 1];

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / currentBlock.duration;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden z-30">
      <div className={`absolute inset-0 opacity-10 pointer-events-none transition-colors duration-1000 ${currentBlock.type === BlockType.WORK ? 'bg-blue-600' : currentBlock.type === BlockType.REST ? 'bg-emerald-600' : 'bg-orange-600'}`}></div>

      <div className="flex justify-between items-center p-6 relative z-10 pt-10">
        <button onClick={onMinimize} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20">
          <span className="material-symbols-outlined text-white">keyboard_arrow_down</span>
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{routine.name}</span>
        <button onClick={onQuit} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-red-400">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <div className={`mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${currentBlock.type === BlockType.WORK ? 'bg-blue-500/20 text-blue-400' : currentBlock.type === BlockType.REST ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
          {currentBlockIndex + 1} de {routine.blocks.length} • {currentBlock.type}
        </div>
        
        <h1 className="text-4xl font-bold text-white text-center px-4 leading-tight mb-8 animate-slide-up">
          {currentBlock.name}
        </h1>

        <div className="relative mb-10">
          <svg width="300" height="300" className="transform -rotate-90">
            <circle cx="150" cy="150" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-surface-highlight" />
            <circle cx="150" cy="150" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" className={`transition-all duration-1000 ease-linear ${currentBlock.type === BlockType.WORK ? 'text-primary' : currentBlock.type === BlockType.REST ? 'text-emerald-500' : 'text-orange-500'}`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-7xl font-mono font-bold text-white tracking-tighter tabular-nums">
              {Math.floor(timeLeft / 60).toString().padStart(2,'0')}:{Math.floor(timeLeft % 60).toString().padStart(2,'0')}
            </span>
            <span className="text-xs font-bold text-gray-500 mt-2 uppercase tracking-widest">Restante</span>
          </div>
        </div>

        {nextBlock && (
          <div className="bg-surface/80 backdrop-blur-md border border-white/5 rounded-2xl p-3 flex items-center gap-3 w-64 animate-pulse-slow">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getBlockColor(nextBlock.type).replace('border', '')}`}>
              <span className="material-symbols-outlined text-lg">{getBlockIcon(nextBlock.type)}</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Siguiente</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-white truncate">{nextBlock.name}</span>
                <span className="text-xs font-mono text-gray-400">{formatTime(nextBlock.duration)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pb-12 px-6 relative z-10">
        <div className="flex justify-center gap-3 mb-8">
           <button onClick={() => onAdjustTime(-10)} className="h-10 px-4 rounded-lg bg-surface hover:bg-surface-highlight text-gray-300 text-xs font-bold transition-colors">-10s</button>
           <button onClick={() => onAdjustTime(10)} className="h-10 px-4 rounded-lg bg-surface hover:bg-surface-highlight text-gray-300 text-xs font-bold transition-colors">+10s</button>
           <button onClick={() => onAdjustTime(60)} className="h-10 px-4 rounded-lg bg-surface hover:bg-surface-highlight text-gray-300 text-xs font-bold transition-colors">+1m</button>
        </div>

        <div className="flex items-center justify-center gap-8">
          <button onClick={onSkip} className="flex flex-col items-center gap-1 group">
            <div className="w-14 h-14 rounded-full bg-surface hover:bg-surface-highlight flex items-center justify-center transition-all active:scale-95">
              <span className="material-symbols-outlined text-white text-2xl">skip_next</span>
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Saltar</span>
          </button>

          <button onClick={onTogglePause} className="relative active:scale-95 transition-transform">
            <div className="absolute inset-0 bg-primary rounded-full blur opacity-40"></div>
            <div className="relative w-24 h-24 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center shadow-2xl">
              <span className="material-symbols-outlined text-white text-5xl filled">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
            </div>
          </button>

           <button className="flex flex-col items-center gap-1 group">
            <div className="w-14 h-14 rounded-full bg-surface hover:bg-surface-highlight flex items-center justify-center transition-all active:scale-95">
              <span className="material-symbols-outlined text-white text-2xl">volume_up</span>
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Sonido</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. HISTORY SCREEN
const HistoryScreen = ({ 
  history, 
  onBack 
}: { 
  history: HistoryEntry[], 
  onBack: () => void 
}) => {
  const sorted = [...history].sort((a, b) => b.date - a.date);
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden pb-20">
      <div className="flex items-center p-4 pt-12 border-b border-white/5 bg-background z-10 sticky top-0">
        <h2 className="text-2xl font-bold text-white ml-2">Historial</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 opacity-50">
            <span className="material-symbols-outlined text-5xl mb-2">history_toggle_off</span>
            <p>No hay actividad reciente</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
             {sorted.map(entry => (
               <div key={entry.id} className="flex items-center justify-between p-4 bg-surface rounded-xl border border-white/5">
                 <div className="flex items-center gap-4">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                     <span className="material-symbols-outlined text-xl">
                       {entry.status === 'COMPLETED' ? 'check' : 'close'}
                     </span>
                   </div>
                   <div>
                     <h4 className="text-white font-bold">{entry.routineName}</h4>
                     <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <span className={`text-[10px] font-bold px-2 py-1 rounded border ${entry.status === 'COMPLETED' ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>
                     {entry.status === 'COMPLETED' ? 'COMPLETADO' : 'ABORTADO'}
                   </span>
                 </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- GLOBAL APP STATE & ORCHESTRATION ---

interface ActiveSession {
  routine: Routine;
  currentBlockIndex: number;
  endTime: number | null; // The timestamp when current block ends. Null if paused.
  remainingWhenPaused: number; // Seconds left when paused
  isPaused: boolean;
}

const App = () => {
  // Persistence
  const [routines, setRoutines] = useState<Routine[]>(() => {
    const saved = localStorage.getItem('cronos_routines');
    return saved ? JSON.parse(saved) : DEFAULT_ROUTINES;
  });
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('cronos_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Navigation
  const [currentView, setCurrentView] = useState<ViewName>('HOME');
  const [navData, setNavData] = useState<any>(null);
  const [runnerMode, setRunnerMode] = useState<'HIDDEN' | 'FULL' | 'MINI'>('HIDDEN');

  // Active Session (Global Timer State)
  const [session, setSession] = useState<ActiveSession | null>(null);

  // Wake Lock Ref
  const wakeLock = useRef<any>(null);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => { localStorage.setItem('cronos_routines', JSON.stringify(routines)); }, [routines]);
  useEffect(() => { localStorage.setItem('cronos_history', JSON.stringify(history)); }, [history]);

  // --- TIMER ENGINE ---
  useEffect(() => {
    let interval: number;

    if (session && !session.isPaused && session.endTime) {
      // Request Wake Lock if not active
      if (!wakeLock.current && 'wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').then((wl: any) => {
          wakeLock.current = wl;
        }).catch(() => {});
      }

      interval = window.setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((session.endTime! - now) / 1000);

        if (remaining <= 0) {
          // BLOCK FINISHED
          handleBlockComplete();
        } else {
          // Tick (optional UI updates or precise sync, but state update triggers render)
          // We trigger a re-render to update UI, but we don't need to store "remaining" in state for logic
          // However, to drive the React UI, we need to force update or store remaining
          setSession(prev => prev ? { ...prev } : null); // Force update
        }
      }, 200);
    } else {
      // Release Wake Lock
      if (wakeLock.current) {
        wakeLock.current.release();
        wakeLock.current = null;
      }
    }

    return () => clearInterval(interval);
  }, [session?.isPaused, session?.endTime]); // Dependencies critical for timer loop

  // --- ACTIONS ---

  const handleBlockComplete = () => {
    if (!session) return;
    
    // Notify
    playSound('end');
    const currentBlock = session.routine.blocks[session.currentBlockIndex];
    sendNotification('Bloque Terminado', `${currentBlock.name} ha finalizado.`);

    if (session.currentBlockIndex < session.routine.blocks.length - 1) {
      // Next Block
      const nextIndex = session.currentBlockIndex + 1;
      const nextBlock = session.routine.blocks[nextIndex];
      const nextDuration = nextBlock.duration;
      
      setSession({
        ...session,
        currentBlockIndex: nextIndex,
        endTime: Date.now() + nextDuration * 1000,
        remainingWhenPaused: nextDuration
      });
      
      // Beep for start
      setTimeout(() => playSound('start'), 500);

    } else {
      // Routine Complete
      const entry: HistoryEntry = {
        id: generateId(),
        routineName: session.routine.name,
        date: Date.now(),
        totalTime: session.routine.totalDuration,
        status: 'COMPLETED'
      };
      setHistory(prev => [...prev, entry]);
      setSession(null);
      setRunnerMode('HIDDEN');
      alert("¡Rutina Completada!");
    }
  };

  const startRoutine = (routine: Routine) => {
    if (Notification.permission === 'default') Notification.requestPermission();
    
    const firstBlockDuration = routine.blocks[0].duration;
    setSession({
      routine,
      currentBlockIndex: 0,
      isPaused: false,
      remainingWhenPaused: firstBlockDuration,
      endTime: Date.now() + firstBlockDuration * 1000
    });
    setRunnerMode('FULL');
    playSound('start');
  };

  const togglePause = () => {
    if (!session) return;
    if (session.isPaused) {
      // Resume
      setSession({
        ...session,
        isPaused: false,
        endTime: Date.now() + session.remainingWhenPaused * 1000
      });
    } else {
      // Pause
      const now = Date.now();
      const remaining = session.endTime ? Math.ceil((session.endTime - now) / 1000) : session.remainingWhenPaused;
      setSession({
        ...session,
        isPaused: true,
        endTime: null,
        remainingWhenPaused: remaining
      });
    }
  };

  const skipBlock = () => {
    if (!session) return;
    handleBlockComplete(); // Reuse logic
  };

  const adjustTime = (seconds: number) => {
    if (!session) return;
    const currentRem = session.isPaused 
      ? session.remainingWhenPaused 
      : Math.ceil((session.endTime! - Date.now()) / 1000);
    
    const newRem = Math.max(1, currentRem + seconds);
    
    if (session.isPaused) {
      setSession({ ...session, remainingWhenPaused: newRem });
    } else {
      setSession({ ...session, endTime: Date.now() + newRem * 1000 });
    }
  };

  const quitRoutine = () => {
    if (confirm("¿Terminar rutina?")) {
      if (session) {
        const entry: HistoryEntry = {
          id: generateId(),
          routineName: session.routine.name,
          date: Date.now(),
          totalTime: 0,
          status: 'ABORTED'
        };
        setHistory(prev => [...prev, entry]);
      }
      setSession(null);
      setRunnerMode('HIDDEN');
    }
  };

  // --- HELPERS FOR RENDER ---
  const getCurrentTimeLeft = () => {
    if (!session) return 0;
    if (session.isPaused) return session.remainingWhenPaused;
    return Math.max(0, Math.ceil((session.endTime! - Date.now()) / 1000));
  };

  return (
    <div className="w-full max-w-md mx-auto h-[100dvh] bg-background shadow-2xl relative overflow-hidden flex flex-col">
      {/* MAIN VIEW AREA */}
      <div className="flex-1 relative overflow-hidden">
        {currentView === 'HOME' && (
          <HomeScreen 
            routines={routines} 
            onNavigate={(view, data) => { setCurrentView(view); setNavData(data); }}
            onDelete={(id) => { if(confirm("¿Borrar?")) setRoutines(r => r.filter(x => x.id !== id)); }}
            onStart={startRoutine}
            hasActiveSession={!!session}
          />
        )}
        {currentView === 'EDITOR' && (
          <EditorScreen 
            routineToEdit={navData} 
            onSave={(r) => { 
              const exists = routines.find(ex => ex.id === r.id);
              if (exists) setRoutines(routines.map(ex => ex.id === r.id ? r : ex));
              else setRoutines([...routines, r]);
              setCurrentView('HOME');
            }} 
            onCancel={() => setCurrentView('HOME')} 
          />
        )}
        {currentView === 'HISTORY' && (
          <HistoryScreen history={history} onBack={() => setCurrentView('HOME')} />
        )}
      </div>

      {/* FULL SCREEN RUNNER OVERLAY */}
      {runnerMode === 'FULL' && session && (
        <div className="absolute inset-0 z-50">
          <RunnerScreen 
            routine={session.routine}
            currentBlockIndex={session.currentBlockIndex}
            timeLeft={getCurrentTimeLeft()}
            isPaused={session.isPaused}
            onTogglePause={togglePause}
            onSkip={skipBlock}
            onAdjustTime={adjustTime}
            onMinimize={() => setRunnerMode('MINI')}
            onQuit={quitRoutine}
          />
        </div>
      )}

      {/* MINI PLAYER BAR (Visible when running but minimized) */}
      {runnerMode === 'MINI' && session && (
        <div className="absolute bottom-[4.5rem] left-4 right-4 z-40">
           <div 
             onClick={() => setRunnerMode('FULL')}
             className="bg-surface-highlight border border-white/10 rounded-2xl p-3 shadow-2xl flex items-center justify-between cursor-pointer animate-slide-up"
           >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getBlockColor(session.routine.blocks[session.currentBlockIndex].type).replace('border', '')}`}>
                  <span className="material-symbols-outlined">{getBlockIcon(session.routine.blocks[session.currentBlockIndex].type)}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{session.routine.blocks[session.currentBlockIndex].name}</p>
                  <p className="text-primary font-mono font-bold text-xs">{formatTime(getCurrentTimeLeft())}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); togglePause(); }}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                >
                   <span className="material-symbols-outlined filled text-white">
                     {session.isPaused ? 'play_arrow' : 'pause'}
                   </span>
                </button>
              </div>
           </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      {runnerMode !== 'FULL' && currentView !== 'EDITOR' && (
        <div className="h-16 bg-surface/90 backdrop-blur-md border-t border-white/5 flex items-center justify-around z-30 shrink-0 pb-safe">
          <button 
            onClick={() => setCurrentView('HOME')}
            className={`flex flex-col items-center gap-1 ${currentView === 'HOME' ? 'text-primary' : 'text-gray-500'}`}
          >
            <span className={`material-symbols-outlined ${currentView === 'HOME' ? 'filled' : ''}`}>home</span>
            <span className="text-[10px] font-bold">Inicio</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('HISTORY')}
            className={`flex flex-col items-center gap-1 ${currentView === 'HISTORY' ? 'text-primary' : 'text-gray-500'}`}
          >
            <span className={`material-symbols-outlined ${currentView === 'HISTORY' ? 'filled' : ''}`}>history</span>
            <span className="text-[10px] font-bold">Historial</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;