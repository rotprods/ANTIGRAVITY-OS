export const N8N_AIRDROP_INTEL = {
  generatedAt: '2026-03-13',
  stats: {
    expertPacks: 7,
    workflowJsons: 4343,
    uniqueWorkflows: 2061,
    totalSkills: 1234,
  },
  paths: {
    skills: '~/Downloads/N8N_AIRDROP_PACK/n8n-skills/skills/',
    workflows: '~/Downloads/N8N_AIRDROP_PACK/n8n-workflows/workflows/',
    aiStack: '~/Downloads/N8N_AIRDROP_PACK/n8n-workflows/ai-stack/',
  },
}

export const N8N_EXPERT_PACKS = [
  { invoke: '@n8n-code-javascript', teaches: 'JS Code nodes: $input, $json, $node, $helpers' },
  { invoke: '@n8n-code-python', teaches: 'Python Code nodes: _input, _json, stdlib constraints' },
  { invoke: '@n8n-expression-syntax', teaches: '{{}} syntax, $json.body access, node refs' },
  { invoke: '@n8n-mcp-tools-expert', teaches: 'search_nodes, validate_node, create/deploy workflow' },
  { invoke: '@n8n-node-configuration', teaches: 'Operation fields, dependencies, conditional params' },
  { invoke: '@n8n-validation-expert', teaches: 'Validation errors, false positives, sanitization loops' },
  { invoke: '@n8n-workflow-patterns', teaches: 'Webhook, HTTP API, DB Sync, AI Agent, Scheduled' },
]

export const N8N_TOP_WORKFLOW_CATEGORIES = [
  { name: 'Manual', count: 391, bestUse: 'Manual trigger / testing' },
  { name: 'Splitout', count: 194, bestUse: 'Array loops and fan-out logic' },
  { name: 'Code', count: 183, bestUse: 'Custom JS/Python logic' },
  { name: 'Http', count: 176, bestUse: 'REST API integration' },
  { name: 'Telegram', count: 119, bestUse: 'Bots and webhook chat flows' },
  { name: 'Wait', count: 104, bestUse: 'Delay and sequencing' },
  { name: 'Webhook', count: 65, bestUse: 'Inbound events' },
  { name: 'Schedule', count: 52, bestUse: 'Cron automations' },
]

export const N8N_SUGGESTED_COMBOS = [
  {
    task: 'Build n8n workflow',
    skills: ['@n8n-workflow-patterns', '@n8n-mcp-tools-expert', '@n8n-code-javascript'],
  },
  {
    task: 'Build Telegram bot',
    skills: ['@telegram-bot-builder', '@n8n-workflow-patterns', '@n8n-expression-syntax'],
  },
  {
    task: 'AI agent system',
    skills: ['@agent-orchestrator', '@rag-engineer', '@llm-ops', '@langfuse'],
  },
  {
    task: 'Image generator',
    skills: ['@comfyui-gateway', '@fal-generate', '@n8n-workflow-patterns'],
  },
]

export const N8N_AI_STACK_SERVICES = [
  {
    key: 'n8n',
    label: 'n8n',
    envKey: 'VITE_N8N_BASE_URL',
    defaultBaseUrl: 'http://127.0.0.1:5680',
    healthPath: '/healthz',
    role: 'Workflow conductor',
  },
  {
    key: 'agentZero',
    label: 'Agent Zero',
    envKey: 'VITE_AGENT_ZERO_BASE_URL',
    defaultBaseUrl: 'http://localhost:50080',
    healthPath: '/',
    role: 'AI planner/runtime',
  },
  {
    key: 'comfyUI',
    label: 'ComfyUI',
    envKey: 'VITE_COMFYUI_BASE_URL',
    defaultBaseUrl: 'http://localhost:8188',
    healthPath: '/system_stats',
    role: 'Image/video generation',
  },
]
