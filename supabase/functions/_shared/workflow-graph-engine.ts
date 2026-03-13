import type { TaskNode } from "./control-plane-types.ts";
import { compact } from "./http.ts";

export interface WorkflowGraphNode extends TaskNode {
  blockers: string[];
}

export interface WorkflowGraphBuildResult {
  nodes: WorkflowGraphNode[];
  adjacency: Record<string, string[]>;
  indegree: Record<string, number>;
  roots: string[];
  topological_order: string[];
  has_cycle: boolean;
  cycle_nodes: string[];
}

export interface WorkflowGraphExecutionSummary {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  blocked: number;
  ready: number;
}

export type TaskExecutionState = "pending" | "running" | "completed" | "failed" | "blocked";

export interface TaskStatusIndex {
  [taskId: string]: TaskExecutionState;
}

function cloneDependencies(dependsOn: string[]) {
  return dependsOn.map((value) => compact(value)).filter(Boolean);
}

export function buildWorkflowGraph(nodes: TaskNode[]): WorkflowGraphBuildResult {
  const normalizedNodes: WorkflowGraphNode[] = nodes.map((node) => ({
    ...node,
    blockers: cloneDependencies(node.depends_on),
  }));

  const nodeIds = new Set(normalizedNodes.map((node) => node.id));
  const adjacency: Record<string, string[]> = {};
  const indegree: Record<string, number> = {};

  for (const node of normalizedNodes) {
    adjacency[node.id] = [];
    indegree[node.id] = 0;
  }

  for (const node of normalizedNodes) {
    for (const dependencyId of cloneDependencies(node.depends_on)) {
      if (!nodeIds.has(dependencyId)) continue;
      adjacency[dependencyId].push(node.id);
      indegree[node.id] = (indegree[node.id] || 0) + 1;
    }
  }

  const queue: string[] = [];
  for (const nodeId of Object.keys(indegree)) {
    if (indegree[nodeId] === 0) queue.push(nodeId);
  }

  const topologicalOrder: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    topologicalOrder.push(current);
    for (const dependentId of adjacency[current] || []) {
      indegree[dependentId] -= 1;
      if (indegree[dependentId] === 0) {
        queue.push(dependentId);
      }
    }
  }

  const hasCycle = topologicalOrder.length !== normalizedNodes.length;
  const cycleNodes = hasCycle
    ? Object.keys(indegree).filter((nodeId) => indegree[nodeId] > 0)
    : [];
  const roots = normalizedNodes
    .filter((node) => (cloneDependencies(node.depends_on).length === 0))
    .map((node) => node.id);

  return {
    nodes: normalizedNodes,
    adjacency,
    indegree,
    roots,
    topological_order: topologicalOrder,
    has_cycle: hasCycle,
    cycle_nodes: cycleNodes,
  };
}

function dependencyState(dependencyId: string, statusById: TaskStatusIndex) {
  return statusById[dependencyId] || "pending";
}

export function getReadyTaskIds(
  graph: WorkflowGraphBuildResult,
  statusById: TaskStatusIndex,
): string[] {
  return graph.nodes
    .filter((node) => {
      const current = statusById[node.id] || "pending";
      if (current !== "pending") return false;
      return cloneDependencies(node.depends_on).every((dependencyId) => {
        return dependencyState(dependencyId, statusById) === "completed";
      });
    })
    .map((node) => node.id);
}

export function markBlockedTasks(
  graph: WorkflowGraphBuildResult,
  statusById: TaskStatusIndex,
): TaskStatusIndex {
  const next: TaskStatusIndex = { ...statusById };
  for (const node of graph.nodes) {
    const current = next[node.id] || "pending";
    if (current !== "pending") continue;

    const hasFailedDependency = cloneDependencies(node.depends_on).some((dependencyId) => {
      return dependencyState(dependencyId, next) === "failed";
    });

    if (hasFailedDependency) {
      next[node.id] = "blocked";
    }
  }
  return next;
}

export function summarizeGraphExecution(
  graph: WorkflowGraphBuildResult,
  statusById: TaskStatusIndex,
): WorkflowGraphExecutionSummary {
  let pending = 0;
  let running = 0;
  let completed = 0;
  let failed = 0;
  let blocked = 0;

  for (const node of graph.nodes) {
    const state = statusById[node.id] || "pending";
    if (state === "running") running += 1;
    else if (state === "completed") completed += 1;
    else if (state === "failed") failed += 1;
    else if (state === "blocked") blocked += 1;
    else pending += 1;
  }

  const ready = getReadyTaskIds(graph, statusById).length;

  return {
    total: graph.nodes.length,
    pending,
    running,
    completed,
    failed,
    blocked,
    ready,
  };
}
