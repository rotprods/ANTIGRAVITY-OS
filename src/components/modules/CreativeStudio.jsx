import { useState, useEffect, useMemo } from 'react'
import { useGenerativeMedia } from '../../hooks/useGenerativeMedia'
import { useCreativeAssets } from '../../hooks/useCreativeAssets'
import { useCreativeBriefs } from '../../hooks/useCreativeBriefs'
import { useReadiness } from '../../hooks/useReadiness'
import './CreativeStudio.css'

const PLATFORM_TEMPLATES = {
  'ig-post':   { label: 'IG Post',        maxChars: 2200, hashtagCount: 15, tone: 'visual-first', icon: '📸' },
  'ig-story':  { label: 'IG Story',       maxChars: 200,  hashtagCount: 5,  tone: 'punchy',       icon: '⚡' },
  'tiktok':    { label: 'TikTok Script',  maxChars: 300,  format: 'hook + body + cta', tone: 'gen-z', icon: '🎵' },
  'x-thread':  { label: 'X Thread',       maxChars: 280,  tweets: 5,        tone: 'sharp',        icon: '𝕏' },
  'linkedin':  { label: 'LinkedIn Post',  maxChars: 3000, format: 'story-insight-cta', tone: 'professional', icon: '💼' },
}

const TONE_OPTIONS = ['bold', 'professional', 'casual', 'urgent', 'playful']
const GOAL_OPTIONS = ['awareness', 'conversion', 'engagement', 'retention']

