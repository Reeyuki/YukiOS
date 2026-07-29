import {
  NodeType,
  createBlock,
  createCommand,
  createPipeline,
  createLogical,
  createIf,
  createWhile,
  createForIn,
  createForExpression,
  createAssignment,
  createRedirection,
  createSubshell
} from "./shellAST.js";

const KEYWORDS = new Set(["if", "then", "elif", "else", "fi", "while", "do", "done", "for", "in"]);

export class ShellParser {
  constructor(input) {
    this.input = input;
    this.tokens = [];
    this.pos = 0;
  }

  parse(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = this.tokenize(input);
    const nodes = this.parseBlock();
    return createBlock(nodes);
  }

  tokenize(str) {
    const tokens = [];
    let i = 0;
    const self = this;

    function addToken(type, value) {
      tokens.push({ type, value });
    }

    while (i < str.length) {
      if (str[i] === "\n" || str[i] === ";") {
        addToken("SEMI");
        i++;
        continue;
      }
      if (/\s/.test(str[i])) {
        if (str[i] === "\n") addToken("SEMI");
        i++;
        continue;
      }
      if (str[i] === "#") {
        while (i < str.length && str[i] !== "\n") i++;
        continue;
      }
      if (str[i] === "|" && str[i + 1] === "&") {
        addToken("PIPE", "|&");
        i += 2;
        continue;
      }
      if (str[i] === "|") {
        addToken("PIPE");
        i++;
        continue;
      }
      if (str[i] === "&" && str[i + 1] === "&") {
        addToken("AND");
        i += 2;
        continue;
      }
      if (str[i] === "|" && str[i + 1] === "|") {
        addToken("OR");
        i += 2;
        continue;
      }
      if (str[i] === ">" && str[i + 1] === ">") {
        addToken("REDIR_APPEND");
        i += 2;
        continue;
      }
      if (str[i] === ">" && str[i + 1] === "&") {
        const fd = self.findPrecedingFd(tokens);
        addToken(fd !== null ? "REDIR_FD_DUP" : "REDIR_DUP_OUT");
        i += 2;
        continue;
      }
      if (str[i] === ">") {
        addToken("REDIR_OUT");
        i++;
        continue;
      }
      if (str[i] === "<" && str[i + 1] === "&") {
        addToken("REDIR_DUP_IN");
        i += 2;
        continue;
      }
      if (str[i] === "<") {
        addToken("REDIR_IN");
        i++;
        continue;
      }
      if (str[i] === "(") {
        addToken("LPAREN");
        i++;
        continue;
      }
      if (str[i] === ")") {
        addToken("RPAREN");
        i++;
        continue;
      }
      if (str[i] === "'") {
        i++;
        let val = "";
        while (i < str.length && str[i] !== "'") {
          val += str[i];
          i++;
        }
        if (i < str.length) i++;
        const word = this.makeWordToken(val, true);
        tokens.push(word);
        continue;
      }
      if (str[i] === '"') {
        i++;
        let val = "";
        while (i < str.length && str[i] !== '"') {
          if (str[i] === "\\" && i + 1 < str.length && '\\"$`'.includes(str[i + 1])) {
            val += str[i + 1];
            i += 2;
          } else {
            val += str[i];
            i++;
          }
        }
        if (i < str.length) i++;
        const word = this.makeWordToken(val, false, true);
        tokens.push(word);
        continue;
      }
      if (str[i] === "\\" && i + 1 < str.length) {
        const word = this.makeWordToken(str[i + 1]);
        tokens.push(word);
        i += 2;
        continue;
      }
      let word = "";
      while (i < str.length && !/[ \t\n;|&<>()#]/.test(str[i])) {
        if (str[i] === "\\" && i + 1 < str.length) {
          word += str[i + 1];
          i += 2;
        } else if (str[i] === "'") {
          i++;
          while (i < str.length && str[i] !== "'") {
            word += str[i];
            i++;
          }
          if (i < str.length) i++;
        } else if (str[i] === '"') {
          i++;
          while (i < str.length && str[i] !== '"') {
            if (str[i] === "\\" && i + 1 < str.length && '\\"$`'.includes(str[i + 1])) {
              word += str[i + 1];
              i += 2;
            } else {
              word += str[i];
              i++;
            }
          }
          if (i < str.length) i++;
        } else {
          word += str[i];
          i++;
        }
      }
      if (word) {
        const hasEquals = word.includes("=");
        const beforeEq = word.split("=")[0];
        const isValidAssignment = hasEquals && /^[A-Za-z_][A-Za-z0-9_]*$/.test(beforeEq);
        tokens.push({
          type: isValidAssignment ? "ASSIGN_WORD" : "WORD",
          value: word,
          isQuoted: false,
          isDoubleQuoted: word.startsWith('"') && word.endsWith('"')
        });
      }
    }
    return tokens;
  }

  makeWordToken(value, isSingleQuoted, isDoubleQuoted) {
    return { type: "WORD", value, isQuoted: isSingleQuoted || false, isDoubleQuoted: isDoubleQuoted || false };
  }

  findPrecedingFd(tokens) {
    if (tokens.length === 0) return null;
    const last = tokens[tokens.length - 1];
    if (last.type === "WORD" && /^[0-9]+$/.test(last.value)) {
      return parseInt(last.value, 10);
    }
    return null;
  }

  peek() {
    while (this.pos < this.tokens.length && this.tokens[this.pos].type === "SEMI") this.pos++;
    return this.tokens[this.pos] || null;
  }

  advance() {
    const tok = this.tokens[this.pos];
    if (this.pos < this.tokens.length) this.pos++;
    return tok;
  }

  expect(type) {
    const tok = this.peek();
    if (!tok || tok.type !== type) return null;
    return this.advance();
  }

  parseBlock() {
    const nodes = [];
    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (!tok) break;
      if (
        tok.type === "RPAREN" ||
        tok.value === "fi" ||
        tok.value === "done" ||
        tok.value === "elif" ||
        tok.value === "else"
      ) {
        break;
      }
      if (tok.type === "SEMI") {
        this.pos++;
        continue;
      }
      const node = this.parseLogical();
      if (node) nodes.push(node);
      this.expect("SEMI");
    }
    return nodes;
  }

