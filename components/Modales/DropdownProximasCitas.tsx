import { motion, AnimatePresence } from 'framer-motion'
import { CalendarClock, CalendarIcon } from 'lucide-react'

export default function DropdownProximasCitas({ abierto, setAbierto, cerrarOtro, citas }: any) {
  return (
    <div className="relative shrink-0">
      <button 
        onClick={() => {
          setAbierto(!abierto);
          cerrarOtro(false);
        }}
        className={`flex items-center gap-1 px-1.5 py-1 rounded-md font-black text-[8px] uppercase tracking-wide transition-all shadow-sm border ${abierto ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
      >
        <CalendarClock size={10} className={abierto ? "text-[#C9A24B]" : "text-slate-400"} /> 
        <span className="hidden xl:inline">Próximas Citas</span>
        {citas.length > 0 && (
          <span className="bg-[#C9A24B] text-white px-1 py-0.5 rounded-full text-[8px] shadow-sm">
            {citas.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {abierto && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)}></div>
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 10, scale: 0.95 }} 
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-3 w-[280px] bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                <h3 className="text-[10px] font-black text-[#C9A24B] uppercase tracking-widest flex items-center gap-1.5">
                  <CalendarClock size={14}/> Citas Agendadas
                </h3>
              </div>
              <div className="p-3 flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {citas.length > 0 ? citas.map((cita: any, idx: number) => (
                  <div key={cita.id} className={`p-3 rounded-xl flex flex-col gap-2 ${idx === 0 ? 'bg-[#C9A24B] text-white shadow-md' : 'bg-white/5 text-slate-300 border border-white/5'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${idx === 0 ? 'text-white' : 'text-slate-200'}`}>
                          {new Date(cita.inicio).toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${idx === 0 ? 'bg-black/20 text-white' : 'bg-black/40 text-white/70'}`}>
                        {new Date(cita.inicio).toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'})} hrs
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-[9px] font-bold uppercase truncate max-w-[130px] ${idx === 0 ? 'text-white/90' : 'text-slate-400'}`}>
                        {cita.motivo || 'CONSULTA'}
                      </span>
                      <span className={`text-[8px] font-black uppercase tracking-wider ${idx === 0 ? 'text-white/80' : 'text-slate-500'}`}>
                        {cita.profesional_nombre}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
                    <CalendarIcon size={32} className="text-white/10" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">El paciente no tiene<br/>citas futuras</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}