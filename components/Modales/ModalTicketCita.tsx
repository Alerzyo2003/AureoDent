import { motion } from 'framer-motion'
import { CheckCircle2, MessageCircle } from 'lucide-react'

export default function ModalTicketCita({ isOpen, data, onClose }: any) {
  if (!isOpen || !data) return null;

  const enviarWhatsApp = () => {
    // Tu misma lógica de WSP que tenías
    const numFinal = data.telefono.replace(/\D/g, '');
    const msg = `Hola ${data.paciente}, confirmamos tu cita...`;
    window.open(`https://wa.me/56${numFinal}?text=${encodeURIComponent(msg)}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-[3rem] p-8 text-center max-w-sm w-full">
        <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={60} />
        <h2 className="text-2xl font-black uppercase text-slate-800 mb-6">¡Cita Lista!</h2>
        
        <div className="bg-slate-50 p-4 rounded-2xl mb-6 text-left border">
          <p className="text-[10px] font-black text-slate-400 uppercase">Paciente</p>
          <p className="font-black text-slate-800 mb-3">{data.paciente}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase">Fecha y Hora</p>
          <p className="font-black text-slate-800">{data.citas[0]?.fecha} • {data.citas[0]?.hora} hrs</p>
        </div>

        <button onClick={enviarWhatsApp} className="w-full py-4 mb-2 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">
          <MessageCircle size={16}/> Enviar Confirmación
        </button>
        <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase">
          Finalizar sin enviar
        </button>
      </motion.div>
    </div>
  )
}