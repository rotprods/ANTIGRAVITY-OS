#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

function parseArgs(argv = []) {
  return {
    apply: argv.includes('--apply'),
    strict: argv.includes('--strict'),
    skipSync: argv.includes('--skip-sync'),
    skipBuildLayer: argv.includes('--skip-build-layer'),
    skipEcosystemLayer: argv.includes('--skip-ecosystem-layer'),
    skipN8n: argv.includes('--skip-n8n'),
    skipAudit: argv.includes('--skip-audit'),
  }
}

function runCommand(command, args = []) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    })

    child.on('close', (code) => resolve(code || 0))
    child.on('error', () => resolve(1))
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const failures = []

  const steps = []

  if (!options.skipSync) {
    steps.push({
      name: 'Sync Public APIs',
      command: 'npm',
      args: ['run', 'sync:public-apis'],
      required: false,
    })
  }

  if (!options.skipBuildLayer) {
    steps.push({
      name: 'Build Public API Infra Layer',
      command: 'npm',
      args: ['run', 'build:public-api-infra-layer'],
      required: true,
    })
  }

  if (!options.skipEcosystemLayer) {
    steps.push({
      name: 'Build Public API Ecosystem Layer',
      command: 'npm',
      args: ['run', 'build:public-api-ecosystem-layer'],
      required: true,
    })

    steps.push({
      name: 'Build Project APIs Pack',
      command: 'npm',
      args: ['run', 'build:project-apis'],
      required: true,
    })
  }

  steps.push({
    name: 'Bootstrap Public API Connectors',
    command: 'npm',
    args: [
      'run',
      'public-apis:bootstrap',
      '--',
      ...(options.apply ? ['--apply'] : []),
      ...(options.apply ? ['--healthcheck'] : []),
      ...(options.strict ? ['--strict'] : []),
    ],
    required: true,
  })

  if (!options.skipN8n) {
    steps.push({
      name: 'Bootstrap n8n Credentials',
      command: 'npm',
      args: ['run', 'bootstrap:n8n-credentials', '--', ...(options.apply ? ['--apply'] : [])],
      required: false,
    })
  }

  if (!options.skipAudit) {
    steps.push(
      {
        name: 'Audit n8n Workflows',
        command: 'npm',
        args: ['run', 'audit:n8n-workflows'],
        required: false,
      },
      {
        name: 'Reconcile n8n ↔ OCULOPS',
        command: 'npm',
        args: ['run', 'reconcile:n8n-oculops', '--', ...(options.apply ? ['--apply'] : []), '--recent-hours', '72'],
        required: false,
      },
    )
  }

  for (const step of steps) {
    console.log(`\n[finalize-public-api-infra] ▶ ${step.name}`)
    const code = await runCommand(step.command, step.args)
    if (code !== 0) {
      failures.push({ step: step.name, code, required: step.required })
      console.warn(`[finalize-public-api-infra] ✗ ${step.name} failed with code ${code}`)
      if (step.required) break
    } else {
      console.log(`[finalize-public-api-infra] ✓ ${step.name}`)
    }
  }

  const requiredFailure = failures.find(item => item.required)
  if (requiredFailure) {
    process.exitCode = 1
  }

  console.log('\n[finalize-public-api-infra] summary')
  if (failures.length === 0) {
    console.log('All steps passed.')
    return
  }

  for (const failure of failures) {
    console.log(`- ${failure.step} (code ${failure.code})${failure.required ? ' [required]' : ''}`)
  }
}

main().catch((error) => {
  console.error('[finalize-public-api-infra] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
