'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Calendar, DollarSign, Clock, Activity, ArrowUpRight, ArrowDownRight,
  FileText, CheckCircle2, Stethoscope, Briefcase, Package, Wallet,
  UserPlus, UserCheck, AlertTriangle, ShieldCheck, Minus
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell,
  PieChart, Pie, ComposedChart, Line
} from 'recharts'

// ─────────────────────────────────────────────────────────────
// Paleta: "Signos Vitales" — clínica dental, sin defaults de IA.
// Tinta profunda (slate-900) + Teal clínico (identidad dental) +
// Ámbar (atención) + Rosa (alerta). Fondo cálido neutro, no cream-IA.
// ─────────────────────────────────────────────────────────────
const COLORS_PIE = ['#0d9488', '#1e293b', '#38bdf8', '#b45309', '#94a3b8']
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function pct(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}
function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('es-CL')}`
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`
}

export default function PanelDesempenoPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchMetrics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, anio])

  async function fetchMetrics() {
    setLoading(true)
    setData(null) // evita renderizar con un estado parcial/antiguo mientras carga el nuevo mes
    try {
      const inicioMes = new Date(anio, mes - 1, 1).toISOString()
      const finMes = new Date(anio, mes, 0, 23, 59, 59).toISOString()
      const inicioMesAnt = new Date(anio, mes - 2, 1).toISOString()
      const finMesAnt = new Date(anio, mes - 1, 0, 23, 59, 59).toISOString()
      const fechaHistorialInicio = new Date(anio, mes - 6, 1).toISOString()

      const [
        { data: citasData },
        { data: pacientesData },
        { data: presupuestosData },
        { data: pagosData },
        { data: pagosAntData },
        { data: atencionesData },
        { data: atencionesAntData },
        { data: atencionesHistorial },
        { data: pagosHistorial },
        { data: egresosData },
        { data: liquidacionesData },
        { data: inventarioData },
        { data: cajaData },
      ] = await Promise.all([
        supabase.from('citas').select('*').gte('inicio', inicioMes).lte('inicio', finMes),
        supabase.from('pacientes').select('id, created_at'),
        supabase.from('presupuestos').select('id, aprobado, total').gte('fecha_creacion', inicioMes).lte('fecha_creacion', finMes),
        supabase.from('pagos').select('monto, fecha_pago, convenio, perfiles:profesional_id(nombre_completo)').gte('fecha_pago', inicioMes).lte('fecha_pago', finMes),
        supabase.from('pagos').select('monto').gte('fecha_pago', inicioMesAnt).lte('fecha_pago', finMesAnt),
        supabase.from('atenciones_realizadas').select('monto_cobrado, fecha, paciente_id, pacientes(prevision, created_at), perfiles:profesional_id(nombre_completo)').gte('fecha', inicioMes).lte('fecha', finMes),
        supabase.from('atenciones_realizadas').select('monto_cobrado').gte('fecha', inicioMesAnt).lte('fecha', finMesAnt),
        supabase.from('atenciones_realizadas').select('monto_cobrado, fecha').gte('fecha', fechaHistorialInicio).lte('fecha', finMes),
        supabase.from('pagos').select('monto, fecha_pago').gte('fecha_pago', fechaHistorialInicio).lte('fecha_pago', finMes),
        supabase.from('egresos').select('categoria, monto').gte('fecha', inicioMes).lte('fecha', finMes),
        supabase.from('liquidaciones').select('monto_total, profesional_id, profesionales(nombre, apellido)').gte('fecha_pago', inicioMes).lte('fecha_pago', finMes),
        supabase.from('inventario_productos').select('nombre, stock_actual, stock_seguridad'),
        supabase.from('sesiones_caja').select('*').gte('fecha_apertura', inicioMes).lte('fecha_apertura', finMes),
      ])

      // ── AGENDA ──────────────────────────────────────────────
      const pacientesNuevos = (pacientesData || []).filter(p => p.created_at >= inicioMes && p.created_at <= finMes).length
      const pacientesNuevosAnt = (pacientesData || []).filter(p => p.created_at >= inicioMesAnt && p.created_at <= finMesAnt).length
      const citasTotales = citasData?.length || 0
      const citasAnuladas = (citasData || []).filter(c => c.estado === 'anulada').length
      const citasAtendidas = (citasData || []).filter(c => !!c.hora_inicio_atencion).length
      const citasConfirmadas = (citasData || []).filter(c => c.estado_confirmacion === 'confirmado').length
      const citasPendientesConf = (citasData || []).filter(c => c.estado_confirmacion === 'pendiente').length
      const ocupacion = citasTotales > 0 ? Math.round(((citasTotales - citasAnuladas) / citasTotales) * 100) : 0
      const atendidosVsAgendados = citasTotales > 0 ? Math.round((citasAtendidas / citasTotales) * 100) : 0

      const presupuestosAprobados = (presupuestosData || []).filter(p => p.aprobado).length
      const presupuestosTotalCount = presupuestosData?.length || 0
      const tasaAprobacion = presupuestosTotalCount > 0 ? Math.round((presupuestosAprobados / presupuestosTotalCount) * 100) : 0
      const montoAprobado = (presupuestosData || []).filter(p => p.aprobado).reduce((a: number, p: any) => a + Number(p.total || 0), 0)

      // ── TIEMPO DE ESPERA (real, desde citas) ────────────────
      const esperas = (citasData || [])
        .filter((c: any) => c.hora_llegada && c.hora_inicio_atencion)
        .map((c: any) => (new Date(c.hora_inicio_atencion).getTime() - new Date(c.hora_llegada).getTime()) / 60000)
        .filter((m: number) => m >= 0 && m < 240)
      const esperaPromedio = esperas.length ? Math.round((esperas.reduce((a: number, b: number) => a + b, 0) / esperas.length) * 10) / 10 : null

      // ── VENTAS Y RECAUDACIÓN ────────────────────────────────
      const ventasTotal = (atencionesData || []).reduce((acc: number, a: any) => acc + Number(a.monto_cobrado || 0), 0)
      const ventasAnt = (atencionesAntData || []).reduce((acc: number, a: any) => acc + Number(a.monto_cobrado || 0), 0)
      const recaudacionTotal = (pagosData || []).reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0)
      const recaudacionAnt = (pagosAntData || []).reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0)

      // ── COSTOS REALES (egresos + liquidaciones) ─────────────
      const egresosTotal = (egresosData || []).reduce((a: number, e: any) => a + Number(e.monto || 0), 0)
      const egresosPorCategoria = Object.entries(
        (egresosData || []).reduce((acc: any, e: any) => {
          const cat = e.categoria || 'Otros'
          acc[cat] = (acc[cat] || 0) + Number(e.monto || 0)
          return acc
        }, {})
      ).map(([categoria, monto]) => ({ categoria, monto: monto as number })).sort((a, b) => b.monto - a.monto)

      const liquidacionesTotal = (liquidacionesData || []).reduce((a: number, l: any) => a + Number(l.monto_total || 0), 0)
      const liquidacionesPorProf = Object.entries(
        (liquidacionesData || []).reduce((acc: any, l: any) => {
          const nombre = l.profesionales ? `${(l.profesionales as any).nombre} ${(l.profesionales as any).apellido}` : 'Sin asignar'
          acc[nombre] = (acc[nombre] || 0) + Number(l.monto_total || 0)
          return acc
        }, {})
      ).map(([name, Liquidado]) => ({ name, Liquidado: Liquidado as number })).sort((a, b) => b.Liquidado - a.Liquidado).slice(0, 10)

      // ── CAJA ─────────────────────────────────────────────────
      const cajaSesiones = cajaData?.length || 0
      const cajaEfectivo = (cajaData || []).reduce((a: number, c: any) => a + Number(c.total_efectivo_esperado || 0), 0)
      const cajaTarjeta = (cajaData || []).reduce((a: number, c: any) => a + Number(c.total_tarjeta_esperado || 0), 0)
      const cajaTransferencia = (cajaData || []).reduce((a: number, c: any) => a + Number(c.total_transferencia_esperado || 0), 0)

      // ── INVENTARIO: alertas de stock bajo ───────────────────
      const alertasStock = (inventarioData || [])
        .filter((p: any) => Number(p.stock_actual) <= Number(p.stock_seguridad))
        .sort((a: any, b: any) => (a.stock_actual - a.stock_seguridad) - (b.stock_actual - b.stock_seguridad))
        .slice(0, 6)

      // ── RANKING POR PROFESIONAL (ventas reales) ─────────────
      const ventasPorProf = (atencionesData || []).reduce((acc: any, curr: any) => {
        const nombre = (curr.perfiles as any)?.nombre_completo || 'General'
        acc[nombre] = (acc[nombre] || 0) + Number(curr.monto_cobrado || 0)
        return acc
      }, {})
      const chartProfesionales = Object.entries(ventasPorProf)
        .map(([name, value]) => ({ name, Ventas: value as number }))
        .sort((a, b) => b.Ventas - a.Ventas)
        .slice(0, 10)

      // ── CONVENIOS: atenciones (conteo) y ventas (monto) ─────
      const atencionesConvenio = (atencionesData || []).reduce((acc: any, curr: any) => {
        const convenio = (curr.pacientes as any)?.prevision || 'Sin Convenio'
        acc[convenio] = (acc[convenio] || 0) + 1
        return acc
      }, {})
      const chartAtencionesConv = agruparTop(atencionesConvenio)

      const ventasConvenio = (atencionesData || []).reduce((acc: any, curr: any) => {
        const convenio = (curr.pacientes as any)?.prevision || 'Sin Convenio'
        acc[convenio] = (acc[convenio] || 0) + Number(curr.monto_cobrado || 0)
        return acc
      }, {})
      const chartVentasConv = agruparTop(ventasConvenio)

      // ── PACIENTES: nuevos vs recurrentes (dentro de atenciones del mes) ──
      const vistos = new Set<string>()
      let pacTipoNuevo = 0, pacTipoRecurrente = 0
      for (const a of (atencionesData || [])) {
        const pid = (a as any).paciente_id
        if (!pid || vistos.has(pid)) continue
        vistos.add(pid)
        const creado = (a as any).pacientes?.created_at
        if (creado && creado >= inicioMes && creado <= finMes) pacTipoNuevo++
        else pacTipoRecurrente++
      }
      const chartPacientesTipo = agruparTop({ 'Nuevos': pacTipoNuevo, 'Recurrentes': pacTipoRecurrente })

      // ── HISTORIAL REAL 6 MESES ──────────────────────────────
      const mapAtenciones: Record<string, { count: number; ventas: number }> = {}
      for (const a of (atencionesHistorial || [])) {
        const key = monthKey(new Date((a as any).fecha))
        if (!mapAtenciones[key]) mapAtenciones[key] = { count: 0, ventas: 0 }
        mapAtenciones[key].count += 1
        mapAtenciones[key].ventas += Number((a as any).monto_cobrado || 0)
      }
      const mapPagos: Record<string, number> = {}
      for (const p of (pagosHistorial || [])) {
        const key = monthKey(new Date((p as any).fecha_pago))
        mapPagos[key] = (mapPagos[key] || 0) + Number((p as any).monto || 0)
      }
      const chartHistory = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anio, mes - 1 - i, 1)
        const key = monthKey(d)
        chartHistory.push({
          name: MESES[d.getMonth()],
          Atenciones: mapAtenciones[key]?.count || 0,
          Ventas: mapAtenciones[key]?.ventas || 0,
          Recaudacion: mapPagos[key] || 0,
        })
      }

      setData({
        agenda: {
          nuevos: pacientesNuevos,
          nuevosDelta: pct(pacientesNuevos, pacientesNuevosAnt),
          anuladas: citasAnuladas,
          confirmadas: citasConfirmadas,
          pendientesConf: citasPendientesConf,
          ocupacion,
          presupuestos: presupuestosTotalCount,
          presupuestosAprobados,
          tasaAprobacion,
          montoAprobado,
          atendidosVsAgendados,
          citasTotales,
        },
        finanzas: {
          ventas: ventasTotal,
          ventasDelta: pct(ventasTotal, ventasAnt),
          recaudacion: recaudacionTotal,
          recaudacionDelta: pct(recaudacionTotal, recaudacionAnt),
          egresosTotal,
          egresosPorCategoria,
          liquidacionesTotal,
          liquidacionesPorProf,
        },
        operacion: {
          esperaPromedio,
          muestras: esperas.length,
          caja: { sesiones: cajaSesiones, efectivo: cajaEfectivo, tarjeta: cajaTarjeta, transferencia: cajaTransferencia },
        },
        inventario: { alertas: alertasStock },
        charts: {
          history: chartHistory,
          profesionales: chartProfesionales,
          convenios: chartAtencionesConv,
          ventasConvenio: chartVentasConv,
          pacientesTipo: chartPacientesTipo,
        },
      })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function agruparTop(obj: Record<string, number>, top = 4) {
    const entries = Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((a, [, v]) => a + v, 0)
    if (total === 0) return []
    const head = entries.slice(0, top)
    const restTotal = entries.slice(top).reduce((a, [, v]) => a + v, 0)
    const result = head.map(([name, value]) => ({ name, value }))
    if (restTotal > 0) result.push({ name: 'Otros', value: restTotal })
    return result
  }

  if (!mounted || loading || !data) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
      <PulseSpinner />
      <p className="text-xs uppercase tracking-widest font-bold mt-4">Auscultando la base de datos…</p>
    </div>
  )

  const historyLast = data.charts.history[data.charts.history.length - 1]

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 md:p-8 space-y-8">

        {/* HEADER */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 sm:p-8 shadow-sm">
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '18px 18px'
          }} />
          <div className="relative flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} className="text-teal-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400">Signos vitales de la clínica</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Panel de Desempeño</h1>
              <p className="text-xs text-slate-400 mt-1">{MESES[mes - 1]} {anio} · datos en vivo desde Supabase</p>
            </div>
            <div className="flex gap-2">
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-xs font-bold uppercase text-white outline-none">
                {MESES.map((m, i) => <option key={m} value={i + 1} className="text-slate-900">{m}</option>)}
              </select>
              <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-xs font-bold text-white outline-none">
                {[2024, 2025, 2026].map(a => <option key={a} value={a} className="text-slate-900">{a}</option>)}
              </select>
            </div>
          </div>
          <PulseLine />
        </div>

        {/* SIGNOS VITALES: KPI ribbon con sparkline */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <VitalCard icon={DollarSign} label="Ventas" value={money(data.finanzas.ventas)} delta={data.finanzas.ventasDelta} history={data.charts.history} dataKey="Ventas" accent="#0d9488" />
          <VitalCard icon={Wallet} label="Recaudación" value={money(data.finanzas.recaudacion)} delta={data.finanzas.recaudacionDelta} history={data.charts.history} dataKey="Recaudacion" accent="#38bdf8" />
          <VitalCard icon={UserPlus} label="Pacientes nuevos" value={String(data.agenda.nuevos)} delta={data.agenda.nuevosDelta} history={data.charts.history} dataKey="Atenciones" accent="#b45309" />
          <VitalCard icon={CheckCircle2} label="Ocupación agenda" value={`${data.agenda.ocupacion}%`} plain accent="#0d9488" />
          <VitalCard icon={Clock} label="Espera promedio" value={data.operacion.esperaPromedio !== null ? `${data.operacion.esperaPromedio} min` : 'Sin datos'} plain accent="#94a3b8" />
        </div>

        {/* AGENDA Y ATENCIONES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <SectionTitle icon={Calendar} label="Agenda del mes" />
            <div className="space-y-4">
              <MiniStat label="Pacientes nuevos" value={data.agenda.nuevos} />
              <MiniStat label="Citas anuladas" value={data.agenda.anuladas} isNegative />
              <MiniStat label="Confirmadas" value={data.agenda.confirmadas} />
              <MiniStat label="Pendientes de confirmar" value={data.agenda.pendientesConf} />
              <MiniStat label="Atendidos vs. agendados" value={`${data.agenda.atendidosVsAgendados}%`} />
              <MiniStat label="Presupuestos creados" value={data.agenda.presupuestos} />
              <MiniStat label="Tasa de aprobación" value={`${data.agenda.tasaAprobacion}%`} />
            </div>
          </div>

          <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <SectionTitle icon={Activity} label="Atenciones por mes" />
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-black text-slate-800">{historyLast?.Atenciones || 0}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">atenciones este mes</span>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-bold" />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="Atenciones" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* VENTAS Y RECAUDACIÓN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <MoneyCard title="Ventas (atenciones realizadas)" value={data.finanzas.ventas} delta={data.finanzas.ventasDelta} color="text-slate-800" />
            <MoneyCard title="Recaudación (pagos)" value={data.finanzas.recaudacion} delta={data.finanzas.recaudacionDelta} color="text-teal-600" />
          </div>

          <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <SectionTitle icon={DollarSign} label="Ventas y recaudación mensual" noMargin />
              <div className="flex gap-4 text-[10px] font-bold uppercase">
                <span className="flex items-center gap-1 text-slate-600"><div className="w-2 h-2 bg-teal-600 rounded-full" /> Ventas</span>
                <span className="flex items-center gap-1 text-slate-600"><div className="w-2 h-2 bg-sky-400 rounded-full" /> Recaudación</span>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.charts.history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-bold" />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000000}M`} className="text-[10px] font-bold text-slate-400" />
                  <Tooltip formatter={(val: any) => money(Number(val))} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="Ventas" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line type="monotone" dataKey="Recaudacion" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* OPERACIÓN: ESPERA Y CAJA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><Clock size={32} className="text-slate-600" /></div>
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tiempo de espera</h2>
              <div className="text-2xl font-black text-slate-800">
                {data.operacion.esperaPromedio !== null ? `${data.operacion.esperaPromedio} min` : '—'}
                <span className="text-sm font-bold text-slate-400 uppercase ml-2">en este mes</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">calculado sobre {data.operacion.muestras} citas con hora de llegada e inicio registradas</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <SectionTitle icon={Wallet} label="Caja del mes" noMargin />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <CajaStat label="Efectivo" value={data.operacion?.caja?.efectivo || 0} />
              <CajaStat label="Tarjeta" value={data.operacion?.caja?.tarjeta || 0} />
              <CajaStat label="Transferencia" value={data.operacion?.caja?.transferencia || 0} />
            </div>
            <p className="text-[10px] text-slate-400 mt-3">{data.operacion?.caja?.sesiones || 0} sesión(es) de caja registradas este mes</p>
          </div>
        </div>

        {/* COSTOS REALES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <SectionTitle icon={FileText} label="Egresos por categoría" noMargin />
              <span className="text-lg font-black text-slate-800">{money(data.finanzas.egresosTotal)}</span>
            </div>
            {data.finanzas.egresosPorCategoria.length === 0 ? (
              <EmptyState text="No hay egresos registrados este mes." />
            ) : (
              <div className="space-y-3">
                {data.finanzas.egresosPorCategoria.map((e: any, i: number) => {
                  const maxV = data.finanzas.egresosPorCategoria[0].monto || 1
                  return (
                    <div key={e.categoria}>
                      <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                        <span>{e.categoria}</span>
                        <span>{money(e.monto)}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max((e.monto / maxV) * 100, 4)}%`, backgroundColor: COLORS_PIE[i % COLORS_PIE.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <SectionTitle icon={Briefcase} label="Liquidaciones a profesionales" noMargin />
              <span className="text-lg font-black text-teal-600">{money(data.finanzas.liquidacionesTotal)}</span>
            </div>
            {data.finanzas.liquidacionesPorProf.length === 0 ? (
              <EmptyState text="No hay liquidaciones pagadas este mes." />
            ) : (
              <div className="space-y-2">
                {data.finanzas.liquidacionesPorProf.slice(0, 6).map((l: any) => (
                  <div key={l.name} className="flex justify-between text-xs font-bold text-slate-600 py-1.5 border-b border-slate-50 last:border-0">
                    <span className="truncate pr-2">{l.name}</span>
                    <span className="text-slate-800">{money(l.Liquidado)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RANKING PROFESIONALES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <SectionTitle icon={Stethoscope} label="Ventas por profesional" />
            {data.charts.profesionales.length === 0 ? <EmptyState text="Sin atenciones registradas este mes." /> : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.profesionales} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} className="text-[10px] font-bold text-slate-600" />
                    <Tooltip formatter={(val: any) => money(Number(val))} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                    <Bar dataKey="Ventas" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <SectionTitle icon={Briefcase} label="Liquidado por profesional" />
            {data.finanzas.liquidacionesPorProf.length === 0 ? <EmptyState text="Sin liquidaciones este mes." /> : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.finanzas.liquidacionesPorProf} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} className="text-[10px] font-bold text-slate-600" />
                    <Tooltip formatter={(val: any) => money(Number(val))} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                    <Bar dataKey="Liquidado" fill="#1e293b" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* DISTRIBUCIONES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PieCard title="Pacientes: nuevos vs. recurrentes" data={data.charts.pacientesTipo} />
          <PieCard title="Atenciones por convenio" data={data.charts.convenios} />
          <PieCard title="Ventas por convenio" data={data.charts.ventasConvenio} money />
        </div>

        {/* INVENTARIO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <SectionTitle icon={Package} label="Alertas de stock" />
          {data.inventario.alertas.length === 0 ? (
            <EmptyState text="Todo el inventario está sobre su stock de seguridad." icon={CheckCircle2} good />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.inventario.alertas.map((p: any) => (
                <div key={p.nombre} className="flex items-center gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.nombre}</p>
                    <p className="text-[10px] text-amber-700 font-bold uppercase">{p.stock_actual} de {p.stock_seguridad} unidades mínimas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, label, noMargin }: { icon: any, label: string, noMargin?: boolean }) {
  return (
    <h2 className={`text-xs font-bold text-slate-400 uppercase tracking-widest ${noMargin ? '' : 'mb-6'} flex items-center gap-2`}>
      <Icon size={16} /> {label}
    </h2>
  )
}

function MiniStat({ label, value, isNegative }: { label: string, value: string | number, isNegative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span className={`text-lg font-black ${isNegative ? 'text-rose-500' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined || delta === null || Number.isNaN(delta)) return null
  if (delta === 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400"><Minus size={12} /> Sin cambio</span>
  )
  const positive = delta > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${positive ? 'text-teal-600' : 'text-rose-500'}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(delta)}% vs. mes anterior
    </span>
  )
}

function MoneyCard({ title, value, delta, color }: { title: string, value: number, delta: number, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{title}</h2>
      <div className={`text-3xl font-black ${color}`}>{money(value)}</div>
      <div className="mt-2"><DeltaBadge delta={delta} /></div>
    </div>
  )
}

function CajaStat({ label, value }: { label: string, value: number }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-black text-slate-800 mt-1">{money(value)}</p>
    </div>
  )
}

function EmptyState({ text, icon: Icon = FileText, good }: { text: string, icon?: any, good?: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border border-dashed ${good ? 'border-teal-200 bg-teal-50/50 text-teal-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
      <Icon size={18} />
      <span className="text-xs font-bold">{text}</span>
    </div>
  )
}

function PulseLine() {
  // Línea ECG sutil bajo el header — el elemento distintivo de "signos vitales"
  return (
    <svg className="relative mt-6 w-full h-6 opacity-40" viewBox="0 0 400 24" preserveAspectRatio="none">
      <polyline
        points="0,12 60,12 75,12 85,2 95,22 105,12 140,12 155,12 165,4 175,20 185,12 400,12"
        fill="none" stroke="#2dd4bf" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function PulseSpinner() {
  return (
    <svg width="64" height="24" viewBox="0 0 64 24">
      <polyline points="0,12 18,12 22,4 26,20 30,12 64,12" fill="none" stroke="#0d9488" strokeWidth="2">
        <animate attributeName="stroke-dasharray" values="0,80;80,80" dur="1.1s" repeatCount="indefinite" />
      </polyline>
    </svg>
  )
}

function VitalCard({ icon: Icon, label, value, delta, history, dataKey, accent, plain }: {
  icon: any, label: string, value: string, delta?: number, history?: any[], dataKey?: string, accent: string, plain?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1a` }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{label}</span>
      </div>
      <div className="text-lg sm:text-xl font-black text-slate-800 tabular-nums truncate">{value}</div>
      {!plain && history ? (
        <div className="h-8 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id={`grad-${dataKey}-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={dataKey || ""} stroke={accent} strokeWidth={2} fill={`url(#grad-${dataKey}-${label})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="h-8" />}
      {!plain && <DeltaBadge delta={delta} />}
    </div>
  )
}

function PieCard({ title, data, money: isMoney }: { title: string, data: { name: string, value: number }[], money?: boolean }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
      <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-full text-center mb-2 h-8">{title}</h2>
      {data.length === 0 || total === 0 ? (
        <div className="h-[160px] flex items-center justify-center w-full">
          <EmptyState text="Sin datos este mes." />
        </div>
      ) : (
        <>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => isMoney ? money(Number(val)) : `${val} (${Math.round((Number(val) / total) * 100)}%)`} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full mt-4 space-y-1">
            {data.map((item, idx) => (
              <div key={item.name} className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                <span className="flex items-center gap-1 truncate pr-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS_PIE[idx % COLORS_PIE.length] }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="shrink-0">{Math.round((item.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