  parseLogical() {
    let left = this.parsePipeline();
    if (!left) return null;

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (!tok) break;
      if (tok.type === "AND") {
        this.advance();
        const right = this.parsePipeline();
        if (right) left = createLogical(left, "&&", right);
      } else if (tok.type === "OR") {
        this.advance();
        const right = this.parsePipeline();
        if (right) left = createLogical(left, "||", right);
      } else break;
    }
    return left;
  }

  parsePipeline() {
    const commands = [];
    let cmd = this.parseCommand();
    if (!cmd) return null;
    commands.push(cmd);

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (!tok || tok.type !== "PIPE") break;
      this.advance();
      cmd = this.parseCommand();
      if (cmd) commands.push(cmd);
    }
    if (commands.length === 1) return commands[0];
    return createPipeline(commands);
  }

  parseCommand() {
    const tok = this.peek();
    if (!tok) return null;

    if (tok.type === "LPAREN") {
      return this.parseSubshell();
    }

    if (tok.value === "if") return this.parseIf();
    if (tok.value === "while") return this.parseWhile();
    if (tok.value === "for") return this.parseFor();

    const assignments = [];
    const args = [];
    const redirections = [];

    while (this.pos < this.tokens.length) {
      const t = this.peek();
      if (!t) break;
      if (t.type === "PIPE" || t.type === "AND" || t.type === "OR" || t.type === "LPAREN" || t.type === "RPAREN") break;
      if (t.value === "fi" || t.value === "done" || t.value === "elif" || t.value === "else" || t.value === "then")
        break;
      if (t.type === "SEMI") break;

      if (
        t.type === "REDIR_OUT" ||
        t.type === "REDIR_APPEND" ||
        t.type === "REDIR_IN" ||
        t.type === "REDIR_DUP_OUT" ||
        t.type === "REDIR_DUP_IN" ||
        t.type === "REDIR_FD_DUP"
      ) {
        this.advance();
        const target = this.advance();
        let fd = null;
        if (t.type === "REDIR_FD_DUP") {
          const prev = args.length > 0 ? args[args.length - 1] : null;
          if (prev && /^[0-9]+$/.test(prev)) {
            fd = parseInt(args.pop(), 10);
          }
        }
        const rType =
          t.type === "REDIR_OUT"
            ? ">"
            : t.type === "REDIR_APPEND"
              ? ">>"
              : t.type === "REDIR_IN"
                ? "<"
                : t.type === "REDIR_DUP_OUT"
                  ? ">&"
                  : t.type === "REDIR_DUP_IN"
                    ? "<&"
                    : ">&";
        if (target) redirections.push(createRedirection(rType, target.value, fd));
        continue;
      }

      if (t.type === "ASSIGN_WORD" && args.length === 0) {
        this.advance();
        const eqIdx = t.value.indexOf("=");
        const name = t.value.slice(0, eqIdx);
        const val = t.value.slice(eqIdx + 1);
        assignments.push(createAssignment(name, val, "="));
        continue;
      }

      if (t.type === "WORD" || t.type === "ASSIGN_WORD") {
        this.advance();
        args.push(t.value);
        continue;
      }

      break;
    }

    if (assignments.length === 0 && args.length === 0 && redirections.length === 0) return null;

    if (args.length === 0 && assignments.length > 0) {
      return createCommand(null, [], redirections);
    }

    const cmdName = args.length > 0 ? args.shift() : null;
    return createCommand(cmdName, args, redirections);
  }

  parseSubshell() {
    this.advance();
    const body = this.parseBlock();
    this.expect("RPAREN");
    return createSubshell(body);
  }

  parseIf() {
    this.advance();
    const condition = this.parseBlock();
    this.expectKeyword("then");
    const thenBody = this.parseBlock();
    const elifs = [];
    let elseBody = null;

    while (true) {
      const tok = this.peek();
      if (!tok) break;
      if (tok.value === "elif") {
        this.advance();
        const elifCond = this.parseBlock();
        this.expectKeyword("then");
        const elifThen = this.parseBlock();
        elifs.push({ condition: elifCond, body: elifThen });
      } else if (tok.value === "else") {
        this.advance();
        elseBody = this.parseBlock();
      } else if (tok.value === "fi") {
        this.advance();
        break;
      } else break;
    }

    return createIf(condition, thenBody, elifs, elseBody);
  }

  parseWhile() {
    this.advance();
    const condition = this.parseBlock();
    this.expectKeyword("do");
    const body = this.parseBlock();
    this.expectKeyword("done");
    return createWhile(condition, body);
  }

  parseFor() {
    this.advance();
    const varTok = this.advance();
    if (!varTok || varTok.type !== "WORD") return null;
    const variable = varTok.value;

    const next = this.peek();
    const doubleParen = "((";
    if (next && next.value === doubleParen) {
      return this.parseForExpression(variable);
    }

    let wordList = [];
    if (next && next.value === "in") {
      this.advance();
      while (this.pos < this.tokens.length) {
        const t = this.peek();
        if (!t || t.value === "do" || t.type === "SEMI") break;
        if (t.type === "WORD") {
          wordList.push(t.value);
          this.advance();
        } else break;
      }
    }
    this.expectKeyword("do");
    const body = this.parseBlock();
    this.expectKeyword("done");
    return createForIn(variable, wordList, body);
  }

  parseForExpression(variable) {
    this.advance();
    const init = this.parseArithmeticUntil(";");
    this.advance();
    const cond = this.parseArithmeticUntil(";");
    this.advance();
    const step = this.parseArithmeticUntil("))");
    this.advance();
    this.expectKeyword("do");
    const body = this.parseBlock();
    this.expectKeyword("done");
    return createForExpression(variable, init, cond, step, body);
  }

  parseArithmeticUntil(delim) {
    let expr = "";
    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (!tok || (delim === "))" && tok.value === "))") || (delim === ";" && tok.type === "SEMI")) break;
      if (tok.type === "WORD" || tok.type === "ASSIGN_WORD") {
        expr += tok.value + " ";
        this.advance();
      } else break;
    }
    return expr.trim();
  }

  expectKeyword(value) {
    const tok = this.peek();
    if (tok && tok.value === value) {
      this.advance();
      return true;
    }
    return false;
  }
}
