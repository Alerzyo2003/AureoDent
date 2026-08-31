'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createPortal } from 'react-dom'
import { 
  User, ClipboardList, Activity, Camera, Wallet, 
  ArrowLeft, UserCircle, History, Pill, FileCheck, 
  ClipboardCheck, Tag, Loader2, Plus, Trash2, Edit2, // <-- Agregados aquí
  AlertCircle, ImageIcon, Fingerprint, Clock,
  VenusAndMars, Cake, Coins, AlertTriangle, Lock, ShieldAlert, Spline,
  CalendarClock, CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, Save, X, MessageCircle
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// --- CONSTANTES Y HELPERS DE AGENDA ---
const slotsHorarios = [
  "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45",
  "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45",
  "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45",
  "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30", "17:45",
  "18:00", "18:15", "18:30", "18:45", "19:00", "19:15", "19:30", "19:45",
  "20:00", "20:15", "20:30", "20:45", "21:00"
];
const duracionesDisponibles = [15, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300];

const getLunes = (d: Date) => { const date = new Date(d); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); date.setHours(0,0,0,0); return date; }
const getDiasLunesSabado = (d: Date) => { const curr = new Date(d); const day = curr.getDay(); const diff = curr.getDate() - day + (day === 0 ? -6 : 1); return Array.from({ length: 6 }, (_, i) => new Date(curr.getFullYear(), curr.getMonth(), diff + i)); }
const getLocalDateISO = (d: Date) => { const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }

