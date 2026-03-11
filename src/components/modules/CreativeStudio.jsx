import { useState, useEffect } from 'react'
import { useGenerativeMedia } from '../../hooks/useGenerativeMedia'
import { useCreativeAssets } from '../../hooks/useCreativeAssets'
import './CreativeStudio.css'

// ── Existing Brief Content (Retained as Secondary Data) ──
const BRIEF_TEMPLATES = [
  { id: 'chatbot', title: 'Setup Chatbot IA', category: 'Producto', tags: ['IA', 'automatizacion', 'WhatsApp'], sections: [{ label: 'Objetivo', placeholder: 'Automatizar la atencion al cliente 24/7 en WhatsApp' }, { label: 'Audiencia objetivo', placeholder: 'Clientes actuales' }] },
  { id: 'meta-ads', title: 'Campana Meta Ads', category: 'Marketing', tags: ['Meta', 'Facebook', 'paid'], sections: [{ label: 'Objetivo de campana', placeholder: 'Generacion de leads para clinica estetica' }] },
  { id: 'prospecting', title: 'Brief de Prospecting', category: 'Ventas', tags: ['prospecting', 'outreach', 'B2B'], sections: [{ label: 'Sector objetivo', placeholder: 'Clinicas de estetica en Madrid y Barcelona' }] },
  { id: 'content', title: 'Estrategia de Contenido', category: 'Contenido', tags: ['contenido', 'LinkedIn', 'RRSS'], sections: [{ label: 'Pilares de contenido', placeholder: '1. Casos de exito  2. Educacion IA  3. Behind the scenes' }] },
]

