'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Pill, Plus, Trash2, Loader2, Save, ClipboardList, ArrowLeft, Printer
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function RecetasPage() {
  const { id: paciente_id } = useParams()
  const [recetas, setRecetas] = useState<any[]>([])
  const [planes, setPlanes] = useState<any[]>([])
  const [paciente, setPaciente] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [recetaSeleccionada, setRecetaSeleccionada] = useState<any>(null)
  const [nuevaReceta, setNuevaReceta] = useState({ presupuesto_id: '', indicaciones: '' })

  useEffect(() => {
    if (paciente_id) {
      fetchData()
      fetchPaciente()
    }
  }, [paciente_id])

  async function fetchPaciente() {
    const { data } = await supabase.from('pacientes').select('*').eq('id', paciente_id).maybeSingle()
    if (data) setPaciente(data)
  }

  async function fetchData() {
    try {
      const [recsRes, tratsRes] = await Promise.all([
        supabase.from('recetas').select('*, presupuestos(nombre_tratamiento)').eq('paciente_id', paciente_id).order('fecha_emision', { ascending: false }),
        supabase.from('presupuestos').select('id, nombre_tratamiento').eq('paciente_id', paciente_id)
      ]);

      if (recsRes.error) throw recsRes.error;

      const { data: profs } = await supabase
        .from('profesionales')
        .select(`
          user_id,
          nombre,
          apellido,
          firma_base64,
          especialidades ( nombre )
        `);

      const { data: perfiles } = await supabase.from('perfiles').select('id, rut');

      const recetasCompletas = (recsRes.data || []).map((receta: any) => {
        const prof = profs?.find((p: any) => p.user_id === receta.profesional_id) as any;
        const perf = perfiles?.find((p: any) => p.id === receta.profesional_id) as any;
       
        return {
          ...receta,
          profesional_data: {
            nombre: prof?.nombre || 'Especialista',
            apellido: prof?.apellido || '',
            rut: perf?.rut || '---',
            especialidad_nombre: prof?.especialidades?.nombre || 'Dentista',
            firma_base64: prof?.firma_base64 || null
          }
        };
      });

      setRecetas(recetasCompletas);
      setPlanes(tratsRes.data || []);
    } catch (error: any) {
      console.error("Error cargando datos:", error.message);
    } finally {
      setCargando(false)
    }
  }

  const calcularEdad = (fechaNac: string) => {
    if (!fechaNac) return "---";
    const hoy = new Date();
    const cumple = new Date(fechaNac);
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
    return `${edad} años`;
  }

  const guardarReceta = async () => {
    if (!nuevaReceta.indicaciones.trim()) return toast.error("Escriba las indicaciones");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");

      const { error } = await supabase.from('recetas').insert([{
        paciente_id: paciente_id,
        presupuesto_id: nuevaReceta.presupuesto_id || null,
        indicaciones: nuevaReceta.indicaciones.trim(),
        profesional_id: user.id,
        medicamentos: "Rp."
      }]);

      if (error) throw error;
      toast.success("Receta guardada");
      setNuevaReceta({ presupuesto_id: '', indicaciones: '' });
      setCreando(false);
      fetchData();
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  }

  const handlePrint = () => {
    const elementoOriginal = document.getElementById('hoja-impresion');
    if (!elementoOriginal) return toast.error("No hay documento para imprimir");

    const styles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('');

    const contenido = elementoOriginal.outerHTML;
    const ventanaPoderosa = window.open('', '_blank');
    if (!ventanaPoderosa) return toast.error("Por favor permite los pop-ups");

    ventanaPoderosa.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <title>Receta - ${paciente?.nombre} ${paciente?.apellido}</title>
          ${styles}
          <style>
            @page { 
              size: A4;
              margin: 0; 
            }
            body {
              background-color: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #hoja-impresion {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 1.5cm !important;
              box-sizing: border-box !important;
              box-shadow: none !important;
              border: none !important;
            }
          </style>
        </head>
        <body>
          ${contenido}
          <script>
            window.onload = function() {
              setTimeout(() => { 
                window.print(); 
                window.close(); 
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    ventanaPoderosa.document.close();
  };

  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-600" size={45} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Generando Recetario...</p>
    </div>
  )

  return (
    <div className="min-h-screen p-6 md:p-10 font-sans text-left pb-24 print:bg-white print:p-0 print:m-0 print:block" style={{ backgroundImage: "url('/fondo-pacientes.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
     
      {/* HEADER PRINCIPAL */}
      <header className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-white/60 flex justify-between items-center text-left print:hidden mb-8">
        <div className="flex items-center gap-4 text-left">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-[1.5rem] text-white shadow-xl shadow-blue-600/20">
            <Pill size={24} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight leading-none text-left">Recetario Maestro</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 text-left">
              Paciente: {paciente?.nombre} {paciente?.apellido}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {(creando || recetaSeleccionada) && (
            <button onClick={() => { setCreando(false); setRecetaSeleccionada(null); }} className="bg-slate-100 text-slate-600 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-slate-200 transition-all shadow-sm">
              <ArrowLeft size={14}/> Volver
            </button>
          )}
          <button onClick={() => { setCreando(true); setRecetaSeleccionada(null); }} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-7 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-95 transition-all border border-blue-500 flex items-center gap-2">
            <Plus size={14} strokeWidth={3}/> Nueva Receta
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start text-left print:block print:w-full print:m-0">
       
        {/* HISTORIAL LATERAL */}
        <aside className="lg:col-span-1 space-y-4 text-left print:hidden">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 italic text-left">Historial de Recetas</h4>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar text-left">
            {recetas.map(r => (
              <div key={r.id} onClick={() => { setRecetaSeleccionada(r); setCreando(false); }}
                className={`p-5 rounded-[2rem] border cursor-pointer transition-all text-left shadow-sm ${recetaSeleccionada?.id === r.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-[1.02]' : 'bg-white/90 backdrop-blur-xl border-white/60 text-slate-700 hover:border-blue-200'}`}
              >
                <div className="flex justify-between items-center mb-1 text-left">
                    <span className="text-[9px] font-black uppercase opacity-75 text-left">
                      {r.fecha_emision ? new Date(r.fecha_emision).toLocaleDateString() : 'S/F'}
                    </span>
                </div>
                <p className="text-[10px] font-bold uppercase truncate text-left">{(r.presupuestos as any)?.nombre_tratamiento || 'Atención General'}</p>
              </div>
            ))}
            {recetas.length === 0 && (
              <div className="p-6 bg-white/50 backdrop-blur-md rounded-[1.5rem] text-center border border-white/40">
                <p className="text-[9px] font-black uppercase text-slate-400">Sin recetas previas</p>
              </div>
            )}
          </div>
        </aside>

        {/* ÁREA PRINCIPAL / FORMULARIO / RECETA */}
        <main className="lg:col-span-3 text-left print:block print:w-full print:m-0">
          <AnimatePresence mode="wait">
            {creando ? (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white/90 backdrop-blur-xl p-10 md:p-12 rounded-[2.5rem] shadow-xl border border-white/60 text-left print:hidden">
                <h4 className="text-2xl font-black text-slate-800 uppercase italic mb-8 text-left">Nueva Prescripción</h4>
                <div className="space-y-6 text-left">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block text-left">Vincular Tratamiento</label>
                    <select className="w-full bg-slate-50/80 hover:bg-white focus:bg-white p-4 rounded-2xl text-xs font-bold border border-slate-200/60 shadow-sm text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer" value={nuevaReceta.presupuesto_id} onChange={(e) => setNuevaReceta({...nuevaReceta, presupuesto_id: e.target.value})}>
                      <option value="">Atención General</option>
                      {planes.map(p => <option key={p.id} value={p.id}>{p.nombre_tratamiento}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block italic text-left">Rp. Indicaciones</label>
                    <textarea rows={10} className="w-full bg-slate-50/80 hover:bg-white focus:bg-white p-6 rounded-[2rem] text-sm font-medium border border-slate-200/60 shadow-inner text-slate-800 outline-none focus:ring-4 ring-blue-500/10 leading-relaxed resize-none placeholder:text-slate-300" value={nuevaReceta.indicaciones} onChange={(e) => setNuevaReceta({...nuevaReceta, indicaciones: e.target.value})} placeholder="Rp. &#10;Medicamento..."/>
                  </div>
                  <button onClick={guardarReceta} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-slate-900 hover:to-slate-900 transition-all border border-blue-500">Guardar Receta</button>
                </div>
              </motion.div>
            ) : recetaSeleccionada ? (
              <div className="w-full flex justify-center text-left print:block print:w-full print:m-0">
               
                {/* CONTENEDOR MAESTRO DE LA HOJA */}
                <div 
                  id="hoja-impresion"
                  className="bg-white shadow-2xl relative w-full max-w-[210mm] mx-auto flex flex-col justify-between p-10 md:p-12 min-h-[280mm] rounded-[2.5rem] border border-white/80 print:rounded-none"
                >
                 
                  <div>
                    {/* ENCABEZADO */}
                    <div className="text-left border-b-2 border-slate-900 pb-5 mb-6 flex items-center gap-6">
                      <img 
                          src="https://yqdpmaopnvrgdqbfaiok.supabase.co/storage/v1/object/public/documentos_imagenes/440749454_122171956712064634_7168698893214813270_n.jpg"
                          className="w-20 h-20 rounded-full object-cover shrink-0 mix-blend-multiply" 
                          style={{ width: '80px', height: '80px' }}
                          alt="Logo" referrerPolicy="no-referrer" />
                      <div className="flex-1 text-left">
                        <h1 className="text-lg font-black text-slate-900 leading-tight text-left">CENTRO MEDICO Y DENTAL DIGNIDAD SPA</h1>
                        <p className="text-[13px] font-black text-slate-800 uppercase mt-1 text-left">
                          Dr/a. {recetaSeleccionada.profesional_data?.nombre} {recetaSeleccionada.profesional_data?.apellido}
                        </p>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed text-left">
                          {recetaSeleccionada.profesional_data?.especialidad_nombre}
                          {recetaSeleccionada.profesional_data?.rut && ` • RUT: ${recetaSeleccionada.profesional_data.rut}`}
                        </p>
                      </div>
                    </div>

                    <h2 className="text-xl font-black uppercase italic text-center border-y border-slate-100 py-2.5 mb-6 text-slate-800">Receta Médica</h2>

                    {/* DATOS DEL PACIENTE */}
                    <div className="bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-100 text-left print:bg-white print:border-slate-200">
                      <div className="grid grid-cols-2 gap-y-3 gap-x-10 text-left">
                          <div className="text-left"><p className="text-[8px] font-black text-slate-400 uppercase text-left">Nombre Paciente</p><p className="text-xs font-bold text-slate-900 uppercase text-left">{paciente?.nombre} {paciente?.apellido}</p></div>
                          <div className="text-left"><p className="text-[8px] font-black text-slate-400 uppercase text-left">RUT</p><p className="text-xs font-bold text-slate-900 text-left">{paciente?.rut || '---'}</p></div>
                          <div className="text-left"><p className="text-[8px] font-black text-slate-400 uppercase text-left">Edad</p><p className="text-xs font-bold text-slate-900 text-left">{calcularEdad(paciente?.fecha_nacimiento)}</p></div>
                          <div className="text-left"><p className="text-[8px] font-black text-slate-400 uppercase text-left">Sexo</p><p className="text-xs font-bold text-slate-900 uppercase text-left">{paciente?.sexo || '---'}</p></div>
                          <div className="col-span-2 text-left"><p className="text-[8px] font-black text-slate-400 uppercase text-left">Fecha Emisión</p><p className="text-xs font-bold text-slate-900 text-left">{recetaSeleccionada.fecha_emision ? new Date(recetaSeleccionada.fecha_emision).toLocaleDateString('es-CL') : 'S/F'}</p></div>
                      </div>
                    </div>

                    {/* RP. CUERPO */}
                    <div className="text-left">
                      <h3 className="text-2xl font-black text-slate-900 mb-4 italic opacity-10 text-left">Rp.</h3>
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-medium pl-6 border-l-2 border-slate-200 text-left">
                        {recetaSeleccionada.indicaciones}
                      </p>
                    </div>
                  </div>

                  {/* PIE DE PÁGINA */}
                  <div>
                    <div className="pt-16 flex justify-end">
                      <div className="w-80 flex flex-col items-center text-center">
                        <div className="w-full h-20 mb-2 flex items-center justify-center relative">
                          {recetaSeleccionada.profesional_data?.firma_base64 ? (
                            <img
                              src={recetaSeleccionada.profesional_data.firma_base64}
                              alt="Firma Especialista"
                              className="max-h-20 w-auto object-contain mix-blend-multiply"
                            />
                          ) : (
                            <div className="text-[8px] text-slate-300 uppercase font-black mb-4 italic">Firma no registrada</div>
                          )}
                        </div>
                        <div className="h-px bg-slate-900 w-full mb-2"/>
                        <p className="text-xs font-black uppercase text-slate-900 leading-tight">
                          Dr/a. {recetaSeleccionada.profesional_data?.nombre} {recetaSeleccionada.profesional_data?.apellido}
                        </p>
                        <p className="text-[10px] font-bold uppercase text-slate-500">{recetaSeleccionada.profesional_data?.especialidad_nombre}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 italic">RUT: {recetaSeleccionada.profesional_data?.rut}</p>
                      </div>
                    </div>
                   
                    <p className="mt-6 text-center text-[8px] font-bold text-slate-400 uppercase tracking-[0.4em] text-center">
                      Venancia Leiva 1871, La Pintana • +569 6646 7641
                    </p>
                  </div>
                </div>

                {/* BOTÓN FLOTANTE */}
                <button onClick={handlePrint} className="fixed bottom-10 right-10 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 rounded-full shadow-2xl print:hidden hover:scale-110 transition-all z-50 no-print border border-blue-500">
                  <Printer size={24}/>
                </button>
              </div>
            ) : (
              <div className="h-[600px] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-xl text-center print:hidden">
                <ClipboardList size={48} className="text-slate-300 mb-4" />
                <p className="text-slate-400 font-black uppercase text-xs tracking-widest italic text-center">Seleccione una receta</p>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  )
}
