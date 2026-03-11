// ===================================================
// OCULOPS — Global State Store (Zustand)
// Mirrors legacy App.data + App methods
// ===================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const ceoScore = (item, phase = '0-20k') => {
  const w = phase === '0-20k'
    ? { impact: 1.2, velocity: 1.5, scalability: 0.5, confidence: 1.0 }
    : { impact: 1.0, velocity: 0.8, scalability: 1.5, confidence: 1.0 }
  const norm = v => Math.max(v, 1) / 100
  const numerator =
    Math.pow(norm(item.impact), w.impact) *
    Math.pow(norm(item.velocity), w.velocity) *
    Math.pow(norm(item.scalability), w.scalability) *
    Math.pow(norm(item.confidence), w.confidence)
  const denominator = norm(item.risk || 50) * norm(item.resourceCost || 50)
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

const getDefaultTasks = () => [
  { day: 1,  task: 'Definir ICP especifico + oferta concreta + pricing', status: 'pending', gate: null },
  { day: 2,  task: 'Investigar 30 empresas target con senales de compra', status: 'pending', gate: null },
  { day: 3,  task: 'Construir lista de 30 leads hipercualificados', status: 'pending', gate: null },
  { day: 4,  task: 'Escribir 3 scripts de outreach (DM, email, follow-up)', status: 'pending', gate: null },
  { day: 5,  task: 'Preparar propuesta template + pricing sheet', status: 'pending', gate: null },
  { day: 6,  task: 'Lanzar outbound: 10 contactos/dia', status: 'pending', gate: null },
  { day: 7,  task: 'Revisar respuestas + ajustar messaging', status: 'pending', gate: '>=3 respuestas' },
  { day: 8,  task: 'Seguir outbound + agendar meetings', status: 'pending', gate: null },
  { day: 9,  task: 'Preparar deck de ventas y demo', status: 'pending', gate: null },
  { day: 10, task: 'Primera ronda de meetings', status: 'pending', gate: null },
  { day: 11, task: 'Follow-up meetings + enviar propuestas', status: 'pending', gate: null },
  { day: 12, task: 'Ampliar lista de leads: 30 mas', status: 'pending', gate: null },
  { day: 13, task: 'Negociacion + cierre primer deal', status: 'pending', gate: null },
  { day: 14, task: 'Review semana 2: >=1 propuesta enviada', status: 'pending', gate: '>=1 propuesta' },
  { day: 15, task: 'Iniciar delivery primer cliente', status: 'pending', gate: null },
  { day: 16, task: 'Setup entorno + onboarding cliente', status: 'pending', gate: null },
  { day: 17, task: 'Entrega primer milestone', status: 'pending', gate: null },
  { day: 18, task: 'Continuar outbound paralelo', status: 'pending', gate: null },
  { day: 19, task: 'Segunda ronda de meetings', status: 'pending', gate: null },
  { day: 20, task: 'Segundo cierre esperado', status: 'pending', gate: null },
  { day: 21, task: 'Review dia 21: >=1 cliente activo', status: 'pending', gate: '>=1 cierre' },
  { day: 22, task: 'Crear caso de estudio del primer cliente', status: 'pending', gate: null },
  { day: 23, task: 'Publicar contenido con caso de estudio', status: 'pending', gate: null },
  { day: 24, task: 'Outbound con caso de estudio como proof', status: 'pending', gate: null },
  { day: 25, task: 'Optimizar pipeline y templates', status: 'pending', gate: null },
  { day: 26, task: 'Ampliar a 60 leads cualificados', status: 'pending', gate: null },
  { day: 27, task: 'Meetings con leads nuevos', status: 'pending', gate: null },
  { day: 28, task: 'Negociacion deals pipeline', status: 'pending', gate: null },
  { day: 29, task: 'Crear SOPs basicos de delivery', status: 'pending', gate: null },
  { day: 30, task: 'Review mes 1: MRR > 0 + pipeline > 15k', status: 'pending', gate: 'MRR >0 + Pipeline >15k' },
]