function SocialOpsTab({ generateCopy }) {
  const [platform, setPlatform] = useState('ig-post')
  const [brief, setBrief] = useState({ product: '', tone: 'bold', goal: 'awareness' })
  const [output, setOutput] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setSocialError] = useState(null)
  const { isOnline } = useReadiness()

  const tpl = PLATFORM_TEMPLATES[platform]

  const buildPrompt = () => {
    const p = PLATFORM_TEMPLATES[platform]
    return [
      `Platform: ${p.label}`,
      `Max characters: ${p.maxChars}`,
      `Tone: ${p.tone} / ${brief.tone}`,
      `Goal: ${brief.goal}`,
      p.hashtagCount ? `Include ${p.hashtagCount} relevant hashtags` : '',
      p.format ? `Format: ${p.format}` : '',
      p.tweets ? `Write ${p.tweets} tweets as a thread (numbered)` : '',
      `Product/Service: ${brief.product}`,
      'Write compelling copy optimized for this platform. Include character count at the end.',
    ].filter(Boolean).join('\n')
  }

  const handleGenerate = async () => {
    if (!brief.product.trim()) return
    setGenerating(true)
    setSocialError(null)
    setOutput(null)
    try {
      const result = await generateCopy(buildPrompt())
      const text = typeof result?.content === 'string' ? result.content : JSON.stringify(result?.content || '')
      setOutput({ text, platform, charCount: text.length })
    } catch (err) {
      setSocialError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const overLimit = output && output.charCount > tpl.maxChars

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', height: '100%' }}>
      {/* Left: Config */}
      <div className="cs-command-console">
        <div className="cs-panel-header">Platform Parameters</div>
        <div className="cs-command-body">

          {/* Platform selector */}
          <div className="cs-input-group">
            <label className="mono cs-label">Platform</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              {Object.entries(PLATFORM_TEMPLATES).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setPlatform(key)}
                  className={`cs-model-btn${platform === key ? ' cs-model-btn--active' : ''}`}
                  style={{ fontSize: 'var(--text-xs)', justifyContent: 'flex-start', gap: 6 }}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Brief inputs */}
          <div className="cs-input-group">
            <label className="mono cs-label">Product / Service</label>
            <textarea
              className="input cs-prompt-input"
              placeholder="What are you promoting? Describe your offer..."
              value={brief.product}
              rows={3}
              onChange={e => setBrief(b => ({ ...b, product: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div className="cs-input-group">
              <label className="mono cs-label">Tone</label>
              <select
                className="input mono"
                style={{ fontSize: 'var(--text-xs)', padding: '6px var(--space-2)' }}
                value={brief.tone}
                onChange={e => setBrief(b => ({ ...b, tone: e.target.value }))}
              >
                {TONE_OPTIONS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="cs-input-group">
              <label className="mono cs-label">Goal</label>
              <select
                className="input mono"
                style={{ fontSize: 'var(--text-xs)', padding: '6px var(--space-2)' }}
                value={brief.goal}
                onChange={e => setBrief(b => ({ ...b, goal: e.target.value }))}
              >
                {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          <button
            className={`btn btn-primary mono cs-execute-btn${generating ? ' cs-execute-btn--working' : ''}`}
            onClick={handleGenerate}
            disabled={generating || !brief.product.trim() || !isOnline}
            title={!isOnline ? "Bridge offline" : ""}
          >
            {generating ? 'Generating...' : 'Generate Copy'}
          </button>

          {error && <div className="cs-error-text mono" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>{error}</div>}
        </div>
      </div>

      {/* Right: Output */}
      <div className="cs-gallery-panel">
        <div className="cs-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Generated Copy</span>
          {output && (
            <span className="mono" style={{ fontSize: 'var(--text-xs)', color: overLimit ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {output.charCount} / {tpl.maxChars} CHARS
            </span>
          )}
        </div>
        <div className="cs-gallery-body">
          {!output && !generating && (
            <div className="cs-empty-state">
              <span className="mono cs-empty-text">Configure and generate to see output.</span>
            </div>
          )}
          {generating && (
            <div className="cs-empty-state">
              <div className="cs-loader-bar" style={{ width: '80%' }} />
            </div>
          )}
          {output && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', height: '100%' }}>
              <div style={{
                flex: 1,
                background: 'var(--color-bg-3)',
                border: `1px solid ${overLimit ? 'var(--color-danger)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-4)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-2)',
                whiteSpace: 'pre-wrap',
                lineHeight: 'var(--leading-relaxed)',
                overflowY: 'auto',
              }}>
                {output.text}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  className="btn mono"
                  style={{ flex: 1, fontSize: 'var(--text-xs)' }}
                  onClick={() => navigator.clipboard.writeText(output.text)}
                >
                  COPY
                </button>
                <button
                  className="btn mono"
                  style={{ flex: 1, fontSize: 'var(--text-xs)' }}
                  onClick={() => setOutput(null)}
                >
                  CLEAR
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Assembles filled brief sections into a plain-text prompt string.
function buildBriefPrompt(template, values) {
  return [
    `BRIEF: ${template.title}`,
    ...template.sections.map(s => `${s.label}: ${values[s.label] || s.placeholder}`)
  ].join(' | ')
}

function BriefEditor({ template, onClose, onDeploy }) {
  const [values, setValues] = useState(() => Object.fromEntries(template.sections.map(s => [s.label, ''])))
  const [copied, setCopied] = useState(false)

  const assembledText = buildBriefPrompt(template, values)

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
            <button className="btn btn-sm btn-primary" onClick={() => onDeploy(assembledText)}>DEPLOY</button>
            <button className="btn btn-sm" onClick={exportBrief}>{copied ? 'COPIADO' : 'COPIAR'}</button>
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

// Renders the correct preview for a gallery asset depending on type.
function AssetPreview({ asset }) {
  if (asset.status === 'generating') {
    return (
      <div className="cs-asset-loader">
        <div className="cs-loader-bar" />
      </div>
    )
  }
  if (asset.status === 'error') {
    return <div className="cs-asset-error">FAILED: {asset.error}</div>
  }
  if (asset.type === 'copy') {
    const text = typeof asset.content === 'string'
      ? asset.content
      : JSON.stringify(asset.content, null, 2)
    return <div className="cs-asset-copy-preview mono">{text?.slice(0, 300)}</div>
  }
  if (asset.type === 'video') {
    return <video src={asset.url} controls autoPlay muted loop className="cs-asset-media" />
  }
  return <img src={asset.url} alt="Generated asset" className="cs-asset-media" />
}

function CreativeStudio() {
  const [view, setView] = useState('deploy') // 'deploy' | 'briefs' | 'social'

  // Media State
  const { generateImage, generateVideo, generateCopy, isGeneratingImage, isGeneratingVFX, isGeneratingCopy, error } = useGenerativeMedia()
  const { assets: dbAssets, loading: assetsLoading, persistGeneration, persistCopyAsset } = useCreativeAssets()
  const [prompt, setPrompt] = useState('')
  const [modelTarget, setModelTarget] = useState('banana') // 'banana' | 'veo3' | 'forge'
  const [gallery, setGallery] = useState([])
  const { isOnline } = useReadiness()

  // Sync gallery from DB — runs on load and whenever dbAssets updates (realtime)
  useEffect(() => {
    if (assetsLoading) return
    setGallery(dbAssets.map(a => ({
      id: a.id,
      type: a.asset_type,
      prompt: a.prompt_used || '',
      url: a.public_url,
      status: a.status === 'ready' ? 'ready' : 'error',
      content: a.metadata?.content ?? null
    })))
  }, [assetsLoading, dbAssets])

  // Briefs State
  const { briefs, loading: briefsLoading, trackUsage } = useCreativeBriefs()
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [filterCat, setFilterCat] = useState('Todos')
  const categories = useMemo(() => ['Todos', ...new Set(briefs.map(t => t.category))], [briefs])
  const filteredBriefs = useMemo(
    () => filterCat === 'Todos' ? briefs : briefs.filter(t => t.category === filterCat),
    [briefs, filterCat]
  )

  const handleDeploy = async () => {
    if (!prompt.trim()) return

    const localId = crypto.randomUUID()
    const capturedPrompt = prompt
    setPrompt('')

    // FORGE — copy generation + persist to creative_assets
    if (modelTarget === 'forge') {
      setGallery(prev => [{ id: localId, type: 'copy', prompt: capturedPrompt, status: 'generating', url: null, content: null }, ...prev])
      try {
        const result = await generateCopy(capturedPrompt)
        const content = result?.content ?? null
        const saved = await persistCopyAsset(capturedPrompt, content, result?.creative_asset_id ?? null)
        setGallery(prev => prev.map(item =>
          item.id === localId
            ? { id: saved?.id || localId, type: 'copy', prompt: capturedPrompt, status: 'ready', url: null, content }
            : item
        ))
      } catch (err) {
        setGallery(prev => prev.map(item =>
          item.id === localId ? { ...item, status: 'error', error: err.message } : item
        ))
      }
      return
    }

    // Image / Video — full persistence chain via useCreativeAssets
    const type = modelTarget === 'banana' ? 'image' : 'video'
    setGallery(prev => [{ id: localId, type, prompt: capturedPrompt, status: 'generating', url: null }, ...prev])

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
        item.id === localId ? { ...item, status: 'error', error: err.message || 'API Payload Reject' } : item
      ))
    }
  }

  // Brief → Deploy: pre-fill prompt, switch to deploy tab, set FORGE model
  const handleBriefDeploy = (text) => {
    setPrompt(text)
    setModelTarget('forge')
    setView('deploy')
    setActiveTemplate(null)
  }

  const isWorking = isGeneratingImage || isGeneratingVFX || isGeneratingCopy

  return (
    <div className="creative-studio fade-in">
      {/* ── HEADER ── */}
      <div className="cs-header">
        <div>
          <h1 className="cs-header-title">Creative Studio</h1>
          <p className="mono cs-header-subtitle">
            AI Asset Generation & Brief Library
          </p>
        </div>
        <div className="cs-view-toggles">
          <button className={`cs-view-btn ${view === 'deploy' ? 'cs-view-btn--active' : ''}`} onClick={() => setView('deploy')}>
            Media
          </button>
          <button className={`cs-view-btn ${view === 'briefs' ? 'cs-view-btn--active' : ''}`} onClick={() => setView('briefs')}>
            Briefs
          </button>
          <button className={`cs-view-btn ${view === 'social' ? 'cs-view-btn--active' : ''}`} onClick={() => setView('social')}>
            Social
          </button>
        </div>
      </div>

      {/* ── ALERTS ── */}
      {error && (
        <div className="cs-error-banner">
          <span className="cs-error-icon">⚠️</span>
          <span className="mono cs-error-text">{error}</span>
        </div>
      )}

      {/* ── CONTENT BODY ── */}
      <div className="cs-content">

        {/* ── VIEW: DEPLOY (MEDIA GENERATION) ── */}
        {view === 'deploy' && (
          <div className="cs-deploy-grid">

            {/* Left: Command Console */}
            <div className="cs-command-console">
              <div className="cs-panel-header">Generation Settings</div>
              <div className="cs-command-body">

                <div className="cs-input-group">
                  <label className="mono cs-label">Model</label>
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
                    <button
                      className={`cs-model-btn ${modelTarget === 'forge' ? 'cs-model-btn--active' : ''}`}
                      onClick={() => setModelTarget('forge')}
                    >
                      <span className="cs-model-icon">⚡</span> FORGE (COPY)
                    </button>
                  </div>
                </div>

                <div className="cs-input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="mono cs-label">Prompt</label>
                  <textarea
                    className="input cs-prompt-input"
                    placeholder={modelTarget === 'forge' ? 'Topic or brief to generate copy for...' : 'Execute creative directive...'}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                  />
                </div>

                <button
                  className={`btn btn-primary mono cs-execute-btn ${isWorking ? 'cs-execute-btn--working' : ''}`}
                  onClick={handleDeploy}
                  disabled={isWorking || !prompt.trim() || !isOnline}
                  title={!isOnline ? "Bridge offline" : ""}
                >
                  {isWorking ? 'Generating...' : 'Generate'}
                </button>

              </div>
            </div>

            {/* Right: Asset Gallery */}
            <div className="cs-gallery-panel">
              <div className="cs-panel-header">Generated Assets</div>
              <div className="cs-gallery-body">
                {gallery.length === 0 ? (
                  <div className="cs-empty-state">
                    <span className="mono cs-empty-text">No assets yet. Generate your first one.</span>
                  </div>
                ) : (
                  <div className="cs-assets-grid">
                    {gallery.map(asset => (
                      <div key={asset.id} className={`cs-asset-card ${asset.status === 'error' ? 'cs-asset-card--error' : ''}`}>
                        <div className="cs-asset-header mono">
                          <span className="text-tertiary">
                            {asset.type?.toUpperCase()} · {asset.id.slice(-6)}
                          </span>
                          <span className={asset.status === 'ready' ? 'text-success' : asset.status === 'error' ? 'text-danger' : 'text-primary'}>
                            [{asset.status.toUpperCase()}]
                          </span>
                        </div>

                        <div className="cs-asset-preview">
                          <AssetPreview asset={asset} />
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
                <span>LIBRARY DIRECTORY</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {categories.map(c => (
                    <button key={c} className={`cs-filter-btn mono ${filterCat === c ? 'cs-filter-btn--active' : ''}`} onClick={() => setFilterCat(c)}>
                      {c.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cs-briefs-grid">
                {briefsLoading && <div className="cs-empty-state"><span className="mono cs-empty-text">LOADING BRIEF LIBRARY...</span></div>}
                {!briefsLoading && filteredBriefs.map(template => (
                  <div key={template.id} className="cs-brief-card" onClick={() => { setActiveTemplate(template); trackUsage(template.id) }}>
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

        {/* ── VIEW: SOCIAL OPS ── */}
        {view === 'social' && (
          <div className="cs-deploy-grid">
            <SocialOpsTab generateCopy={generateCopy} />
          </div>
        )}

      </div>

      {/* Modal */}
      {activeTemplate && (
        <BriefEditor
          template={activeTemplate}
          onClose={() => setActiveTemplate(null)}
          onDeploy={handleBriefDeploy}
        />
      )}

    </div>
  )
}

export default CreativeStudio
