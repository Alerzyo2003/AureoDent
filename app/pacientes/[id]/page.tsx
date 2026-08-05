'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  History, Calendar, Clock, Stethoscope,
  Loader2, Image as ImageIcon,
  DollarSign, User, CalendarDays, Wallet, FileSignature,
  Building2, MoreVertical, ClipboardList
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HistorialPage() {
  const { id: paciente_id } = useParams()
  const [bitacora, setBitacora] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'mias'>('todas')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (paciente_id) {
      obtenerTodoElHistorial()
    }
  }, [paciente_id])

  async function obtenerTodoElHistorial() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const [
        { data: evoluciones },
        { data: presupuestos },
        { data: archivos },
        { data: documentos },
        { data: pagos },
        { data: citas },
        { data: profesionales }
      ] = await Promise.all([
        supabase.from('evoluciones').select('*').eq('paciente_id', paciente_id),
        supabase.from('presupuestos').select('*').eq('paciente_id', paciente_id),
        supabase.from('documentos_pacientes').select('*').eq('paciente_id', paciente_id),
        supabase.from('documentos_clinicos').select('*').eq('paciente_id', paciente_id),
        supabase.from('pagos').select('*').eq('paciente_id', paciente_id),
        supabase.from('citas').select('*').eq('paciente_id', paciente_id),
        supabase.from('profesionales').select('user_id, nombre, apellido')
      ])

      const evs = (evoluciones || []).map(e => ({
        ...e,
        tipo: 'evolucion',
        fecha: e.fecha_registro,
        titulo: 'Evolución Clínica',
        descripcion: e.descripcion_procedimiento,
        icon: <Stethoscope size={24} strokeWidth={2} />,
        color: 'purple'
      }))

      const pres = (presupuestos || []).map(p => ({
        ...p,
        tipo: 'presupuesto',
        fecha: p.created_at,
        titulo: `Plan de Tratamiento: ${p.nombre_tratamiento || 'Nuevo Plan de Tratamiento'}`,
        descripcion: `Monto total: $${Number(p.total || 0).toLocaleString('es-CL')} | Estado: ${p.estado}`,
        icon: <DollarSign size={24} strokeWidth={2} />,
        color: 'emerald'
      }))

      const arcs = (archivos || []).map(a => ({
        ...a,
        tipo: 'archivo',
        fecha: a.fecha_subida,
        titulo: `RX / Archivo: ${a.titulo || a.nombre_archivo}`,
        descripcion: a.descripcion || `Archivo cargado al expediente.`,
        url_archivo: a.url_archivo,
        icon: <ImageIcon size={24} strokeWidth={2} />,
        color: 'orange' 
      }))

      const docs = (documentos || []).map(d => ({
        ...d,
        tipo: 'documento',
        fecha: d.fecha_creacion,
        titulo: d.titulo_documento || 'Documento Clínico',
        descripcion: `Documento generado y archivado.`,
        icon: <FileSignature size={24} strokeWidth={2} />,
        color: 'slate'
      }))

      const pgs = (pagos || []).map(pg => ({
        ...pg,
        tipo: 'pago',
        fecha: pg.fecha_pago,
        titulo: `Abono Recibido: $${Number(pg.monto || 0).toLocaleString('es-CL')}`,
        descripcion: `Método: ${pg.metodo_pago} ${pg.numero_boleta ? `- Boleta: ${pg.numero_boleta}` : ''}`,
        icon: <Wallet size={24} strokeWidth={2} />,
        color: 'cyan'
      }))

      const cts = (citas || []).map(c => ({
        ...c,
        tipo: 'cita',
        fecha: c.created_at || c.inicio,
        titulo: `Cita`,
        descripcion: `Observación: ${c.motivo || 'Control rutinario sin novedades.'}`,
        icon: <ClipboardList size={24} strokeWidth={2} />,
        color: 'blue'
      }))

      const total = [...evs, ...pres, ...arcs, ...docs, ...pgs, ...cts].sort((a, b) =>
        new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
      )

      const final = total.map(item => ({
        ...item,
        autor: profesionales?.find((p: any) => p.user_id === (item.profesional_id || item.especialista_id || item.creado_por || item.usuario_id))
      }))

      setBitacora(final)
    } catch (err) {
      console.error("Error en historial:", err)
    } finally {
      setLoading(false)
    }
  }

  const bitacoraFiltrada = bitacora.filter(item => {
    if (filtro === 'mias') return (item.profesional_id || item.especialista_id || item.creado_por) === currentUserId
    return true
  })

  if (!mounted || loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-500 font-black text-xs uppercase tracking-widest animate-pulse">Cargando Línea de Tiempo...</p>
    </div>
  )

  return (
    <div className="w-full pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Main Card Container transparente/limpio para aprovechar el fondo maestro */}
        <div className="bg-white/95 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100/50">
          
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
              <div className="bg-blue-50/80 p-4 rounded-2xl text-blue-600">
                <History size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">Línea de Tiempo</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Actividad completa del Paciente</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
              <button 
                onClick={() => setFiltro('todas')} 
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                  filtro === 'todas' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Building2 size={14} /> Toda la Clínica
              </button>
              <button 
                onClick={() => setFiltro('mias')} 
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                  filtro === 'mias' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <User size={14} /> Mis Acciones
              </button>
            </div>
          </div>

          {/* TIMELINE */}
          <div className="relative ml-4 md:ml-8 border-l-[3px] border-slate-100 pl-8 md:pl-12 space-y-8">
            <AnimatePresence mode='popLayout'>
              {bitacoraFiltrada.map((item, idx) => {
                const autor = item.autor as any;
                
                // Mapeo de colores más elegante (sin amarillos para look profesional)
                const colorMap: Record<string, { bg: string, text: string, dot: string, avatar: string }> = {
                  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500', dot: 'bg-emerald-400', avatar: 'bg-blue-600' },
                  blue: { bg: 'bg-blue-50', text: 'text-blue-500', dot: 'bg-blue-500', avatar: 'bg-purple-600' },
                  orange: { bg: 'bg-orange-50/80', text: 'text-orange-500', dot: 'bg-orange-400', avatar: 'bg-orange-600' },
                  purple: { bg: 'bg-purple-50', text: 'text-purple-500', dot: 'bg-purple-400', avatar: 'bg-purple-600' },
                  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-500', dot: 'bg-cyan-400', avatar: 'bg-cyan-600' },
                  slate: { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300', avatar: 'bg-slate-600' },
                };

                const colors = colorMap[item.color] || colorMap.slate;

                return (
                  <motion.div
                    layout 
                    key={`${item.tipo}-${item.id || idx}`}
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="relative group"
                  >
                    {/* TIMELINE DOT */}
                    <div className={`absolute -left-[43px] md:-left-[59px] top-6 w-4 h-4 rounded-full border-[3px] border-white shadow-sm z-10 ${colors.dot}`}></div>
                    
                    {/* ITEM CARD */}
                    <div className="bg-white p-5 md:p-7 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col md:flex-row gap-5 md:gap-6">
                      
                      {/* ICON BOX */}
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${colors.bg} ${colors.text}`}>
                        {item.icon}
                      </div>

                      {/* CONTENT BODY */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                          
                          {/* Title and Date */}
                          <div>
                            <h4 className="text-[13px] md:text-[14px] font-black text-slate-800 uppercase tracking-tight truncate">
                              {item.titulo}
                            </h4>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] md:text-xs text-slate-500 font-bold uppercase mt-2">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={14} />
                                {item.fecha ? new Date(item.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : 'S/F'}
                              </div>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-center gap-1.5">
                                <Clock size={14} />
                                {item.fecha ? new Date(item.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'S/H'} hrs
                              </div>
                            </div>
                          </div>

                          {/* Responsable & Options */}
                          <div className="flex items-center gap-4 shrink-0 mt-2 md:mt-0">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1.5">
                                Responsable
                              </span>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-black uppercase shadow-sm ${colors.avatar}`}>
                                  {autor?.nombre?.substring(0, 2) || (item.tipo === 'presupuesto' ? 'S' : 'AS')}
                                </div>
                                <span className="text-[11px] font-black text-slate-800 uppercase">
                                  {autor ? `DR. ${autor.apellido}` : (item.tipo === 'presupuesto' ? 'Sistema' : 'Asistente')}
                                </span>
                              </div>
                            </div>
                            <button className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                              <MoreVertical size={20} />
                            </button>
                          </div>
                        </div>

                        {/* Description / Content Box */}
                        <div className="bg-slate-50/80 p-3.5 rounded-2xl text-[12px] text-slate-600 font-medium italic border border-slate-100/50">
                          {item.descripcion}
                        </div>
                        
                        {/* Multimedia preview */}
                        {item.tipo === 'archivo' && item.url_archivo && (
                          <div className="mt-4 flex gap-4">
                              <div className="relative overflow-hidden rounded-2xl border-2 border-white shadow-md w-40 h-28 group/img shrink-0 bg-slate-100">
                                  <img src={item.url_archivo} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105" alt="Vista previa" />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ImageIcon className="text-white" size={24} />
                                  </div>
                              </div>
                              <div className="flex flex-col justify-center gap-2">
                                  <a href={item.url_archivo} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 uppercase hover:underline">Ver pantalla completa</a>
                                  <a href={item.url_archivo} download className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600">Descargar original</a>
                              </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              
              {bitacoraFiltrada.length === 0 && (
                <div className="py-24 flex flex-col items-center justify-center gap-4 bg-white/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <History className="text-slate-300" size={56} />
                    <p className="text-slate-400 font-black uppercase text-xs tracking-widest text-center">No hay registros de actividad todavía</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
