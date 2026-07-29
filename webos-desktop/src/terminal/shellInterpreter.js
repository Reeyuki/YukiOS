import { NodeType } from "./shellAST.js";
import { Stream } from "./stream.js";

export class ShellInterpreter {
  constructor(context) {
    this.ctx = context;
  }

  async execute(ast, options = {}) {
    const { stdin, stdout, stderr } = options;
    const result = await this.executeNode(ast, { stdin, stdout, stderr });
    return result;
  }

  async executeNode(node, io) {
    if (!node) return { exitCode: 0 };

    switch (node.type) {
      case NodeType.Block:
        return this.executeBlock(node, io);
      case NodeType.Logical:
        return this.executeLogical(node, io);
      case NodeType.Pipeline:
        return this.executePipeline(node, io);
      case NodeType.Command:
        return this.executeCommandNode(node, io);
      case NodeType.If:
        return this.executeIf(node, io);
      case NodeType.While:
        return this.executeWhile(node, io);
      case NodeType.ForIn:
        return this.executeForIn(node, io);
      case NodeType.ForExpression:
        return this.executeForExpression(node, io);
      case NodeType.Subshell:
        return this.executeSubshell(node, io);
      default:
        return { exitCode: 0 };
    }
  }

  async executeBlock(node, io) {
    let lastExit = 0;
    for (const child of node.nodes) {
      const result = await this.executeNode(child, io);
      lastExit = result.exitCode;
    }
    return { exitCode: lastExit };
  }

  async executeLogical(node, io) {
    const leftResult = await this.executeNode(node.left, io);
    if (node.operator === "&&") {
      if (leftResult.exitCode === 0) {
        return this.executeNode(node.right, io);
      }
      return leftResult;
    }
    if (node.operator === "||") {
      if (leftResult.exitCode !== 0) {
        return this.executeNode(node.right, io);
      }
      return leftResult;
    }
    return leftResult;
  }

  async executePipeline(node, io) {
    const commands = node.commands;
    if (commands.length === 1) {
      return this.executeNode(commands[0], io);
    }

    const streams = commands.map(() => ({
      stdin: new Stream(),
      stdout: new Stream(),
      stderr: new Stream()
    }));

    for (let i = 0; i < commands.length; i++) {
      if (i > 0) {
        streams[i - 1].stdout.pipe(streams[i].stdin.input);
      }
      if (i === 0 && io.stdin) {
        io.stdin.pipe(streams[i].stdin.input);
      }
      if (i === commands.length - 1 && io.stdout) {
        streams[i].stdout.pipe(io.stdout);
      }
    }

    const results = await Promise.all(
      commands.map((cmd, i) => {
        return this.executeNode(cmd, {
          stdin: streams[i].stdin,
          stdout: streams[i].stdout,
          stderr: streams[i].stderr
        });
      })
    );

    for (const s of streams) {
      s.stdin.end();
      s.stdout.end();
      s.stderr.end();
    }

    const lastResult = results[results.length - 1];
    return { exitCode: lastResult.exitCode, output: lastResult.output };
  }

  async executeCommandNode(node, io) {
    if (!node.name) {
      if (node.assignments && node.assignments.length > 0) {
        for (const ass of node.assignments) {
          if (this.ctx.env) this.ctx.env.set(ass.name, ass.value);
        }
      }
      return { exitCode: 0 };
    }

    const args = [...node.args];
    for (const arg of args) {
      // expand variables in args
    }
    const expandedArgs = args.map((a) => (this.ctx.expandString ? this.ctx.expandString(a) : a));

    if (this.ctx.hasCommand && this.ctx.hasCommand(node.name)) {
      const capturedOutput = [];

      const cmdIo = {
        stdin: io.stdin,
        stdout: io.stdout || { write: (data) => capturedOutput.push(data), end: () => {} },
        stderr: io.stderr || { write: (data) => (this.ctx.print ? this.ctx.print(data) : null), end: () => {} }
      };

      const result = await this.ctx.executeCommand(node.name, expandedArgs, cmdIo);
      return { exitCode: result.exitCode || 0, output: capturedOutput.join("") };
    }

    if (this.ctx.print) {
      this.ctx.print(`bash: ${node.name}: command not found`);
    }
    return { exitCode: 127 };
  }

  async executeIf(node, io) {
    const condResult = await this.executeBlock(node.condition, io);
    if (condResult.exitCode === 0) {
      return this.executeBlock(node.thenBody, io);
    }

    for (const elif of node.elifs) {
      const elifResult = await this.executeBlock(elif.condition, io);
      if (elifResult.exitCode === 0) {
        return this.executeBlock(elif.body, io);
      }
    }

    if (node.elseBody) {
      return this.executeBlock(node.elseBody, io);
    }
    return { exitCode: 0 };
  }

  async executeWhile(node, io) {
    let lastExit = 0;
    while (true) {
      const condResult = await this.executeBlock(node.condition, io);
      if (condResult.exitCode !== 0) break;
      const bodyResult = await this.executeBlock(node.body, io);
      lastExit = bodyResult.exitCode;
    }
    return { exitCode: lastExit };
  }

  async executeForIn(node, io) {
    let lastExit = 0;
    const words = node.words;
    for (const word of words) {
      if (this.ctx.env) this.ctx.env.set(node.variable, word);
      const result = await this.executeBlock(node.body, io);
      lastExit = result.exitCode;
    }
    return { exitCode: lastExit };
  }

  async executeForExpression(node, io) {
    let lastExit = 0;
    if (this.ctx.env) {
      if (node.variable && node.setup) {
        const eqIdx = node.setup.indexOf("=");
        if (eqIdx > 0) {
          const name = node.setup.slice(0, eqIdx);
          const val = node.setup.slice(eqIdx + 1);
          this.ctx.env.set(name, this.ctx.expandString ? this.ctx.expandString(val) : val);
        }
      }
    }

    const maxIter = 10000;
    let iter = 0;
    while (iter < maxIter) {
      iter++;
      const condResult = this.evalCondition(node.condition);
      if (!condResult) break;

      const result = await this.executeBlock(node.body, io);
      lastExit = result.exitCode;

      if (this.ctx.env && node.step) {
        const stepMatch = node.step.match(/([A-Za-z_][A-Za-z0-9_]*)\s*([-+])\s*(\d+)/);
        if (stepMatch) {
          const varName = stepMatch[1];
          const op = stepMatch[2];
          const amount = parseInt(stepMatch[3], 10);
          const curVal = parseInt(this.ctx.env.get(varName) || "0", 10);
          this.ctx.env.set(varName, String(op === "+" ? curVal + amount : curVal - amount));
        }
      }
    }
    return { exitCode: lastExit };
  }

  evalCondition(condition) {
    if (!condition || condition.trim() === "") return true;
    if (/^\d+\s*([<>=!]+\s*\d+)*$/.test(condition)) {
      try {
        if (this.ctx.env && this.ctx.env.evalArithmetic) {
          return this.ctx.env.evalArithmetic(condition) !== 0;
        }
      } catch {}
    }
    return condition !== "0";
  }

  async executeSubshell(node, io) {
    return this.executeBlock(node.body, io);
  }
}