export default function PacienteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const id = params.id
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false);
  
  const [paciente, setPaciente] = useState<any>(null)
  const [datosPresupuesto, setDatosPresupuesto] = useState<any>(null)
  const [antecedentes, setAntecedentes] = useState<any[]>([])
  const [proximasCitas, setProximasCitas] = useState<any[]>([])
  const [dropdownCitasAbierto, setDropdownCitasAbierto] = useState(false)
  const [perfil, setPerfil] = useState<any>(null)
  const [usuarioLogueado, setUsuarioLogueado] = useState<string | null>(null)

  // --- ESTADOS PARA MODAL DE AGENDAMIENTO ---
  const [modalAgendarAbierto, setModalAgendarAbierto] = useState(false)
  const [semanaInicio, setSemanaInicio] = useState(getLunes(new Date()))
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [filtroAgenda, setFiltroAgenda] = useState({ profesional_id: '', duracionDefault: 30 })
  const [horasSeleccionadas, setHorasSeleccionadas] = useState<{fecha: string, hora: string, duracion: number}[]>([])
  
  const [horariosConfigurados, setHorariosConfigurados] = useState<any[]>([])
  const [citasOcupadas, setCitasOcupadas] = useState<any[]>([])
  const [bloqueosSemana, setBloqueosSemana] = useState<any[]>([]) 
  
  const [tratamientosPaciente, setTratamientosPaciente] = useState<any[]>([])
  const [tratamientoSeleccionadoId, setTratamientoSeleccionadoId] = useState<string | null>('MANUAL')
  const [nuevoTratamientoNombre, setNuevoTratamientoNombre] = useState('')
  const [guardandoCita, setGuardandoCita] = useState(false)
  const [mostrarTicket, setMostrarTicket] = useState(false)
  const [citaConfirmadaData, setCitaConfirmadaData] = useState<any>(null)

  const [modalEdicionAntecedentes, setModalEdicionAntecedentes] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState<'alerta' | 'enfermedad' | 'medicamento'>('alerta');
  const [nuevoItemTexto, setNuevoItemTexto] = useState('');
  const [procesandoItem, setProcesandoItem] = useState(false);

  const abrirEdicionRapida = (categoria: 'alerta' | 'enfermedad' | 'medicamento') => {
    setCategoriaActiva(categoria);
    setNuevoItemTexto('');
    setModalEdicionAntecedentes(true);
  };

  const agregarItemRapido = async () => {
    if (!nuevoItemTexto.trim()) return;
    setProcesandoItem(true);
    try {
      await supabase.from('antecedentes').insert([{ paciente_id: id, categoria: categoriaActiva, contenido: nuevoItemTexto.trim() }]);
      toast.success("Registro añadido");
      setNuevoItemTexto('');
      fetchDatosMaestros(); // Actualiza la tarjeta inmediatamente
      window.dispatchEvent(new Event('pacienteActualizado')); // Avisa a las otras páginas
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setProcesandoItem(false);
    }
  };

  const eliminarItemRapido = async (itemId: string) => {
    setProcesandoItem(true);
    try {
      await supabase.from('antecedentes').delete().eq('id', itemId);
      toast.success("Registro eliminado");
      fetchDatosMaestros(); // Actualiza la tarjeta
      window.dispatchEvent(new Event('pacienteActualizado'));
    } catch (error) {
      toast.error("Error al eliminar");
    } finally {
      setProcesandoItem(false);
    }
  };


  const presupuestoId = pathname.match(/\/tratamientos\/([a-f0-9-]{36})/)?.[1] || null;

  const calcularEdad = (fechaNac: string) => {
    if (!fechaNac) return 'N/A';
    const hoy = new Date();
    const cumple = new Date(fechaNac);
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
    return edad + ' años';
  }

  useEffect(() => {
    setMounted(true);
    const getUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUsuarioLogueado(session.user.id);
        const { data: pData } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
        setPerfil(pData)
      }
    }
    getUserProfile()
  }, [])

  useEffect(() => {
    if (!id) return;
    fetchDatosMaestros();

    const channel = supabase
      .channel('cambios-paciente')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pacientes', filter: `id=eq.${id}` }, (payload) => { 
        setPaciente(payload.new); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'antecedentes', filter: `paciente_id=eq.${id}` }, () => {
        fetchDatosMaestros();
      })
      .subscribe();

    const handleUpdate = () => fetchDatosMaestros();
    window.addEventListener('pacienteActualizado', handleUpdate);
    
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('pacienteActualizado', handleUpdate);
    };
  }, [id])

  async function fetchDatosMaestros() {
    try {
      const hoy = new Date().toISOString();
      const [resPac, resAnt, resCitas, resProfs] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).maybeSingle(),
        supabase.from('antecedentes').select('*').eq('paciente_id', id),
        supabase.from('citas')
          .select('*')
          .eq('paciente_id', id)
          .gte('inicio', hoy)
          .neq('estado', 'cancelada')
          .order('inicio', { ascending: true })
          .limit(3), // Traerá las 3 más próximas
        supabase.from('profesionales').select('user_id, nombre, apellido')
      ]);
      
      if (resPac.data) setPaciente(resPac.data);
      if (resAnt.data) setAntecedentes(resAnt.data);
      
      if (resCitas.data) {
        const citasMapeadas = resCitas.data.map((cita: any) => {
          const prof = resProfs.data?.find((p: any) => p.user_id === cita.profesional_id);
          return {
            ...cita,
            // Extraemos solo el primer nombre y apellido para que quepa bien visualmente
            profesional_nombre: prof ? `Dr. ${prof.nombre.split(' ')[0]} ${prof.apellido.split(' ')[0]}` : 'Especial.'
          };
        });
        setProximasCitas(citasMapeadas);
      }
    } catch (err) { console.error(err) }
  }

  // --- LÓGICA DE AGENDAMIENTO ---
  const abrirModalAgendar = async () => {
    setModalAgendarAbierto(true);
    setHorasSeleccionadas([]);
    setNuevoTratamientoNombre('');
    
    // Cargar profesionales
    const { data: profs } = await supabase.from('profesionales').select('id, user_id, nombre, apellido').eq('activo', true);
    setProfesionales(profs || []);
    if (profs && profs.length > 0 && !filtroAgenda.profesional_id) {
        setFiltroAgenda(prev => ({...prev, profesional_id: profs[0].user_id}));
    }

    // Cargar tratamientos activos del paciente
    const { data: presups } = await supabase.from('presupuestos').select('id, nombre_tratamiento').eq('paciente_id', id).neq('estado', 'finalizado').order('fecha_creacion', { ascending: false });
    setTratamientosPaciente(presups || []);
    setTratamientoSeleccionadoId('MANUAL');
  };

  useEffect(() => {
    if (modalAgendarAbierto && filtroAgenda.profesional_id) {
      fetchDisponibilidadGrid();
    }
  }, [semanaInicio, modalAgendarAbierto, filtroAgenda.profesional_id]);

  async function fetchDisponibilidadGrid() {
    const dias = getDiasLunesSabado(semanaInicio);
    const inicioSemana = getLocalDateISO(dias[0]);
    const finSemana = getLocalDateISO(dias[5]);
    
    const profObj = profesionales.find(p => p.user_id === filtroAgenda.profesional_id);

    const [citasRes, dispoRes, bloqueosRes] = await Promise.all([
        supabase.from('citas').select('id, inicio, fin').eq('profesional_id', filtroAgenda.profesional_id).gte('inicio', `${inicioSemana}T00:00:00`).lte('inicio', `${finSemana}T23:59:59`).neq('estado', 'cancelada'),
        supabase.from('disponibilidad_profesional').select('*').eq('profesional_id', filtroAgenda.profesional_id),
        profObj ? supabase.from('bloqueos_agenda').select('*').eq('profesional_id', profObj.id).gte('fecha', inicioSemana).lte('fecha', finSemana) : Promise.resolve({ data: [] })
    ]);

    setCitasOcupadas(citasRes.data || []);
    setHorariosConfigurados(dispoRes.data || []);
    setBloqueosSemana(bloqueosRes.data || []);
  }

  const esHorarioLaboral = (fecha: string, hora: string, duracionMinutos: number) => {
    const diaSemana = new Date(fecha + 'T00:00:00').getDay();
    const slotStart = new Date(`${fecha}T${hora}:00`).getTime();
    const slotEnd = slotStart + duracionMinutos * 60000;

    const especiales = horariosConfigurados.filter(h => h.fecha_especifica === fecha);
    const horariosAUsar = especiales.length > 0 ? especiales : horariosConfigurados.filter(h => h.dia_semana === diaSemana && !h.fecha_especifica);

    return horariosAUsar.some(h => {
        const inicioLab = new Date(`${fecha}T${h.hora_inicio.substring(0,5)}:00`).getTime();
        const finLab = new Date(`${fecha}T${h.hora_fin.substring(0,5)}:00`).getTime();
        return slotStart >= inicioLab && slotEnd <= finLab;
    });
  }

  const esCitaOcupada = (fecha: string, hora: string, duracionMinutos: number) => {
    const slotStart = new Date(`${fecha}T${hora}:00`).getTime();
    const slotEnd = slotStart + duracionMinutos * 60000;
    return citasOcupadas.some(cita => {
        const citaInicio = new Date(cita.inicio.replace(' ', 'T')).getTime();
        const citaFin = new Date(cita.fin.replace(' ', 'T')).getTime();
        return slotStart < citaFin && slotEnd > citaInicio;
    });
  };

  const esHorarioBloqueado = (fecha: string, hora: string, duracionMinutos: number) => {
    const slotStart = new Date(`${fecha}T${hora}:00`).getTime();
    const slotEnd = slotStart + duracionMinutos * 60000;
    return bloqueosSemana.some(b => {
        if (b.fecha !== fecha) return false;
        if (!b.hora_inicio || !b.hora_fin) return true; 
        const bStart = new Date(`${fecha}T${b.hora_inicio}`).getTime();
        const bEnd = new Date(`${fecha}T${b.hora_fin}`).getTime();
        return slotStart < bEnd && slotEnd > bStart;
    });
  };

  const handleSlotClick = (fecha: string, hora: string) => {
    const selIndex = horasSeleccionadas.findIndex(x => x.fecha === fecha && x.hora === hora);
    if (selIndex >= 0) {
      setHorasSeleccionadas(prev => prev.filter((_, i) => i !== selIndex));
      return;
    }

    const laboral = esHorarioLaboral(fecha, hora, filtroAgenda.duracionDefault);
    const ocupado = esCitaOcupada(fecha, hora, filtroAgenda.duracionDefault);
    const bloqueado = esHorarioBloqueado(fecha, hora, filtroAgenda.duracionDefault);

    if (bloqueado) return toast.error("Este horario está bloqueado.");
    if (!laboral) return toast.error("Fuera del horario laboral del especialista.");
    if (ocupado) {
        if (!window.confirm(`⚠️ Este bloque choca con otra cita. ¿Deseas forzar un SOBRECUPO?`)) return;
    }

    setHorasSeleccionadas(prev => [...prev, { fecha, hora, duracion: filtroAgenda.duracionDefault }]);
  };

  const handleGuardarCita = async () => {
    setGuardandoCita(true);
    try {
      const parsearAFechaLocal = (fechaStr: string, horaStr: string, duracionMin: number) => {
        const finDate = new Date(new Date(`${fechaStr}T${horaStr}:00`).getTime() + duracionMin * 60000);
        const finH = finDate.getHours().toString().padStart(2, '0');
        const finM = finDate.getMinutes().toString().padStart(2, '0');
        return { inicio: `${fechaStr}T${horaStr}:00`, fin: `${fechaStr}T${finH}:${finM}:00` };
      };

      const nuevasCitas = horasSeleccionadas.map(s => {
        const { inicio, fin } = parsearAFechaLocal(s.fecha, s.hora, s.duracion);
        return { 
            paciente_id: paciente.id, 
            profesional_id: filtroAgenda.profesional_id, 
            presupuesto_id: (tratamientoSeleccionadoId && tratamientoSeleccionadoId !== 'MANUAL') ? tratamientoSeleccionadoId : null, 
            inicio, 
            fin, 
            estado: 'programada', 
            motivo: nuevoTratamientoNombre.toUpperCase() || 'CONSULTA', 
            creado_por: usuarioLogueado 
        };
      });

      const { data: citasCreadas } = await supabase.from('citas').insert(nuevasCitas).select('id');
      
      setCitaConfirmadaData({ 
          paciente: `${paciente.nombre} ${paciente.apellido}`.toUpperCase(), 
          citas: horasSeleccionadas, 
          telefono: paciente.telefono, 
          citaId: citasCreadas?.[0]?.id 
      });
      setMostrarTicket(true);
    } catch (e) {
      toast.error("Error al guardar las citas");
    } finally {
      setGuardandoCita(false);
    }
  };


  const puedeVerFinanzas = perfil?.rol === 'ADMIN' || perfil?.rol === 'RECEPCIONISTA' || perfil?.rol === 'DENTISTA';

  if (!paciente) return (
    <div className="h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-slate-50" style={{ backgroundImage: "url('/fondo-pacientes.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-0"></div>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 md:p-12 rounded-[3rem] shadow-xl border border-slate-200/60 relative z-10 flex flex-col items-center max-w-sm w-full mx-4">
        <div className="relative flex items-center justify-center mb-6">
           <div className="absolute inset-0 bg-blue-100 rounded-[1.5rem] animate-ping opacity-40"></div>
           <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-200/50 relative z-10"><User size={36} strokeWidth={2.5} /></div>
        </div>
        <h3 className="text-[22px] font-black text-slate-900 uppercase tracking-tighter mb-2 leading-none">Abriendo Ficha</h3>
        <div className="flex items-center gap-2 mb-8">
          <Loader2 size={12} className="animate-spin text-slate-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sincronizando datos...</p>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
          <motion.div className="absolute top-0 bottom-0 left-0 bg-slate-900 rounded-full w-1/2" animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} />
        </div>
      </motion.div>
    </div>
  )

  if (paciente && paciente.activo === false) return (
    <div className="h-screen flex items-center justify-center bg-[#FDFDFD] p-6 selection:bg-red-100">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white max-w-lg w-full p-10 md:p-14 rounded-[3.5rem] shadow-2xl shadow-red-900/5 border border-red-50 text-center flex flex-col items-center">
        <div className="w-28 h-28 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-8 border-[10px] border-red-500/10 relative">
          <Lock size={48} strokeWidth={2.5} />
          <div className="absolute -bottom-2 -right-2 bg-red-600 text-white p-2 rounded-full border-4 border-white"><ShieldAlert size={20} /></div>
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-3 leading-none">Ficha Bloqueada</h1>
        <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">Este paciente ({paciente.nombre} {paciente.apellido}) ha sido marcado como <strong>inactivo</strong> en el sistema.</p>
        <button onClick={() => router.back()} className="w-full bg-slate-900 text-white font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
          <ArrowLeft size={16} /> Volver Atrás
        </button>
      </motion.div>
    </div>
  )

  const esFicha = pathname.startsWith(`/pacientes/${id}`) && !pathname.includes('/datos') && !pathname.includes('/tratamientos') && !pathname.includes('/periodontograma') && !pathname.includes('/odontograma') && !pathname.includes('/archivos') && !pathname.includes('/pagos');

  const alertas = antecedentes.filter(a => a.categoria === 'alerta');
  const enfermedades = antecedentes.filter(a => a.categoria === 'enfermedad');
  const medicamentos = antecedentes.filter(a => a.categoria === 'medicamento');

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-blue-100 text-left bg-fixed print:block print:min-h-0" style={{ backgroundImage: "url('/fondo-pacientes.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <header className="bg-white/95 backdrop-blur-md relative lg:sticky top-0 z-40 border-b border-slate-200 shadow-sm print:hidden flex flex-col">
        <div className="px-4 lg:px-6 py-4 w-full mx-auto flex flex-col xl:flex-row gap-5 justify-between items-start xl:items-center">
          
          <div className="flex flex-row items-center gap-4 shrink-0 w-full xl:w-auto">
            <div className="relative group shrink-0">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 lg:p-3.5 rounded-[1.2rem] lg:rounded-[1.5rem] text-white shadow-lg shadow-blue-200/50">
                <User size={20} strokeWidth={2.5} className="lg:w-6 lg:h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-[2px] border-white rounded-full"></div>
            </div>
            
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-lg lg:text-xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2 truncate">
                {paciente.nombre} {paciente.apellido}
              </h1>
              <div className="flex flex-wrap items-center gap-2 lg:gap-3 text-left">
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                  <Fingerprint size={10} className="text-slate-400" />
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest"><span className="text-slate-800">{paciente.rut || 'S/R'}</span></p>
                </div>
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                  <VenusAndMars size={10} className="text-slate-400" />
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest"><span className="text-slate-800">{paciente.sexo?.substring(0,1) || 'N/A'}</span></p>
                </div>
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                  <Cake size={10} className="text-slate-400" />
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest"><span className="text-slate-800">{calcularEdad(paciente.fecha_nacimiento)}</span></p>
                </div>
                <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
                  <Tag size={10} className="text-purple-500" />
                  <p className="text-purple-600 text-[9px] font-bold uppercase tracking-widest"><span className="font-black truncate max-w-[80px] block">{paciente.prevision && paciente.prevision !== 'Sin convenio' ? paciente.prevision : 'Particular'}</span></p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full xl:w-auto overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 pb-2 xl:pb-0 pt-1 xl:pt-0">
            {/* TARJETA ALERTAS */}
            <div onClick={() => abrirEdicionRapida('alerta')} className="snap-center shrink-0 w-[75%] sm:w-44 bg-red-50/40 border border-red-100 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all duration-300 hover:shadow-md hover:border-red-300 cursor-pointer group">
              <div className="flex justify-between items-center">
                <h3 className="text-[8px] font-black text-red-800 uppercase tracking-widest flex items-center gap-1.5"><AlertTriangle size={10}/> Alertas</h3>
                <Edit2 size={10} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-wrap gap-1">
                {alertas.length > 0 ? alertas.map(a => <span key={a.id} className="bg-red-100/80 text-red-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase leading-tight">{a.contenido}</span>) : <span className="text-[8px] text-red-400/70 font-bold italic uppercase tracking-widest">Ninguna</span>}
              </div>
            </div>
            
            {/* TARJETA ENFERMEDADES */}
            <div onClick={() => abrirEdicionRapida('enfermedad')} className="snap-center shrink-0 w-[75%] sm:w-44 bg-blue-50/40 border border-blue-100 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all duration-300 hover:shadow-md hover:border-blue-300 cursor-pointer group">
              <div className="flex justify-between items-center">
                <h3 className="text-[8px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1.5"><Activity size={10}/> Enfermedades</h3>
                <Edit2 size={10} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-wrap gap-1">
                {enfermedades.length > 0 ? enfermedades.map(e => <span key={e.id} className="bg-blue-100/80 text-blue-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase leading-tight">{e.contenido}</span>) : <span className="text-[8px] text-blue-400/70 font-bold italic uppercase tracking-widest">Ninguna</span>}
              </div>
            </div>
            
            {/* TARJETA MEDICAMENTOS */}
            <div onClick={() => abrirEdicionRapida('medicamento')} className="snap-center shrink-0 w-[75%] sm:w-44 bg-purple-50/40 border border-purple-100 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all duration-300 hover:shadow-md hover:border-purple-300 cursor-pointer group">
              <div className="flex justify-between items-center">
                <h3 className="text-[8px] font-black text-purple-800 uppercase tracking-widest flex items-center gap-1.5"><Pill size={10}/> Medicamentos</h3>
                <Edit2 size={10} className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-wrap gap-1">
                {medicamentos.length > 0 ? medicamentos.map(m => <span key={m.id} className="bg-purple-100/80 text-purple-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase leading-tight">{m.contenido}</span>) : <span className="text-[8px] text-purple-400/70 font-bold italic uppercase tracking-widest">Ninguno</span>}
              </div>
            </div>
          </div>
          
        </div>

        <div className="bg-slate-50/50 border-t border-slate-100 px-4 lg:px-6 py-2">
          <div className="w-full mx-auto flex items-center gap-3">
            <a href="/agenda" className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 transition-all shrink-0 shadow-sm" title="Volver a la Agenda">
              <ArrowLeft size={16} strokeWidth={2.5}/>
            </a>
            
            <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-edges">
              <TabLink href={`/pacientes/${id}`} active={esFicha} icon={<ClipboardList size={14}/>} label="Ficha" />
              <TabLink href={`/pacientes/${id}/datos`} active={pathname.includes('/datos')} icon={<UserCircle size={14}/>} label="Perfil" />
              <TabLink href={`/pacientes/${id}/tratamientos`} active={pathname.includes('/tratamientos')} icon={<Wallet size={14}/>} label="Tratamientos" />
              <TabLink href={`/pacientes/${id}/periodontograma`} active={pathname.includes('/periodontograma')} icon={<Spline size={14}/>} label="Periodonto" />
              {puedeVerFinanzas && <TabLink href={`/pacientes/${id}/pagos`} active={pathname.includes('/pagos')} icon={<Coins size={14}/>} label="Pagos" />}
              <TabLink href={`/pacientes/${id}/odontograma`} active={pathname.includes('/odontograma')} icon={<Activity size={14}/>} label="Odonto" />
              <TabLink href={`/pacientes/${id}/archivos`} active={pathname.includes('/archivos')} icon={<Camera size={14}/>} label="Galería" />
            </nav>

            {/* BOTÓN AGENDAR NATIVO */}
            <div className="flex items-center gap-2 shrink-0">
              {/* DROPDOWN: PRÓXIMAS CITAS */}
              <div className="relative shrink-0">
                <button 
                  onClick={() => setDropdownCitasAbierto(!dropdownCitasAbierto)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-[1rem] font-black text-[10px] uppercase tracking-widest transition-all shadow-sm border ${dropdownCitasAbierto ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  <CalendarClock size={14} className={dropdownCitasAbierto ? "text-[#C9A24B]" : "text-slate-400"} /> 
                  <span className="hidden xl:inline">Próximas Citas</span>
                  {proximasCitas.length > 0 && (
                    <span className="bg-[#C9A24B] text-white px-1.5 py-0.5 rounded-full text-[9px] shadow-sm">
                      {proximasCitas.length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {dropdownCitasAbierto && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setDropdownCitasAbierto(false)}></div>
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
                          {proximasCitas.length > 0 ? proximasCitas.map((cita, idx) => (
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

              {/* BOTÓN AGENDAR NATIVO */}
              <button 
                onClick={abrirModalAgendar}
                className="flex items-center gap-2 px-4 py-2 bg-[#C9A24B] text-white rounded-[1rem] font-black text-[10px] uppercase tracking-widest hover:bg-[#B38D3A] transition-all shrink-0 shadow-sm"
              >
                <CalendarClock size={14} /> <span className="hidden sm:inline">Agendar Cita</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-6 py-6 lg:py-8 w-full max-w-[1200px] mx-auto flex-1 print:p-0 print:block print:max-w-none print:mx-0 text-left">
        <div className="flex flex-col gap-4 lg:gap-6 print:block print:w-full print:h-auto text-left h-full">
          {esFicha && (
            <nav className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-sm relative lg:sticky lg:top-[120px] z-30 print:hidden text-left mb-2">
              <SubTabLink href={`/pacientes/${id}`} active={pathname === `/pacientes/${id}`} label="Resumen" icon={<History size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/evoluciones`} active={pathname.includes('/evoluciones')} label="Evoluciones" icon={<Activity size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/antecedentes`} active={pathname.includes('/antecedentes')} label="Ant. Médicos" icon={<AlertCircle size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/rx-documentos`} active={pathname.includes('/rx-documentos')} label="RX y Multimedia" icon={<ImageIcon size={14}/>} />
              {perfil?.rol === 'DENTISTA' || perfil?.rol === 'ADMIN' ? <SubTabLink href={`/pacientes/${id}/recetas`} active={pathname.includes('/recetas')} label="Recetario" icon={<Pill size={14}/>} /> : null}
              <SubTabLink href={`/pacientes/${id}/documentos`} active={pathname.includes('/documentos')} label="Documentos" icon={<FileCheck size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/consentimientos`} active={pathname.includes('/consentimientos')} label="Consentimientos" icon={<ClipboardCheck size={14}/>} />
            </nav>
          )}
          <div className="flex-1 print:block print:h-auto print:min-h-0 text-left relative z-10 w-full">
               {children}
          </div>
        </div>
      </div>

      {/* PORTAL DE MODALES (AGENDAR Y TICKET) */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          <AnimatePresence>
            {modalAgendarAbierto && (
              <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                   
                   <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0" style={{ background: `linear-gradient(135deg, #0E1B2E, #081420)` }}>
                      <div className="flex items-center gap-4">
                         <div className="p-3 rounded-xl shadow-sm bg-white/10 border border-white/20"><CalendarIcon size={24} className="text-[#C9A24B]"/></div>
                         <div>
                           <h2 className="font-display text-xl tracking-tight text-white leading-none">Agendar a {paciente.nombre}</h2>
                           <p className="text-[10px] md:text-[9px] font-bold uppercase tracking-widest mt-1 text-[#C9A24B]">Selecciona el horario disponible</p>
                         </div>
                      </div>
                      <button onClick={() => setModalAgendarAbierto(false)} className="p-2 text-white/60 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                   </div>

                   <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-50 flex flex-col gap-6">

                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                         <h3 className="text-sm font-black uppercase text-slate-800 mb-4 flex items-center gap-2"><ClipboardList size={16} className="text-[#C9A24B]"/> 1. Motivo o Tratamiento</h3>
                         <div className="space-y-3">
                            {tratamientosPaciente.length > 0 && (
                               <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[#C9A24B]" value={tratamientoSeleccionadoId || 'MANUAL'} onChange={e => setTratamientoSeleccionadoId(e.target.value)}>
                                  <option value="MANUAL">-- Ingresar motivo manualmente --</option>
                                  {tratamientosPaciente.map(t => <option key={t.id} value={t.id}>{t.nombre_tratamiento}</option>)}
                               </select>
                            )}
                            <input type="text" placeholder="Ej: Evaluación, Limpieza, Control..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#C9A24B]" value={nuevoTratamientoNombre} onChange={e => setNuevoTratamientoNombre(e.target.value)} />
                         </div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                         <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                             <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2"><Clock size={16} className="text-[#C9A24B]"/> 2. Fecha y Hora</h3>
                             <div className="flex items-center gap-2 w-full md:w-auto">
                                <select className="w-full md:w-auto p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none" value={filtroAgenda.profesional_id} onChange={e => setFiltroAgenda({...filtroAgenda, profesional_id: e.target.value})}>
                                   {profesionales.map(p => <option key={p.user_id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                                </select>
                                <select className="w-full md:w-auto p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none" value={filtroAgenda.duracionDefault} onChange={e => setFiltroAgenda({...filtroAgenda, duracionDefault: Number(e.target.value)})}>
                                   {duracionesDisponibles.map(d => <option key={d} value={d}>{d} min</option>)}
                                </select>
                             </div>
                         </div>
                         
                         <div className="mb-4 flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <button onClick={() => { const n = new Date(semanaInicio); n.setDate(n.getDate()-7); setSemanaInicio(n); }} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronLeft size={18}/></button>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-700">Semana del {semanaInicio.toLocaleDateString('es-CL', {day: 'numeric', month:'short'})}</span>
                            <button onClick={() => { const n = new Date(semanaInicio); n.setDate(n.getDate()+7); setSemanaInicio(n); }} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronRight size={18}/></button>
                         </div>

                         <div className="grid grid-cols-6 gap-2">
                            {getDiasLunesSabado(semanaInicio).map((dia, dIdx) => {
                               const diaStr = getLocalDateISO(dia);
                               return (
                                  <div key={dIdx} className="text-center">
                                     <div className="mb-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dia.toLocaleDateString('es-CL', {weekday: 'short'})}</p>
                                        <p className="text-base font-black text-slate-800">{dia.getDate()}</p>
                                     </div>
                                     <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                        {slotsHorarios.map(hora => {
                                           if(!esHorarioLaboral(diaStr, hora, filtroAgenda.duracionDefault)) return null;
                                           const ocupado = esCitaOcupada(diaStr, hora, filtroAgenda.duracionDefault);
                                           const bloqueado = esHorarioBloqueado(diaStr, hora, filtroAgenda.duracionDefault); 
                                           const seleccionado = horasSeleccionadas.some(s => s.fecha === diaStr && s.hora === hora);

                                           let btnClass = "py-2 text-[11px] font-black rounded-lg border transition-all ";
                                           if(seleccionado) btnClass += "bg-emerald-500 text-white border-emerald-600 shadow-md";
                                           else if(ocupado || bloqueado) btnClass += "bg-red-50 text-red-500 border-red-200 opacity-60"; 
                                           else btnClass += "bg-white text-slate-600 border-slate-200 hover:border-[#C9A24B] hover:text-[#C9A24B] shadow-sm";

                                           return (
                                              <button key={hora} onClick={() => handleSlotClick(diaStr, hora)} className={btnClass}>
                                                 {hora}
                                              </button>
                                           );
                                        })}
                                     </div>
                                  </div>
                               )
                            })}
                         </div>
                      </div>
                   </div>

                   <div className="p-6 md:p-8 border-t border-slate-100 bg-white shrink-0 flex flex-col md:flex-row items-center justify-between gap-4">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                         {horasSeleccionadas.length > 0 ? (
                            <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={16}/> {horasSeleccionadas.length} bloque(s) seleccionado(s)</span>
                         ) : "Selecciona un horario en el calendario"}
                      </p>
                      <button 
                         onClick={handleGuardarCita} 
                         disabled={guardandoCita || horasSeleccionadas.length === 0} 
                         className="w-full md:w-auto px-8 py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg"
                      >
                         {guardandoCita ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} 
                         Confirmar y Agendar
                      </button>
                   </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {mostrarTicket && (
              <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm">
                  <div className="bg-white rounded-[3rem] shadow-2xl p-8 md:p-10 text-center space-y-8">
                    <CheckCircle2 className="mx-auto text-emerald-500 md:w-[64px] md:h-[64px]" size={80} />
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">¡Cita Lista!</h2>
                    <div className="text-left bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                      <div>
                        <p className="text-[11px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Paciente</p>
                        <p className="font-black text-lg md:text-base text-slate-800 uppercase mt-1 leading-tight md:leading-none">{citaConfirmadaData?.paciente}</p>
                      </div>
                      <div>
                        <p className="text-[11px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha y Hora</p>
                        <p className="font-black text-lg md:text-base text-slate-800 uppercase mt-1 leading-tight md:leading-none">{citaConfirmadaData?.citas[0]?.fecha} • {citaConfirmadaData?.citas[0]?.hora} hrs</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 md:gap-2">
                      <button
                        onClick={() => {
                          if (!citaConfirmadaData) return;
                          const { paciente, citas, telefono, citaId } = citaConfirmadaData;
                          if (!telefono) { toast.error("El paciente no tiene un número de teléfono registrado."); return; }

                          const doctor = profesionales.find(p => p.user_id === filtroAgenda.profesional_id);
                          const nombreDoctor = doctor ? `Dr(a). ${doctor.nombre} ${doctor.apellido}` : "nuestro especialista";

                          const fechaObj = new Date(citas[0].fecha + 'T00:00:00');
                          let fechaCita = fechaObj.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
                          fechaCita = fechaCita.charAt(0).toUpperCase() + fechaCita.slice(1);
                          
                          const hora = citas[0].hora;
                          
                          const hoy = new Date();
                          const hoyStr = getLocalDateISO(hoy);
                          
                          const manana = new Date(hoy);
                          manana.setDate(manana.getDate() + 1);
                          const mananaStr = getLocalDateISO(manana);

                          const esHoy = citas[0].fecha === hoyStr;
                          const esManana = citas[0].fecha === mananaStr;

                          let mensaje = "";

                          if (esHoy || esManana) {
                            const textoDia = esHoy ? "HOY" : "MAÑANA";
                            mensaje = `Hola ${paciente}, hemos agendado tu cita con el/la ${nombreDoctor} para ${textoDia} a las ${hora} hrs.\n\n`;
                            mensaje += `📍 Dirección: Av. Venancia Leiva 1871, La Pintana.\n\n`;
                            if (citaId) {
                              mensaje += `⚠️ Importante: Debido a la alta demanda de horas, si tu cita no es confirmada el bloque será asignado a otro paciente.\n\n`;
                              mensaje += `Por favor confirma tu asistencia en el siguiente enlace:\nhttps://confirmar-cita-dignidad.vercel.app/confirmar/${citaId}\n\n`;
                            }
                            mensaje += `¡Te esperamos en Clínica Dignidad!`;
                          } else {
                            mensaje = `Hola ${paciente}, hemos agendado exitosamente tu cita con el/la ${nombreDoctor} para el día ${fechaCita} a las ${hora} hrs.\n\n`;
                            mensaje += `📍 Dirección: Av. Venancia Leiva 1871, La Pintana.\n\n`;
                            mensaje += `¡Te esperamos en Clínica Dignidad!`;
                          }

                          const numLimpio = telefono.replace(/\D/g, '');
                          const numFinal = numLimpio.length === 9 ? `56${numLimpio}` : numLimpio;
                          
                          window.open(`https://wa.me/${numFinal}?text=${encodeURIComponent(mensaje)}`, '_blank');
                          
                          setMostrarTicket(false);
                          setModalAgendarAbierto(false);
                        }}
                        className="w-full py-4 bg-emerald-500 rounded-2xl font-black text-xs md:text-[10px] uppercase tracking-widest text-white shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                      >
                         <MessageCircle size={16}/> Enviar Confirmación
                      </button>
                      <button
                        onClick={() => {
                          setMostrarTicket(false);
                          setModalAgendarAbierto(false);
                        }}
                        className="w-full py-4 md:py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs md:text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Finalizar sin enviar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {modalEdicionAntecedentes && (
              <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm text-left">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
                  
                  {/* Cabecera dinámica según color */}
                  <div className={`p-5 flex justify-between items-center text-white shrink-0 ${categoriaActiva === 'alerta' ? 'bg-red-600' : categoriaActiva === 'enfermedad' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-xl">
                        {categoriaActiva === 'alerta' ? <AlertTriangle size={20}/> : categoriaActiva === 'enfermedad' ? <Activity size={20}/> : <Pill size={20}/>}
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-widest">Editar {categoriaActiva}s</h3>
                        <p className="text-[9px] font-bold text-white/80 uppercase">Gestión rápida</p>
                      </div>
                    </div>
                    <button onClick={() => setModalEdicionAntecedentes(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X size={18}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col gap-3 custom-scrollbar">
                    {/* Lista de items actuales */}
                    {antecedentes.filter(a => a.categoria === categoriaActiva).length === 0 ? (
                       <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 py-6">No hay registros</p>
                    ) : (
                      antecedentes.filter(a => a.categoria === categoriaActiva).map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                          <span className="text-[11px] font-bold text-slate-700 uppercase">{item.contenido}</span>
                          <button 
                            onClick={() => eliminarItemRapido(item.id)}
                            disabled={procesandoItem}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Agregar nuevo */}
                  <div className="p-5 bg-white border-t border-slate-100 shrink-0">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder={`Nuevo/a ${categoriaActiva}...`}
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                        value={nuevoItemTexto}
                        onChange={(e) => setNuevoItemTexto(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && agregarItemRapido()}
                      />
                      <button 
                        onClick={agregarItemRapido}
                        disabled={procesandoItem || !nuevoItemTexto.trim()}
                        className={`p-3 text-white rounded-xl font-black transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${categoriaActiva === 'alerta' ? 'bg-red-600 hover:bg-red-700' : categoriaActiva === 'enfermedad' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                      >
                        {procesandoItem ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18}/>}
                      </button>
                    </div>
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </div>
  )
}

function TabLink({ href, active, icon, label }: any) {
  return (
    <Link href={href} className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-[1rem] font-black text-[10px] uppercase transition-all shrink-0 ${active ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'}`}>
      {icon} <span className="tracking-tight">{label}</span>
    </Link>
  )
}

function SubTabLink({ href, active, label, icon }: any) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl font-black text-[10px] uppercase transition-all whitespace-nowrap ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
      <span className={active ? 'text-blue-400' : ''}>{icon}</span> {label}
    </Link>
  )
}
