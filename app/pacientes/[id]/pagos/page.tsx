'use client'

import React, { useState, useEffect } from 'react'

import { useParams } from 'next/navigation'

import { supabase } from '@/lib/supabase'

import {  

  Loader2, Coins, ReceiptText, CheckCircle2, AlertCircle,

  CreditCard, Banknote, Landmark, History, Ban, EyeOff, ChevronUp,

  ChevronDown, Printer, Trash2, FileText, Wallet, Plus, User, X, ClipboardList, CheckSquare

} from 'lucide-react'

import { toast } from 'sonner'

import { motion, AnimatePresence } from 'framer-motion'



export default function PagosPacientePage() {

  const { id: paciente_id } = useParams()

 

  const [cargando, setCargando] = useState(true)

  const [cargandoAccion, setCargandoAccion] = useState(false)

 

  const [pacienteInfo, setPacienteInfo] = useState<any>(null)

  const [deudas, setDeudas] = useState<any[]>([])

  const [deudaTotalPlan, setDeudaTotalPlan] = useState(0)

  const [planesDetallados, setPlanesDetallados] = useState<any[]>([])

  const [historialPagos, setHistorialPagos] = useState<any[]>([])

 

  // ESTADOS DE ROL Y PERMISOS

  const [perfil, setPerfil] = useState<any>(null);

  const puedeVerFinanzas = perfil?.rol === 'ADMIN' || perfil?.rol === 'RECEPCIONISTA';



  // ESTADOS SESIONES Y UI

  const [usuarioLogueado, setUsuarioLogueado] = useState<any>(null);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [cajaActivaId, setCajaActivaId] = useState<string | null>(null);



  // 🔥 NUEVOS ESTADOS PARA PAGO SELECTIVO 🔥

  const [pagosSeleccionados, setPagosSeleccionados] = useState<Record<string, number>>({})

  const [metodoPago, setMetodoPago] = useState('Transferencia')

  const [numeroOperacion, setNumeroOperacion] = useState('')



  // ESTADOS PARA EL NUEVO MODAL DE ABONO LIBRE (SALDO A FAVOR)

  const [modalAbonoLibreAbierto, setModalAbonoLibreAbierto] = useState(false)

  const [montoAbonoLibre, setMontoAbonoLibre] = useState<number | ''>('')

  const [metodoAbonoLibre, setMetodoAbonoLibre] = useState('Transferencia')

  const [codigoAbonoLibre, setCodigoAbonoLibre] = useState('')

 

  // Estado para impresión

  const [pagoAImprimir, setPagoAImprimir] = useState<any>(null)



  useEffect(() => {

    if (paciente_id) {

      cargarDatosFinancieros()

    }

  }, [paciente_id])



  async function cargarDatosFinancieros() {

    setCargando(true)

    try {

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {

          setUsuarioLogueado(session.user);

          const { data: perfilData } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single();

          setPerfil(perfilData);

      }



      const { data: cajaActiva } = await supabase.from('sesiones_caja').select('id').eq('estado', 'abierta').maybeSingle();

      setCajaActivaId(cajaActiva?.id || null);



      const { data: pacData } = await supabase.from('pacientes').select('*').eq('id', paciente_id).single()

      setPacienteInfo(pacData)



      const { data: presupuestosPaciente } = await supabase

        .from('presupuestos')

        .select('id, nombre_tratamiento')

        .eq('paciente_id', paciente_id)

        .eq('aprobado', true)



      const idsPresupuestos = presupuestosPaciente?.map(p => p.id) || [];

      let itemsConDeuda: any[] = [];

      let deudaPlanCompleto = 0;

      let planesParaVista: any[] = [];



      if (idsPresupuestos.length > 0) {

        const { data: itemsData } = await supabase

            .from('presupuesto_items')

            .select(`id, observacion, precio_pactado, abonado, estado, progreso,

                diente_id,

                profesional_id,

                presupuesto_id,

                prestaciones:prestacion_id("Nombre Accion", "Nombre"),

                profesional:profesional_id(nombre, apellido)

            `)

            .in('presupuesto_id', idsPresupuestos)

            .not('estado', 'eq', 'cancelada');



        const todosLosItemsMapeados = (itemsData || []).map(item => {

            const precio = Number(item.precio_pactado || 0);

            const abonado = Number(item.abonado || 0);

            const deuda = precio - abonado;

           

            let nombreDisplay = item.observacion || "Tratamiento";

           

            if (item.prestaciones) {

                const pres = Array.isArray(item.prestaciones)

                    ? (item.prestaciones[0] as Record<string, any>)

                    : (item.prestaciones as Record<string, any>);

                nombreDisplay = pres?.["Nombre Accion"] || pres?.["Nombre"] || nombreDisplay;

            } else if (item.observacion && item.observacion.includes('|')) {

                nombreDisplay = item.observacion.split('|')[0].trim();

            }



            const prof = Array.isArray(item.profesional) ? item.profesional[0] : item.profesional;

            const doctor = prof

                ? `Dr/a. ${(prof as any).nombre || ''} ${(prof as any).apellido || ''}`.trim()

                : 'Sin asignar';



            return { ...item, deuda, nombreDisplay, doctor };

        }).filter(item => item.deuda > 0);



        planesParaVista = (presupuestosPaciente || []).map(plan => {

          const itemsDelPlan = todosLosItemsMapeados.filter(item => item.presupuesto_id === plan.id);

          const deudaDelPlan = itemsDelPlan.reduce((acc, item) => acc + item.deuda, 0);

          return {

            id: plan.id,

            nombre: plan.nombre_tratamiento || 'Tratamiento General',

            deudaTotal: deudaDelPlan

          };

        }).filter(p => p.deudaTotal > 0);



        deudaPlanCompleto = todosLosItemsMapeados.reduce((acc, item) => acc + item.deuda, 0);



        itemsConDeuda = todosLosItemsMapeados.filter(item => {

            const estado = String(item.estado || 'pendiente').toLowerCase();

            return ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(estado) || (item.progreso && item.progreso > 0);

        });

      }

      setDeudas(itemsConDeuda);

      setDeudaTotalPlan(deudaPlanCompleto);

      setPlanesDetallados(planesParaVista);



      const { data: pagosData } = await supabase

        .from('pagos')

        .select('*, perfiles:anulado_por(nombre_completo), receptor:profesional_id(nombre_completo)')

        .eq('paciente_id', paciente_id)

        .order('fecha_pago', { ascending: false })

     

      setHistorialPagos(pagosData || []);



    } catch (error) {

      console.error(error)

      toast.error("Error al cargar la información financiera")

    } finally {

      setCargando(false)

    }

  }



  // 🔥 FUNCIONES PAGO SELECTIVO 🔥

  const toggleSeleccionPago = (itemId: string, deudaMaxima: number) => {

    setPagosSeleccionados(prev => {

        const nuevos = { ...prev };

        if (nuevos[itemId] !== undefined) {

            delete nuevos[itemId]; // Deseleccionar

        } else {

            nuevos[itemId] = deudaMaxima; // Seleccionar pagando el total por defecto

        }

        return nuevos;

    });

  }



  const handleMontoParcialChange = (itemId: string, monto: number, deudaMaxima: number) => {

    setPagosSeleccionados(prev => ({

        ...prev,

        [itemId]: Math.min(Math.max(0, monto), deudaMaxima) // Evitar que paguen más de la deuda o valores negativos

    }));

  }



  const montoTotalAPagar = Object.values(pagosSeleccionados).reduce((a, b) => a + b, 0);



  const procesarAbonoLibre = async () => {

    if (!cajaActivaId) {

      return toast.error("No se puede procesar el abono: No hay caja abierta.");

    }



    if (!montoAbonoLibre || Number(montoAbonoLibre) <= 0) return toast.error("Ingrese un monto válido");

    if ((metodoAbonoLibre === 'Transferencia' || metodoAbonoLibre === 'Tarjeta') && !codigoAbonoLibre.trim()) {

        return toast.error("Debe ingresar el código de la transacción obligatoriamente.");

    }



    setCargandoAccion(true);

    try {

        const montoNuevo = Number(montoAbonoLibre);

        const saldoActual = Number(pacienteInfo?.saldo_a_favor || 0);

       

        const detalleAbono = [{ prestacion: "Ingreso Manual a Saldo a Favor", diente: null, precio: montoNuevo, doctor: "-", abonado_ahora: montoNuevo }];



        const { data: nuevoPago, error: errPago } = await supabase.from('pagos').insert([{

            paciente_id: paciente_id,

            monto: montoNuevo,

            metodo_pago: metodoAbonoLibre,

            numero_boleta: codigoAbonoLibre.trim() || 'S/N',

            profesional_id: usuarioLogueado?.id,

            fecha_pago: new Date().toISOString(),

            comentario: JSON.stringify(detalleAbono),

            caja_id: cajaActivaId

        }]).select().single();



        if (errPago) throw errPago;



        await supabase.from('pacientes').update({ saldo_a_favor: saldoActual + montoNuevo }).eq('id', paciente_id);



        await supabase.from('auditoria_clinica').insert([{

            usuario_id: usuarioLogueado?.id,

            accion: 'INSERT / ABONO MANUAL',

            tabla: 'pagos, pacientes',

            detalles: `Ingresó $${montoNuevo.toLocaleString('es-CL')} al saldo a favor de ${pacienteInfo?.nombre} ${pacienteInfo?.apellido} (RUT: ${pacienteInfo?.rut}). Método: ${metodoAbonoLibre}.`

        }]);



        toast.success(`Se agregaron $${montoNuevo.toLocaleString('es-CL')} al Saldo a Favor.`);

        setModalAbonoLibreAbierto(false);

        setMontoAbonoLibre('');

        setCodigoAbonoLibre('');

       

        await cargarDatosFinancieros();



        if(window.confirm("¿Desea imprimir el comprobante de este ingreso?")) {

            imprimirComprobante(nuevoPago);

        }



    } catch (e) {

        toast.error("Error al procesar el ingreso manual");

    } finally {

        setCargandoAccion(false);

    }

  }



  // 🔥 LÓGICA DE PAGO SELECTIVO ACTUALIZADA 🔥

  const procesarPagoCaja = async () => {

    if (!cajaActivaId) {

      return toast.error("No se puede procesar el pago: No hay caja abierta.");

    }



    if (montoTotalAPagar <= 0) {

        return toast.error("Seleccione al menos un tratamiento para pagar e ingrese un monto válido.");

    }



    if ((metodoPago === 'Transferencia' || metodoPago === 'Tarjeta' || metodoPago === 'Efectivo') && !numeroOperacion.trim()) {

        return toast.error(`Debe ingresar el ${metodoPago === 'Efectivo' ? 'N° de Boleta' : 'código de referencia'} obligatoriamente.`);

    }



    const saldoActual = Number(pacienteInfo?.saldo_a_favor || 0);



    if (metodoPago === 'Saldo a Favor') {

        if (montoTotalAPagar > saldoActual) return toast.error("Fondos insuficientes en Billetera Virtual");

    }



    setCargandoAccion(true);

    let detallesDelPago: any[] = [];

   

    try {

        const itemIdsAPagar = Object.keys(pagosSeleccionados);



        for (const itemId of itemIdsAPagar) {

            const aAbonar = pagosSeleccionados[itemId];

            if (aAbonar <= 0) continue;



            const itemInfo = deudas.find(d => d.id === itemId);

            if (!itemInfo) continue;

           

            const detalleItem = {

                id: itemInfo.id,

                prestacion: itemInfo.nombreDisplay,

                diente: itemInfo.diente_id,

                precio: itemInfo.precio_pactado,

                doctor: itemInfo.doctor,

                abonado_ahora: aAbonar

            };

            detallesDelPago.push(detalleItem);



            await supabase.from('pagos').insert([{

                paciente_id: paciente_id,

                monto: aAbonar,

                metodo_pago: metodoPago,

                numero_boleta: numeroOperacion.trim() || 'S/N',

                profesional_id: itemInfo.profesional_id,

                item_id: itemInfo.id,

                fecha_pago: new Date().toISOString(),

                comentario: JSON.stringify([detalleItem]),

                caja_id: cajaActivaId

            }]);



            await supabase.from('presupuesto_items').update({ abonado: Number(itemInfo.abonado) + aAbonar }).eq('id', itemInfo.id);

        }



        let nuevoSaldoAFavor = saldoActual;



        if (metodoPago === 'Saldo a Favor') {

            nuevoSaldoAFavor = saldoActual - montoTotalAPagar;

            await supabase.from('pacientes').update({ saldo_a_favor: nuevoSaldoAFavor }).eq('id', paciente_id);

            toast.success(`Pago procesado. Se descontaron $${montoTotalAPagar.toLocaleString('es-CL')} de su saldo a favor.`);

            setPacienteInfo((prev: any) => ({ ...prev, saldo_a_favor: nuevoSaldoAFavor }));

        } else {

            toast.success(`Pago de tratamientos procesado con éxito.`);

        }



        const detalleAuditoriaPago = `Registró un pago selectivo de $${montoTotalAPagar.toLocaleString('es-CL')} para ${pacienteInfo?.nombre} ${pacienteInfo?.apellido}. Método: ${metodoPago}. Deuda cubierta en ${detallesDelPago.length} item(s).`;

       

        await supabase.from('auditoria_clinica').insert([{

            usuario_id: usuarioLogueado?.id,

            accion: 'INSERT / PAGO TRATAMIENTO',

            tabla: 'pagos, presupuesto_items, pacientes',

            detalles: detalleAuditoriaPago.trim()

        }]);



        setPagosSeleccionados({});

        setNumeroOperacion('');

       

        await cargarDatosFinancieros();

       

        const pagoConsolidadoParaImprimir = {

            monto: montoTotalAPagar,

            metodo_pago: metodoPago,

            numero_boleta: numeroOperacion.trim() || 'S/N',

            fecha_pago: new Date().toISOString(),

            comentario: JSON.stringify(detallesDelPago)

        };



        if(window.confirm("¿Desea imprimir el comprobante de pago ahora?")) {

            imprimirComprobante(pagoConsolidadoParaImprimir);

        }



    } catch (e) {

        toast.error("Ocurrió un error al procesar el pago");

    } finally {

        setCargandoAccion(false);

    }

  }



  const reversarPago = async (pago: any) => {

    if (perfil?.rol !== 'ADMIN' && perfil?.rol !== 'RECEPCIONISTA') {

      return toast.error('No tienes permisos para anular pagos.')

    }



    const esAbonoLibre = !pago.item_id;

    const mensajeConfirmacion = esAbonoLibre

      ? `Estás a punto de anular un INGRESO MANUAL a la billetera por $${Number(pago.monto).toLocaleString('es-CL')}.\n\n` +

        `Al presionar "ACEPTAR", el pago se anulará y el monto se DESCONTARÁ del Saldo a Favor del paciente.\n\n` +

        `Si presionas "CANCELAR", no se realizará ninguna acción.`

      : `Estás a punto de anular un PAGO A TRATAMIENTO por $${Number(pago.monto).toLocaleString('es-CL')}.\n\n` +

        `Al presionar "ACEPTAR", el pago se anulará, la deuda del tratamiento se restaurará y el monto se AGREGARÁ al Saldo a Favor (Billetera Virtual) del paciente.\n\n` +

        `Si presionas "CANCELAR", no se realizará ninguna acción.`;



    const enviarASaldo = window.confirm(mensajeConfirmacion);



    if (!enviarASaldo) {

      return;

    }



    if (pago.estado === 'Anulado') return toast.info("Este pago ya fue anulado.");



    setCargandoAccion(true);

    try {

      const montoReversado = Number(pago.monto);



      if (pago.item_id) {

        const { data: itemActual } = await supabase

          .from('presupuesto_items')

          .select('abonado, presupuesto_id')

          .eq('id', pago.item_id)

          .single();

       

        if (itemActual) {

          const nuevoAbonoItem = Math.max(0, Number(itemActual.abonado || 0) - montoReversado);

          await supabase.from('presupuesto_items').update({ abonado: nuevoAbonoItem }).eq('id', pago.item_id);



          if (itemActual.presupuesto_id) {

            const { data: presActual } = await supabase.from('presupuestos').select('total_abonado').eq('id', itemActual.presupuesto_id).single();

            if (presActual) {

              const nuevoTotalAbonado = Math.max(0, Number(presActual.total_abonado || 0) - montoReversado);

              await supabase.from('presupuestos').update({ total_abonado: nuevoTotalAbonado }).eq('id', itemActual.presupuesto_id);

            }

          }

        }

      }



      const saldoActual = Number(pacienteInfo?.saldo_a_favor || 0);

      let nuevoSaldo;

      let detallesAuditoria;



      if (pago.item_id) {

        nuevoSaldo = saldoActual + montoReversado;

        detallesAuditoria = `Anuló un pago a tratamiento de $${pago.monto.toLocaleString('es-CL')}. Destino: SALDO A FAVOR`;

      } else {

        nuevoSaldo = Math.max(0, saldoActual - montoReversado);

        detallesAuditoria = `Anuló un ingreso manual de $${pago.monto.toLocaleString('es-CL')}. Se descuenta de SALDO A FAVOR`;

      }



      await supabase.from('pacientes').update({ saldo_a_favor: nuevoSaldo }).eq('id', paciente_id);

      setPacienteInfo((prev: any) => ({ ...prev, saldo_a_favor: nuevoSaldo }));

     

      const { data: { session } } = await supabase.auth.getSession();

      await supabase.from('pagos').update({ estado: 'Anulado', anulado_por: session?.user?.id, fecha_anulacion: new Date().toISOString() }).eq('id', pago.id);

     

      await supabase.from('auditoria_clinica').insert([{

         usuario_id: session?.user?.id,

         accion: 'UPDATE / ANULACIÓN PAGO',

         detalles: detallesAuditoria

      }]);



      toast.success("Pago anulado. El saldo del paciente ha sido ajustado.");

      await cargarDatosFinancieros();



    } catch (e) {

      console.error(e);

      toast.error("Error al reversar el pago");

    } finally {

      setCargandoAccion(false);

    }

  }



  const handleEditarSaldoAFavor = async () => {

    if (perfil?.rol !== 'ADMIN') {

      return toast.error("Solo los administradores pueden editar el saldo manualmente.");

    }



    const motivo = window.prompt(

      "⚠️ ¡ACCIÓN DELICADA! ⚠️\n\n" +

      "Estás a punto de SOBREESCRIBIR el saldo a favor del paciente.\n" +

      "Esta acción es para corregir errores y debe usarse con extrema precaución.\n\n" +

      "Por favor, ingresa un motivo claro para esta corrección (ej: 'Ajuste por error en vuelto del 15/05'):"

    );



    if (!motivo || motivo.trim() === '') {

      return toast.info("La edición fue cancelada. No se ingresó un motivo.");

    }



    const nuevoSaldoStr = window.prompt("Ahora, ingresa el NUEVO MONTO EXACTO del saldo a favor (solo números):");

   

    if (nuevoSaldoStr === null) {

      return toast.info("Edición cancelada.");

    }



    const nuevoSaldo = Number(nuevoSaldoStr);



    if (isNaN(nuevoSaldo) || nuevoSaldo < 0) {

      return toast.error("Monto inválido. Por favor, ingresa solo números positivos.");

    }



    const confirmacionFinal = window.confirm(

      `CONFIRMACIÓN FINAL:\n\n` +

      `El saldo a favor de ${pacienteInfo?.nombre} ${pacienteInfo?.apellido} se establecerá en:\n\n` +

      `$${nuevoSaldo.toLocaleString('es-CL')}\n\n` +

      `Motivo: ${motivo.trim()}\n\n` +

      `¿Estás absolutamente seguro? Esta acción no se puede deshacer fácilmente.`

    );



    if (!confirmacionFinal) {

      return toast.info("Edición cancelada por el usuario.");

    }



    setCargandoAccion(true);

    try {

      const saldoAnterior = Number(pacienteInfo?.saldo_a_favor || 0);

      await supabase.from('pacientes').update({ saldo_a_favor: nuevoSaldo }).eq('id', paciente_id);

      await supabase.from('auditoria_clinica').insert([{

        usuario_id: usuarioLogueado?.id,

        accion: 'UPDATE / EDICIÓN MANUAL SALDO A FAVOR',

        detalles: `Admin cambió saldo de $${saldoAnterior.toLocaleString('es-CL')} a $${nuevoSaldo.toLocaleString('es-CL')}. Motivo: ${motivo.trim()}`

      }]);

      toast.success("Saldo a favor actualizado manualmente.");

      await cargarDatosFinancieros();

    } catch (e) { toast.error("Error al actualizar el saldo."); } finally { setCargandoAccion(false); }

  }



  const imprimirComprobante = (pago: any) => {

    setPagoAImprimir(pago);

   

    setTimeout(() => {

        const elementoOriginal = document.getElementById('comprobante-impresion');

        if (!elementoOriginal) return toast.error("Error al preparar el documento");



        const clon = elementoOriginal.cloneNode(true) as HTMLElement;

        clon.classList.remove('hidden');

        const contenido = clon.innerHTML;



        const ventanaPoderosa = window.open('', '_blank', 'width=1000,height=900');

        if (!ventanaPoderosa) return toast.error("Por favor permite los pop-ups en tu navegador");



        ventanaPoderosa.document.write(`

          <html>

            <head>

              <title>Comprobante de Pago - ${pacienteInfo?.nombre} ${pacienteInfo?.apellido}</title>

              <script src="https://cdn.tailwindcss.com"></script>

              <style>

                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');

                @page { margin: 1cm; size: letter; }

                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: white; color: black; }

                .content-wrapper { padding: 1.5cm 2cm; box-sizing: border-box; width: 100%; max-width: 21cm; margin: 0 auto; }

                * { word-wrap: break-word !important; }

              </style>

            </head>

            <body>

              <div class="content-wrapper">

                ${contenido}

              </div>

              <script>

                window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 800); };

              </script>

            </body>

          </html>

        `);

        ventanaPoderosa.document.close();

    }, 100);

  }



  const getDetalles = (comentario: string) => {

    try { return JSON.parse(comentario || '[]'); }

    catch(e) { return []; }

  }



  if (cargando) return (

    <div className="h-full min-h-[400px] flex flex-col items-center justify-center print:hidden">

      <Loader2 className="animate-spin text-emerald-500 mb-4" size={45} />

      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Cargando estado de cuenta...</p>

    </div>

  )



  const deudaTotal = deudas.reduce((acc, curr) => acc + curr.deuda, 0);

  const deudaPlan = deudaTotalPlan;

  const saldoAFavor = Number(pacienteInfo?.saldo_a_favor || 0);



  if (perfil && !puedeVerFinanzas) {

    return (

      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-white/90 backdrop-blur-xl rounded-[3rem] shadow-xl border border-white/60">

        <EyeOff className="text-slate-300 mb-4" size={48} />

        <h3 className="text-lg font-black text-slate-700 uppercase">Acceso Restringido</h3>

        <p className="text-sm text-slate-500 max-w-sm mt-2">No tienes los permisos necesarios para visualizar la información financiera de los pacientes.</p>

      </div>

    )

  }



  const detallesImpresion = getDetalles(pagoAImprimir?.comentario);



  return (

    <>

      <div className="p-6 md:p-10 text-left h-full print:hidden">

       

        {/* CABECERA SUPERIOR */}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/60">

            <div className="flex items-center gap-4">

              <div className="p-4 rounded-[1.5rem] bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-xl shadow-emerald-500/20">

                <ReceiptText size={28} strokeWidth={2.5} />

              </div>

              <div>

                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800 leading-none">Caja y Recaudación</h2>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">

                  <User size={12}/> {pacienteInfo?.nombre} {pacienteInfo?.apellido}

                </p>

                <div className={`mt-3 inline-flex items-center gap-2 border px-3.5 py-1.5 rounded-xl shadow-sm ${saldoAFavor > 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-slate-50 border-slate-200/80'}`}>

                  <Wallet size={14} className={saldoAFavor > 0 ? 'text-emerald-600' : 'text-slate-400'} />

                  <span className={`text-[10px] font-black uppercase tracking-widest ${saldoAFavor > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>

                    Billetera: <span className={saldoAFavor > 0 ? 'text-emerald-600' : 'text-slate-700'}>${saldoAFavor.toLocaleString('es-CL')}</span>

                  </span>

                </div>

              </div>

            </div>



            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">

                <button

                  disabled={!cajaActivaId}

                  onClick={() => setModalAbonoLibreAbierto(true)}

                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-400"

                >

                  <Plus size={16} strokeWidth={3} /> Ingresar Saldo a Favor

                </button>

            </div>

        </div>



        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

         

          {/* PANEL PRINCIPAL: COBRO DE DEUDAS */}

          <div className="lg:col-span-7 space-y-6">

            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-center sm:items-start gap-6 border border-slate-800">

              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-white">

                <Coins size={120} />

              </div>

              <div className="relative z-10 w-full">

                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Deuda Exigible (Trabajo Realizado)</p>

                <p className={`text-4xl md:text-5xl font-black tracking-tighter ${deudaTotal > 0 ? 'text-white' : 'text-emerald-400'}`}>

                  ${deudaTotal.toLocaleString('es-CL')}

                </p>

                {planesDetallados.length > 1 && deudaPlan > deudaTotal ? (

                  <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">

                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desglose Deuda Total</p>

                    {planesDetallados.map(plan => (

                      <div key={plan.id} className="flex justify-between items-center text-sm">

                        <span className="font-bold text-slate-300 uppercase">{plan.nombre}</span>

                        <span className="font-black text-slate-200">${plan.deudaTotal.toLocaleString('es-CL')}</span>

                      </div>

                    ))}

                  </div>

                ) : deudaPlan > deudaTotal ? (

                  <p className="text-sm font-bold text-slate-400 mt-2">

                    Deuda Plan Completo: <span className="text-slate-200">${deudaPlan.toLocaleString('es-CL')}</span>

                  </p>

                ) : null}

              </div>



              <div className="relative z-10 bg-emerald-500/20 border border-emerald-500/30 p-5 rounded-3xl w-full sm:w-auto shrink-0 text-center sm:text-right flex flex-col justify-between backdrop-blur-md">

                <div>

                    <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Saldo a Favor</p>

                    <p className="text-2xl font-black text-emerald-400">${saldoAFavor.toLocaleString('es-CL')}</p>

                </div>

                {perfil?.rol === 'ADMIN' && (

                  <button

                    onClick={handleEditarSaldoAFavor}

                    className="mt-3 bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[9px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-xl hover:bg-amber-400 hover:text-slate-900 transition-all"

                    title="Editar Saldo Manualmente (Acción Delicada)"

                  >

                    Editar Saldo

                  </button>

                )}

              </div>

            </div>



            {/* DETALLE DE LO QUE SE DEBE - SELECCIONABLE 🔥 */}

            {deudas.length > 0 && (

              <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] border border-white/60 shadow-xl">

                   <div className="flex justify-between items-center mb-6">

                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">

                          <CheckSquare size={14} /> Selecciona tratamientos a pagar

                       </h4>

                       <button

                          onClick={() => {

                              if (Object.keys(pagosSeleccionados).length === deudas.length) {

                                  setPagosSeleccionados({});

                              } else {

                                  const todos: Record<string, number> = {};

                                  deudas.forEach(d => { todos[d.id] = d.deuda; });

                                  setPagosSeleccionados(todos);

                              }

                          }}

                          className="text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-800 transition-colors"

                       >

                          {Object.keys(pagosSeleccionados).length === deudas.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}

                       </button>

                   </div>

                   

                   <div className="space-y-3">

                    {deudas.map(d => {

                        const isSelected = pagosSeleccionados[d.id] !== undefined;

                        const montoPagar = pagosSeleccionados[d.id] || 0;



                        return (

                            <div key={d.id}

                                className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 md:p-5 rounded-2xl border transition-colors shadow-sm ${isSelected ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50/80 border-slate-200/60 hover:bg-white cursor-pointer'}`}

                                onClick={() => { if (!isSelected) toggleSeleccionPago(d.id, d.deuda) }}

                            >

                                <div className="flex items-start gap-3 flex-1 pr-4 mb-3 md:mb-0 w-full" onClick={(e) => { if (isSelected) { e.stopPropagation(); toggleSeleccionPago(d.id, d.deuda) } }}>

                                    <div className="pt-1 shrink-0 cursor-pointer">

                                        <input type="checkbox" className="w-4 h-4 accent-emerald-500 cursor-pointer" checked={isSelected} readOnly />

                                    </div>

                                    <div className="text-left w-full cursor-pointer">

                                        <div className="flex items-center gap-3 mb-1.5 flex-wrap">

                                            <p className={`text-xs font-black uppercase leading-none ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>{d.nombreDisplay} {d.diente_id ? `(Pieza ${d.diente_id})` : ''}</p>

                                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest leading-none ${d.estado === 'realizado' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>

                                                {d.estado}

                                            </span>

                                        </div>

                                        <p className={`text-[9px] font-bold tracking-widest ${isSelected ? 'text-emerald-700/60' : 'text-slate-400'}`}>

                                            {d.doctor} | Pactado: ${Number(d.precio_pactado).toLocaleString('es-CL')} | Pagado: <span className={isSelected ? 'text-emerald-700' : 'text-slate-600'}>${Number(d.abonado).toLocaleString('es-CL')}</span>

                                        </p>

                                    </div>

                                </div>

                               

                                <div className="text-right shrink-0 w-full md:w-auto flex flex-row md:flex-col justify-between items-center md:items-end gap-2 pl-7 md:pl-0 border-t border-slate-200 md:border-0 pt-3 md:pt-0">

                                    <p className="text-sm font-black text-red-500">Deuda: ${d.deuda.toLocaleString('es-CL')}</p>

                                    {isSelected && (

                                        <div className="flex items-center gap-2">

                                            <span className="text-[9px] font-black text-emerald-600 uppercase">Abonar:</span>

                                            <div className="relative">

                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600/50 font-black text-xs">$</span>

                                                <input

                                                    type="number"

                                                    className="w-28 py-2 pl-6 pr-2 bg-white border border-emerald-300 rounded-lg text-sm font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 text-right shadow-sm"

                                                    value={montoPagar || ''}

                                                    onChange={(e) => handleMontoParcialChange(d.id, Number(e.target.value), d.deuda)}

                                                    onClick={(e) => e.stopPropagation()}

                                                />

                                            </div>

                                        </div>

                                    )}

                                </div>

                            </div>

                        )

                    })}

                   </div>

              </div>

            )}



            {deudaTotal > 0 ? (

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl space-y-6">

                <h3 className="text-sm font-black text-emerald-700 uppercase flex items-center gap-2">

                  <Coins size={16} /> Procesar Pagos

                </h3>

                {!cajaActivaId && (

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-xs font-bold flex items-center gap-3 shadow-sm">

                        <AlertCircle size={20} className="shrink-0" />

                        <div>

                            <p className="font-black">PAGOS BLOQUEADOS: NO HAY CAJA ABIERTA</p>

                            <p className="font-medium">Para poder registrar pagos, un recepcionista debe iniciar un turno desde el módulo de Cajas.</p>

                        </div>

                    </div>

                )}



                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

                  <div className="space-y-1.5">

                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Método de Pago</label>

                    <div className="relative">

                      <select

                        disabled={!cajaActivaId}

                        className="w-full p-4 pl-11 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200/60 focus:border-emerald-500/50 rounded-2xl font-bold text-xs uppercase text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 appearance-none cursor-pointer shadow-sm disabled:opacity-50"

                        value={metodoPago}

                        onChange={(e) => setMetodoPago(e.target.value)}

                      >

                          <option value="Transferencia">Transferencia</option>

                          <option value="Tarjeta">Tarjeta de Crédito/Débito</option>

                          <option value="Efectivo">Efectivo</option>

                          {saldoAFavor > 0 && (

                              <option value="Saldo a Favor">💰 Saldo a Favor (${saldoAFavor.toLocaleString('es-CL')})</option>

                          )}

                      </select>

                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">

                        {metodoPago === 'Tarjeta' ? <CreditCard size={18} /> : metodoPago === 'Efectivo' ? <Banknote size={18} /> : metodoPago === 'Saldo a Favor' ? <Wallet size={18}/> : <Landmark size={18} />}

                      </div>

                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>

                    </div>

                  </div>

                 

                  {/* 🔥 AHORA ESTE CAMPO ES AUTOMÁTICO SEGÚN LO SELECCIONADO 🔥 */}

                  <div className="space-y-1.5">

                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Monto Total a Pagar</label>

                    <div className="relative">

                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-base">$</span>

                      <div className={`w-full py-4 pl-10 pr-5 border rounded-2xl font-black text-base transition-all shadow-sm ${montoTotalAPagar > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>

                         {montoTotalAPagar.toLocaleString('es-CL')}

                      </div>

                    </div>

                  </div>

                </div>



                <div className="space-y-1.5 mb-6">

                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">

                    {metodoPago === 'Transferencia' ? 'Código de Transferencia (*)' :

                     metodoPago === 'Tarjeta' ? 'N° Voucher Transbank (*)' :

                     'N° Boleta SII (*)'}

                  </label>

                  <div className="relative">

                    <input

                      type="text"

                      disabled={metodoPago === 'Saldo a Favor' || !cajaActivaId}

                      placeholder={metodoPago === 'Saldo a Favor' ? "Pago interno automático" : metodoPago === 'Transferencia' ? "Ej: TR-109244" : metodoPago === 'Tarjeta' ? "Ej: V973W6" : "Ej: Boleta 102"}

                      className={`w-full p-4 pl-11 bg-slate-50/80 hover:bg-white focus:bg-white border rounded-2xl font-bold text-xs uppercase text-slate-800 outline-none focus:ring-4 transition-all placeholder:text-slate-300 shadow-sm disabled:opacity-50 disabled:bg-slate-100 ${

                        (metodoPago !== 'Saldo a Favor') && !numeroOperacion.trim()

                          ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/10'

                          : 'border-slate-200/60 focus:border-emerald-500/50 focus:ring-emerald-500/10'

                      }`}

                      value={numeroOperacion}

                      onChange={(e) => setNumeroOperacion(e.target.value)}

                    />

                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />

                  </div>

                  {(metodoPago !== 'Saldo a Favor') && !numeroOperacion.trim() && (

                    <p className="text-[9px] font-bold text-amber-600 pl-1 mt-1">Este campo es obligatorio para este método de pago.</p>

                  )}

                </div>



                <button

                  onClick={procesarPagoCaja}

                  disabled={cargandoAccion || montoTotalAPagar <= 0 || !cajaActivaId}

                  className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3 border border-emerald-400"

                >

                  {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18} strokeWidth={2.5}/>}

                  {montoTotalAPagar <= 0 ? 'Selecciona un tratamiento arriba' : `Pagar $${montoTotalAPagar.toLocaleString('es-CL')}`}

                </button>

              </motion.div>

            ) : (

              <div className="py-16 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center bg-white/50 backdrop-blur-md shadow-sm">

                   <CheckCircle2 size={56} className="text-emerald-500 mb-4 opacity-80"/>

                   <h3 className="text-lg font-black uppercase text-slate-800">Paciente al día</h3>

                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 max-w-[250px]">No existen tratamientos aprobados con deuda pendiente por cobrar.</p>

              </div>

            )}

          </div>



          {/* PANEL SECUNDARIO: HISTORIAL DE PAGOS */}

          <aside className="lg:col-span-5">

            <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/60 shadow-xl h-full">

                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">

                    <History size={14} /> Historial de Pagos

                </h4>



                {historialPagos.length === 0 ? (

                    <div className="text-center py-16 opacity-50">

                        <ReceiptText size={40} className="mx-auto text-slate-400 mb-3" />

                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">No hay pagos registrados</p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full text-left min-w-[500px]">

                            <thead>

                                <tr className="border-b border-slate-100">

                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase"># Pago</th>

                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Medio</th>

                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-right">Monto</th>

                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-center">Acciones</th>

                                </tr>

                            </thead>

                            <tbody className="divide-y divide-slate-100">

                                {historialPagos.map((pago) => {

                                    const isExpanded = expandedRow === pago.id;

                                    const dt = getDetalles(pago.comentario);

                                    const isAnulado = pago.estado === 'Anulado';

                                    const receptor = pago.receptor ? pago.receptor.nombre_completo : 'Sistema';



                                    return (

                                        <React.Fragment key={pago.id}>

                                            <tr className={`transition-colors text-xs ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}>

                                                <td className="p-3.5 align-top">

                                                    <p className="font-black text-slate-700 uppercase">#{pago.id.substring(0, 6)}</p>

                                                    <p className="text-[9px] font-bold text-slate-400">{new Date(pago.fecha_pago).toLocaleDateString('es-CL')}</p>

                                                </td>

                                                <td className="p-3.5 align-top">

                                                    <p className="font-bold text-slate-600">{pago.metodo_pago}</p>

                                                    <p className="text-[9px] text-slate-400">Ref: {pago.numero_boleta || 'S/N'}</p>

                                                </td>

                                                <td className="p-3.5 align-top text-right">

                                                    <p className={`font-black text-sm ${isAnulado ? 'text-red-500 line-through' : 'text-emerald-600'}`}>

                                                        ${Number(pago.monto).toLocaleString('es-CL')}

                                                    </p>

                                                </td>

                                                <td className="p-3.5 align-top text-center">

                                                    <div className="flex items-center justify-center gap-1">

                                                        <button onClick={() => setExpandedRow(isExpanded ? null : pago.id)} className="p-2 text-slate-400 hover:bg-slate-200/80 rounded-xl transition-colors" title="Ver desglose">

                                                            {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}

                                                        </button>

                                                        <button onClick={() => imprimirComprobante(pago)} className="p-2 text-slate-400 hover:bg-slate-200/80 rounded-xl transition-colors" title="Imprimir">

                                                            <Printer size={14} />

                                                        </button>

                                                        {!isAnulado && (

                                                            <button onClick={() => reversarPago(pago)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors" title="Anular">

                                                                <Trash2 size={14} />

                                                            </button>

                                                        )}

                                                    </div>

                                                </td>

                                            </tr>

                                            {isExpanded && (

                                                <tr>

                                                    <td colSpan={4} className="p-0">

                                                        <motion.div initial={{height: 0, opacity: 0}} animate={{height: 'auto', opacity: 1}} className="bg-slate-100/80 p-4 m-2 rounded-2xl border border-slate-200/60">

                                                            <h5 className="text-[9px] font-black text-slate-500 uppercase mb-2">Desglose del Pago</h5>

                                                            {dt.length > 0 ? (

                                                                <div className="space-y-2">

                                                                    {dt.map((d:any, i:number) => (

                                                                        <div key={i} className="flex justify-between items-start bg-white p-3 rounded-xl shadow-sm border border-slate-100">

                                                                            <div>

                                                                                <p className="text-[10px] font-black text-slate-700 uppercase">{d.prestacion} {d.diente ? `(Pza ${d.diente})` : ''}</p>

                                                                                <p className="text-[9px] font-bold text-slate-400">{d.doctor}</p>

                                                                            </div>

                                                                            <p className="text-[10px] font-bold text-emerald-600">${Number(d.abonado_ahora).toLocaleString('es-CL')}</p>

                                                                        </div>

                                                                    ))}

                                                                </div>

                                                            ) : <p className="text-xs text-slate-400 italic">Este pago fue un abono directo a la cuenta.</p>}

                                                            {isAnulado && pago.perfiles && (

                                                                <div className="mt-3 pt-3 border-t border-red-200 text-center">

                                                                    <p className="text-[9px] font-bold text-red-500">Anulado por {pago.perfiles.nombre_completo} el {new Date(pago.fecha_anulacion).toLocaleDateString('es-CL')}</p>

                                                                </div>

                                                            )}

                                                        </motion.div>

                                                    </td>

                                                </tr>

                                            )}

                                        </React.Fragment>

                                    )

                                })}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>

          </aside>



        </div>

      </div>



      {/* MODAL INGRESO MANUAL DE BILLETERA VIRTUAL */}

      <AnimatePresence>

        {modalAbonoLibreAbierto && (

          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4">

             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-[3rem] shadow-2xl flex flex-col overflow-hidden text-left border border-white/80">

                <div className="p-8 border-b border-emerald-100 bg-emerald-50/80 flex justify-between items-center shrink-0">

                   <div className="flex items-center gap-4">

                      <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-sm"><Wallet size={24}/></div>

                      <div>

                        <h2 className="font-black text-xl uppercase tracking-tighter text-emerald-900 leading-none">Ingresar Dinero</h2>

                        <p className="text-[10px] text-emerald-700/60 font-bold uppercase tracking-widest mt-1">Abono libre a Billetera Virtual</p>

                      </div>

                   </div>

                   <button onClick={() => setModalAbonoLibreAbierto(false)} className="p-2.5 text-emerald-500 hover:bg-emerald-100 rounded-2xl transition-colors"><X size={20}/></button>

                </div>



                <div className="p-8 space-y-6">

                    <p className="text-xs font-bold text-slate-500 leading-relaxed">Utilice esta opción cuando el paciente entregue un dinero por adelantado sin asignarlo a un tratamiento específico todavía.</p>

                   

                    <div className="space-y-1.5">

                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Monto del abono libre ($)</label>

                        <input type="number" placeholder="Ej: 50000" className="w-full p-4 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200/60 focus:border-emerald-500/50 rounded-2xl font-black text-base text-emerald-600 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm placeholder:text-slate-300" value={montoAbonoLibre} onChange={(e) => setMontoAbonoLibre(Number(e.target.value))} />

                    </div>



                    <div className="space-y-1.5">

                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Método de Pago</label>

                        <select className="w-full p-4 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200/60 focus:border-emerald-500/50 rounded-2xl font-bold text-xs uppercase text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm cursor-pointer" value={metodoAbonoLibre} onChange={(e) => setMetodoAbonoLibre(e.target.value)}>

                            <option value="Transferencia">Transferencia</option>

                            <option value="Tarjeta">Tarjeta de Crédito/Débito</option>

                            <option value="Efectivo">Efectivo</option>

                        </select>

                    </div>



                    {(metodoAbonoLibre === 'Tarjeta' || metodoAbonoLibre === 'Transferencia') && (

                        <div className="space-y-1.5">

                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Comprobante (Obligatorio)</label>

                            <input type="text" placeholder="Ej: TR-109244" className="w-full p-4 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200/60 focus:border-emerald-500/50 rounded-2xl font-bold text-xs uppercase text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm placeholder:text-slate-300" value={codigoAbonoLibre} onChange={(e) => setCodigoAbonoLibre(e.target.value)} />

                        </div>

                    )}

                </div>



                <div className="p-8 border-t border-slate-100 bg-white/50 shrink-0 text-right flex gap-3">

                   <button onClick={() => setModalAbonoLibreAbierto(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all shadow-sm">Cancelar</button>

                   <button onClick={procesarAbonoLibre} disabled={cargandoAccion || !montoAbonoLibre} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-emerald-400">

                      {cargandoAccion ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16} strokeWidth={3}/>} Ingresar Dinero

                   </button>

                </div>

             </motion.div>

          </div>

        )}

      </AnimatePresence>



      {/* VISTA DE IMPRESIÓN */}

      <div id="comprobante-impresion" className="hidden print:block bg-white text-slate-900 font-sans">

        <div className="p-10">

         

          {/* ENCABEZADO */}

          <header className="flex justify-between items-start pb-8 mb-8 border-b-2 border-slate-900">

            <div className="w-2/3">

              <img

                src="https://yqdpmaopnvrgdqbfaiok.supabase.co/storage/v1/object/public/documentos_imagenes/440749454_122171956712064634_7168698893214813270_n.jpg"

                alt="Logo Clínica Dignidad"

                className="w-auto mb-4 mix-blend-multiply"

                style={{ height: '3rem' }}

                referrerPolicy="no-referrer"

              />

              <h1 className="text-lg font-black text-slate-800">CENTRO MÉDICO Y DENTAL DIGNIDAD SPA</h1>

              <p className="text-xs text-slate-500 font-medium">Venancia Leiva 1871, La Pintana, Región Metropolitana</p>

              <p className="text-xs text-slate-500 font-medium">Teléfono: +56 9 6646 7641</p>

            </div>

            <div className="w-1/3 text-right">

              <h2 className="text-4xl font-black uppercase text-slate-800 tracking-tighter">Recibo</h2>

              <p className="text-sm font-semibold text-slate-500 mt-2">

                Nº: <span className="text-slate-800 font-bold">#{pagoAImprimir?.id?.substring(0, 8).toUpperCase()}</span>

              </p>

              <p className="text-sm font-semibold text-slate-500">

                Fecha: <span className="text-slate-800 font-bold">{pagoAImprimir?.fecha_pago ? new Date(pagoAImprimir.fecha_pago).toLocaleDateString('es-CL') : ''}</span>

              </p>

            </div>

          </header>



          {/* INFO PACIENTE */}

          <section className="mb-10">

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Recibo para</h3>

            <p className="text-xl font-bold text-slate-800 uppercase">{pacienteInfo?.nombre} {pacienteInfo?.apellido}</p>

            <p className="text-sm text-slate-600 font-medium">RUT: {pacienteInfo?.rut || 'S/N'}</p>

          </section>



          {/* TABLA DE DETALLES */}

          <section className="mb-10">

            <table className="w-full text-sm">

              <thead className="border-b-2 border-slate-300">

                <tr>

                  <th className="text-left py-3 px-2 font-bold uppercase text-slate-500 text-xs tracking-wider">Descripción</th>

                  <th className="text-right py-3 px-2 font-bold uppercase text-slate-500 text-xs tracking-wider">Monto Pagado</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {detallesImpresion.length > 0 ? (

                  detallesImpresion.map((d: any, i: number) => (

                    <tr key={i}>

                      <td className="py-4 px-2">

                        <p className="font-bold text-slate-800 uppercase">{d.prestacion} {d.diente ? `(Pza ${d.diente})` : ''}</p>

                        <p className="text-xs text-slate-500 uppercase mt-1">Atendido por: {d.doctor}</p>

                      </td>

                      <td className="py-4 px-2 text-right font-bold text-slate-700">${Number(d.abonado_ahora).toLocaleString('es-CL')}</td>

                    </tr>

                  ))

                ) : (

                  <tr>

                    <td className="py-4 px-2 font-bold uppercase">Abono a cuenta clínica</td>

                    <td className="py-4 px-2 text-right font-bold">${Number(pagoAImprimir?.monto || 0).toLocaleString('es-CL')}</td>

                  </tr>

                )}

              </tbody>

            </table>

          </section>



          {/* TOTALES Y MÉTODO DE PAGO */}

          <section className="flex justify-end">

            <div className="w-full max-w-xs">

              <div className="flex justify-between items-center py-4 border-t-2 border-slate-900">

                <span className="text-base font-bold uppercase text-slate-900">Total Pagado</span>

                <span className="text-2xl font-black text-slate-900">${Number(pagoAImprimir?.monto || 0).toLocaleString('es-CL')}</span>

              </div>

              <div className="mt-4 text-right border-t border-slate-200 pt-4">

                <p className="text-xs font-semibold text-slate-500">Método de Pago:</p>

                <p className="text-sm font-bold text-slate-700 uppercase">{pagoAImprimir?.metodo_pago}</p>

                {pagoAImprimir?.numero_boleta && pagoAImprimir?.numero_boleta !== 'S/N' && (

                  <p className="text-xs text-slate-500">Referencia: {pagoAImprimir.numero_boleta}</p>

                )}

              </div>

            </div>

          </section>



          {/* FOOTER */}

          <footer className="mt-24 pt-8 border-t-2 border-slate-200 text-center text-xs text-slate-500">

            <p className="font-bold text-slate-700">¡Gracias por su pago!</p>

            <p className="mt-4 text-[10px] max-w-xl mx-auto">

              Este documento certifica la recepción de dinero en la clínica para el abono a la cuenta del paciente, pero no constituye ni reemplaza a la Boleta Electrónica de Servicios regulada por el SII.

            </p>

          </footer>

        </div>

      </div>

    </>

  )

}