function BriefEditor({ template, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(template.sections.map(s => [s.label, ''])))
  const [copied, setCopied] = useState(false)

  const exportBrief = () => {
    const text = [`BRIEF: ${template.title}`, `Categoria: ${template.category}`, '='.repeat(40), ...template.sections.map(s => `\n${s.label.toUpperCase()}:\n${values[s.label] || '(pendiente)'}`)].join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="cs-modal-overlay">
      <div className="cs-modal card">
        <div className="cs-modal-header">
          <div>
            <div className="cs-modal-title">{template.title}</div>
            <div className="cs-tags-row">
              {template.tags.map(t => <span key={t} className="badge badge-neutral" style={{ fontSize: '10px' }}>{t}</span>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-primary" onClick={exportBrief}>{copied ? 'COPIADO' : 'COPIAR'}</button>
            <button className="btn btn-sm" onClick={onClose}>CERRAR</button>
          </div>
        </div>
        <div className="cs-modal-body">
          {template.sections.map(section => (
            <div key={section.label} className="input-group">
              <label className="mono cs-modal-label">{section.label}</label>
              <textarea
                className="input cs-modal-textarea"
                rows={3}
                placeholder={section.placeholder}
                value={values[section.label]}
                onChange={e => setValues(v => ({ ...v, [section.label]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CreativeStudio() {
  const [view, setView] = useState('deploy') // 'deploy' | 'briefs'

  // Media State
  const { generateImage, generateVideo, isGeneratingImage, isGeneratingVFX, error } = useGenerativeMedia()
  const { assets: dbAssets, loading: assetsLoading, persistGeneration } = useCreativeAssets()
  const [prompt, setPrompt] = useState('')
  const [modelTarget, setModelTarget] = useState('banana') // 'banana' | 'veo3'
  const [gallery, setGallery] = useState([])

  // Seed gallery from DB on first load
  useEffect(() => {
    if (!assetsLoading && gallery.length === 0 && dbAssets.length > 0) {
      setGallery(dbAssets.map(a => ({
        id: a.id,
        type: a.asset_type,
        prompt: a.prompt_used || '',
        url: a.public_url,
        status: a.status === 'ready' ? 'ready' : 'error'
      })))
    }
  }, [assetsLoading, dbAssets, gallery.length])

  // Briefs State
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [filterCat, setFilterCat] = useState('Todos')
  const categories = ['Todos', ...new Set(BRIEF_TEMPLATES.map(t => t.category))]
  const filteredBriefs = filterCat === 'Todos' ? BRIEF_TEMPLATES : BRIEF_TEMPLATES.filter(t => t.category === filterCat)

  const handleDeploy = async () => {
    if (!prompt.trim()) return

    const localId = crypto.randomUUID()
    const type = modelTarget === 'banana' ? 'image' : 'video'
    const capturedPrompt = prompt

    setGallery(prev => [{ id: localId, type, prompt: capturedPrompt, status: 'generating', url: null }, ...prev])
    setPrompt('')

    const generatorFn = type === 'image'
      ? () => generateImage(capturedPrompt)
      : () => generateVideo(capturedPrompt)

    try {
      const asset = await persistGeneration(capturedPrompt, type, generatorFn)
      setGallery(prev => prev.map(item =>
        item.id === localId
          ? { id: asset.id, type: asset.asset_type, prompt: asset.prompt_used, status: 'ready', url: asset.public_url }
          : item
      ))
    } catch (err) {
      setGallery(prev => prev.map(item =>
        item.id === localId
          ? { ...item, status: 'error', error: err.message || 'API Payload Reject' }
          : item
      ))
    }
  }

  const isWorking = isGeneratingImage || isGeneratingVFX

  return (
    <div className="creative-studio fade-in">
      {/* ── HEADER ── */}
      <div className="cs-header">
        <div>
          <h1 className="cs-header-title">MEDIA DEPLOYMENT</h1>
          <p className="mono cs-header-subtitle">
            CREATIVE STUDIO // AI ASSET GENERATION & BRIEF LIBRARY
          </p>
        </div>
        <div className="cs-view-toggles">
          <button className={`cs-view-btn ${view === 'deploy' ? 'cs-view-btn--active' : ''}`} onClick={() => setView('deploy')}>
            [ MEDIA OPS ]
          </button>
          <button className={`cs-view-btn ${view === 'briefs' ? 'cs-view-btn--active' : ''}`} onClick={() => setView('briefs')}>
            [ BRIEF DB ]
          </button>
        </div>
      </div>

      {/* ── ALERTS ── */}
      {error && (
        <div className="cs-error-banner">
          <span className="cs-error-icon">⚠️</span>
          <span className="mono cs-error-text">SYS_ERR: {error}</span>
        </div>
      )}

      {/* ── CONTENT BODY ── */}
      <div className="cs-content">

        {/* ── VIEW: DEPLOY (MEDIA GENERATION) ── */}
        {view === 'deploy' && (
          <div className="cs-deploy-grid">

            {/* Left: Command Console */}
            <div className="cs-command-console">
              <div className="cs-panel-header">/// DEPLOYMENT PARAMETERS</div>
              <div className="cs-command-body">

                <div className="cs-input-group">
                  <label className="mono cs-label">TARGET LOGIC CORE</label>
                  <div className="cs-model-selector">
                    <button
                      className={`cs-model-btn ${modelTarget === 'banana' ? 'cs-model-btn--active' : ''}`}
                      onClick={() => setModelTarget('banana')}
                    >
                      <span className="cs-model-icon">🍌</span> NANO BANANA (IMAGE)
                    </button>
                    <button
                      className={`cs-model-btn ${modelTarget === 'veo3' ? 'cs-model-btn--active' : ''}`}
                      onClick={() => setModelTarget('veo3')}
                    >
                      <span className="cs-model-icon">🎥</span> VEO 3 (VIDEO)
                    </button>
                  </div>
                </div>

                <div className="cs-input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="mono cs-label">NEURAL PROMPT SEQUENCE</label>
                  <textarea
                    className="input cs-prompt-input"
                    placeholder="Execute creative directive..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                  />
                </div>

                <button
                  className={`btn btn-primary mono cs-execute-btn ${isWorking ? 'cs-execute-btn--working' : ''}`}
                  onClick={handleDeploy}
                  disabled={isWorking || !prompt.trim()}
                >
                  {isWorking ? '[ GENERATING ASSET... ]' : '[ INITIATE GENERATION ]'}
                </button>

              </div>
            </div>

            {/* Right: Asset Gallery */}
            <div className="cs-gallery-panel">
              <div className="cs-panel-header">/// ACTIVE ASSET STREAM</div>
              <div className="cs-gallery-body">
                {gallery.length === 0 ? (
                  <div className="cs-empty-state">
                    <span className="mono cs-empty-text">AWAITING GENERATION PROTOCOL.</span>
                  </div>
                ) : (
                  <div className="cs-assets-grid">
                    {gallery.map(asset => (
                      <div key={asset.id} className={`cs-asset-card ${asset.status === 'error' ? 'cs-asset-card--error' : ''}`}>
                        <div className="cs-asset-header mono">
                          <span className="text-tertiary">ID:{asset.id.slice(-6)}</span>
                          <span className={asset.status === 'ready' ? 'text-success' : asset.status === 'error' ? 'text-danger' : 'text-primary'}>
                            [{asset.status.toUpperCase()}]
                          </span>
                        </div>

                        <div className="cs-asset-preview">
                          {asset.status === 'generating' ? (
                            <div className="cs-asset-loader">
                              <div className="cs-loader-bar" />
                            </div>
                          ) : asset.status === 'error' ? (
                            <div className="cs-asset-error">FAILED: {asset.error}</div>
                          ) : (
                            asset.type === 'video'
                              ? <video src={asset.url} controls autoPlay muted loop className="cs-asset-media" />
                              : <img src={asset.url} alt="Generated asset" className="cs-asset-media" />
                          )}
                        </div>

                        <div className="cs-asset-footer mono">
                          {asset.prompt}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}


        {/* ── VIEW: BRIEFS (LIBRARY) ── */}
        {view === 'briefs' && (
          <div className="cs-briefs-layout">
            <div className="cs-panel">
              <div className="cs-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>/// LIBRARY DIRECTORY</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {categories.map(c => (
                    <button key={c} className={`cs-filter-btn mono ${filterCat === c ? 'cs-filter-btn--active' : ''}`} onClick={() => setFilterCat(c)}>
                      {c.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cs-briefs-grid">
                {filteredBriefs.map(template => (
                  <div key={template.id} className="cs-brief-card" onClick={() => setActiveTemplate(template)}>
                    <div className="cs-brief-card-header">
                      <div className="cs-brief-card-title">{template.title}</div>
                      <span className="mono text-tertiary text-xs">[{template.category.toUpperCase()}]</span>
                    </div>
                    <div className="cs-brief-tags">
                      {template.tags.map(t => (
                        <span key={t} className="cs-brief-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal */}
      {activeTemplate && (
        <BriefEditor template={activeTemplate} onClose={() => setActiveTemplate(null)} />
      )}

    </div>
  )
}

export default CreativeStudio
