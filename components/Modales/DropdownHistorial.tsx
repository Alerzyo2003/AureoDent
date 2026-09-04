import { motion, AnimatePresence } from 'framer-motion'
import { History } from 'lucide-react'

export default function DropdownHistorial({ abierto, setAbierto, cerrarOtro, citas }: any) {
  
  const obtenerBadgeEstado = (cita: any) => {
    const estado = cita.estado?.toLowerCase() || 'programada';
    const confirmacion = cita.estado_confirmacion?.toLowerCase() || 'pendiente';
    if (estado === 'cancelada') return { texto: 'ANULADA', clases: 'bg-red-100 text-red-700 border-red-200' };
    if (estado === 'atendida') return { texto: 'ATENDIDA', clases: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (estado === 'programada') {
      if (confirmacion === 'confirmado') return { texto: 'CONFIRMADA', clases: 'bg-blue-100 text-blue-700 border-blue-200' };
      if (confirmacion === 'enviado') return { texto: 'POR CONFIRMAR', clases: 'bg-orange-100 text-orange-700 border-orange-200' };
      return { texto: 'PROGRAMADA', clases: 'bg-slate-200 text-slate-600 border-slate-300' };
    }
    return { texto: estado.toUpperCase(), clases: 'bg-slate-200 text-slate-600 border-slate-300' };
  };

  return (
    <div className="relative shrink-0">
      <button 
        onClick={() => {
          setAbierto(!abierto);
          cerrarOtro(false);
        }}
        className={`flex items-center gap-1 px-1.5 py-1 rounded-md font-black text-[8px] uppercase tracking-wide transition-all shadow-sm border ${abierto ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
      >
        <History size={10} className={abierto ? "text-slate-300" : "text-slate-400"} /> 
        <span className="hidden xl:inline">Historial</span>
        {citas.length > 0 && (
          <span className="bg-slate-200 text-slate-700 px-1 py-0.5 rounded-full text-[8px] shadow-sm">
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
              className="absolute right-0 mt-3 w-[300px] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <History size={14}/> Citas Anteriores
                </h3>
              </div>
              <div className="p-3 flex flex-col gap-2 max-h-[340px] overflow-y-auto custom-scrollbar">
                {citas.length > 0 ? citas.map((cita: any) => {
                  const badge = obtenerBadgeEstado(cita);
                  return (
                    <div key={cita.id} className="p-3 rounded-xl flex flex-col gap-2 bg-slate-50 border border-slate-100 text-slate-600 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                            {new Date(cita.inicio).toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border w-fit shadow-sm ${badge.clases}`}>
                            {badge.texto}
                          </span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shadow-sm">
                          {new Date(cita.inicio).toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'})} hrs
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] font-bold uppercase truncate max-w-[130px] text-slate-500">
                          {cita.motivo || 'CONSULTA'}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                          {cita.profesional_nombre}
                        </span>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
                    <History size={32} className="text-slate-200" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">El paciente no tiene<br/>citas previas</p>
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