const getDefaultData = () => ({
  meta: { startDate: new Date().toISOString().split('T')[0], targetMRR: 20000, ultimateTarget: 100000, budget: 3000, hoursPerDay: 8 },
  leads: [],
  pipeline: { lead: [], contacted: [], response: [], meeting: [], proposal: [], closed: [], onboarding: [] },
  finance: { revenue: [], expenses: [], mrr: 0, clients: 0, avgTicket: 0 },
  simulation: { contactsPerWeek: 20, responseRate: 15, meetingRate: 40, closeRate: 30, avgTicket: 2500, churn: 5, capacity: 8 },
  alerts: [],
  decisions: [],
  experiments: [],
  opportunities: [],
  knowledge: [],
  companies: [],
  competitors: [],
  execution: { currentDay: 1, tasks: getDefaultTasks() },
  icp: {
    companySize: '10-200 empleados',
    decisionMaker: 'CEO / COO / Head of Marketing',
    painPoints: 'Procesos manuales, falta de automatizacion, costes de personal',
    techStack: 'CRM, email marketing, basico digital',
    budget: '2000-5000/mes',
    buySignals: 'Contratando, funding reciente, crecimiento rapido',
  },
  niches: [
    { id: 1, name: 'E-commerce',         impact: 80, velocity: 70, scalability: 85, confidence: 65, risk: 30, resourceCost: 40 },
    { id: 2, name: 'Clinicas / Salud',   impact: 75, velocity: 60, scalability: 70, confidence: 70, risk: 25, resourceCost: 35 },
    { id: 3, name: 'Inmobiliarias',      impact: 70, velocity: 80, scalability: 60, confidence: 75, risk: 20, resourceCost: 30 },
    { id: 4, name: 'SaaS B2B',           impact: 90, velocity: 50, scalability: 90, confidence: 55, risk: 40, resourceCost: 50 },
    { id: 5, name: 'Agencias Marketing', impact: 65, velocity: 75, scalability: 65, confidence: 80, risk: 15, resourceCost: 25 },
  ],
  bets: [
    { id: 1, type: 'core',    name: 'Automatizacion para e-commerce',   hypothesis: 'Los e-commerce de 1-10M necesitan chatbots + email automation', kpi: '3 clientes en 30 dias', killCriteria: '<5% response rate tras 100 contactos', pivotPath: 'Redirigir assets a clinicas',           status: 'active', resources: '50%' },
    { id: 2, type: 'core',    name: 'IA para inmobiliarias',            hypothesis: 'Las inmobiliarias necesitan cualificacion automatica de leads',   kpi: '2 clientes en 30 dias', killCriteria: 'Ciclo de venta >45 dias',                pivotPath: 'Usar tech para agencias marketing',    status: 'active', resources: '30%' },
    { id: 3, type: 'explore', name: 'Content marketing IA (inbound)',   hypothesis: 'Contenido sobre IA en Espana atrae leads cualificados',           kpi: '500 visitas/mes + 10 leads', killCriteria: '<100 visitas en 30 dias',             pivotPath: 'Usar contenido como asset en outbound',status: 'active', resources: '15%' },
    { id: 4, type: 'explore', name: 'Partnership con agencias web',     hypothesis: 'Agencias web refieren clientes que necesitan IA',                 kpi: '2 referrals en 30 dias',   killCriteria: '0 referrals en 45 dias',               pivotPath: 'Convertir en oferta white-label',      status: 'active', resources: '5%'  },
  ],
  resources: { outbound: 37, delivery: 30, content: 12, systems: 10, strategy: 5, admin: 6 },
  agents: { active: true },
  signals: [],
})

export const useAppStore = create(
  persist(
    (set, get) => ({
      data: getDefaultData(),
      modal: { open: false, content: null },
      toasts: [],

      // Generic data updater (receives updater fn)
      updateData: (updater) => set(state => ({ data: updater(state.data) })),

      // Modal
      openModal: (content) => set({ modal: { open: true, content } }),
      closeModal: () => set({ modal: { open: false, content: null } }),

      // Toast
      toast: (message, type = 'info') => {
        const id = uid()
        set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
        setTimeout(() => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })), 4000)
      },

      // Feedback loops (mirrors legacy App.triggerFeedback)
      triggerFeedback: (event, data) => {
        const { updateData } = get()
        if (event === 'deal_closed') {
          updateData(d => ({
            ...d,
            alerts: [...(d.alerts || []), {
              id: uid(), type: 'opportunity', severity: 1,
              description: `Deal cerrado: ${data.name} (${data.company})`,
              status: 'active', createdDate: new Date().toISOString().split('T')[0],
            }],
          }))
        } else if (event === 'experiment_concluded') {
          updateData(d => ({
            ...d,
            knowledge: [
              {
                id: uid(), type: 'learning',
                title: `Experimento: ${data.name}`,
                content: `Hipotesis: ${data.hypothesis}\nResultado: ${data.result}`,
                date: new Date().toISOString().split('T')[0],
              },
              ...(d.knowledge || []),
            ],
          }))
        }
      },
    }),
    {
      name: 'oculops-v10',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return { ...persisted }
        return persisted
      },
    }
  )
)
