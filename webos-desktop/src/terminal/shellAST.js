export const NodeType = {
  Block: "Block",
  Command: "Command",
  Pipeline: "Pipeline",
  Logical: "Logical",
  If: "If",
  While: "While",
  ForIn: "ForIn",
  ForExpression: "ForExpression",
  Assignment: "Assignment",
  Redirection: "Redirection",
  Subshell: "Subshell"
};

export function createBlock(nodes) {
  return { type: NodeType.Block, nodes: nodes || [] };
}

export function createCommand(name, args, redirections) {
  return { type: NodeType.Command, name, args: args || [], redirections: redirections || [] };
}

export function createPipeline(commands) {
  return { type: NodeType.Pipeline, commands: commands || [] };
}

export function createLogical(left, operator, right) {
  return { type: NodeType.Logical, left, operator, right };
}

export function createIf(condition, thenBody, elifs, elseBody) {
  return {
    type: NodeType["If"],
    condition,
    thenBody: thenBody || createBlock([]),
    elifs: elifs || [],
    elseBody: elseBody || null
  };
}

export function createWhile(condition, body) {
  return { type: NodeType.While, condition, body: body || createBlock([]) };
}

export function createForIn(variable, wordList, body) {
  return { type: NodeType.ForIn, variable, words: wordList || [], body: body || createBlock([]) };
}

export function createForExpression(variable, setup, condition, step, body) {
  return { type: NodeType.ForExpression, variable, setup, condition, step, body: body || createBlock([]) };
}

export function createAssignment(name, value, op) {
  return { type: NodeType.Assignment, name, value, op: op || "=" };
}

export function createRedirection(type_, target, fd) {
  return { type: NodeType.Redirection, redirectType: type_, target, fd: fd || null };
}

export function createSubshell(body) {
  return { type: NodeType.Subshell, body: body || createBlock([]) };
}
