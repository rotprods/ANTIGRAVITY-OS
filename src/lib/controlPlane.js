import { callSupabaseFunction, getCurrentSession } from './supabase'

export function asControlPlaneRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function extractControlPlaneDispatchResult(controlPlaneDispatch, fallback = {}) {
    const controlPlaneData = asControlPlaneRecord(controlPlaneDispatch?.data)
    const dispatchResult = asControlPlaneRecord(controlPlaneData.dispatch_result)
    if (Object.keys(dispatchResult).length === 0) {
        return controlPlaneDispatch
    }

    return {
        ...dispatchResult,
        control_plane: {
            action: controlPlaneDispatch?.action || 'tool_dispatch',
            trace_id: controlPlaneDispatch?.trace_id || null,
            correlation_id: controlPlaneDispatch?.correlation_id || fallback?.correlation_id || null,
        },
    }
}

export async function dispatchGovernedTool({
    action = 'tool_dispatch',
    sourceAgent = 'copilot',
    source = 'ui',
    targetType = 'agent_action',
    targetRef,
    riskClass = 'medium',
    toolCodeName,
    functionName,
    payload = {},
    context = {},
    orgId = null,
    userId,
    correlationId = null,
}) {
    const session = await getCurrentSession()
    const resolvedUserId = userId === undefined ? (session?.user?.id || null) : userId

    return extractControlPlaneDispatchResult(await callSupabaseFunction('control-plane', {
        body: {
            action,
            org_id: orgId,
            user_id: resolvedUserId,
            source_agent: sourceAgent,
            source,
            target_type: targetType,
            target_ref: targetRef || toolCodeName,
            risk_class: riskClass,
            correlation_id: correlationId,
            context,
            tool_code_name: toolCodeName,
            ...(functionName ? { function_name: functionName } : {}),
            payload,
        },
    }), { correlation_id: correlationId })
}
