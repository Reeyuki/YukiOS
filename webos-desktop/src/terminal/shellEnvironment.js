export class ShellEnvironment {
  constructor(initial) {
    this.vars = {};
    if (initial) {
      for (const [k, v] of Object.entries(initial)) this.vars[k] = String(v);
    }
  }

  get(name) {
    return this.vars[name] !== undefined ? this.vars[name] : null;
  }

  set(name, value) {
    this.vars[name] = String(value);
  }

  has(name) {
    return this.vars[name] !== undefined;
  }

  unset(name) {
    delete this.vars[name];
  }

  dump() {
    return { ...this.vars };
  }

  expand(str, commandExecutor) {
    str = this.expandTilde(str);
    str = this.expandBraces(str);
    str = this.expandParameters(str);
    str = this.expandArithmetic(str);
    if (commandExecutor) str = this.expandCommandSubstitution(str, commandExecutor);
    return str;
  }

  expandTilde(str) {
    return str.replace(/(^|(?<=\s))~(\/[^\s]*|(?=\s|$))?/g, (match, prefix, rest) => {
      const home = this.vars.HOME || "/home/user";
      if (!rest) return home;
      return home + rest;
    });
  }

  expandBraces(str) {
    const result = [];
    this.expandBracesRecursive(str, 0, "", result);
    return result.length ? result.join(" ") : str;
  }

  expandBracesRecursive(str, pos, prefix, result) {
    let i = pos;
    let cur = "";
    while (i < str.length) {
      const ch = str[i];
      if (ch === "\\" && i + 1 < str.length) {
        cur += str[i + 1];
        i += 2;
        continue;
      }
      if (ch === "{") {
        const braceContent = this.findMatchingBrace(str, i);
        if (braceContent !== null) {
          const { content, end } = braceContent;
          const parts = this.parseBraceParts(content);
          if (parts.length > 1) {
            for (const part of parts) {
              const expanded = this.expandBracesSync(str.slice(end + 1));
              this.expandBracesRecursive(expanded, 0, prefix + cur + part, result);
            }
            return;
          }
          cur += ch;
        } else {
          cur += ch;
        }
      } else {
        cur += ch;
      }
      i++;
    }
    result.push(prefix + cur);
  }

  findMatchingBrace(str, start) {
    if (str[start] !== "{") return null;
    let depth = 1;
    let i = start + 1;
    let inSingle = false;
    let inDouble = false;
    while (i < str.length && depth > 0) {
      const ch = str[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === "\\" && !inSingle) {
        i++;
      } else if (!inSingle && !inDouble) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      i++;
    }
    if (depth !== 0) return null;
    return { content: str.slice(start + 1, i - 1), end: i - 1 };
  }

  parseBraceParts(content) {
    const parts = [];
    let cur = "";
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        cur += ch;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        cur += ch;
        continue;
      }
      if (ch === "\\" && !inSingle) {
        cur += ch;
        if (i + 1 < content.length) {
          cur += content[i + 1];
          i++;
        }
        continue;
      }
      if (!inSingle && !inDouble) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        if (ch === "," && depth === 0) {
          parts.push(cur);
          cur = "";
          continue;
        }
      }
      cur += ch;
    }
    if (cur) parts.push(cur);

    if (parts.length === 1 && content.includes("..")) {
      const rangeMatch = content.match(/^(-?\d+)\.\.(-?\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const range = [];
        const inc = start <= end ? 1 : -1;
        for (let n = start; inc > 0 ? n <= end : n >= end; n += inc) {
          range.push(String(n));
        }
        return range;
      }
    }

    return parts;
  }

  expandBracesSync(str) {
    return this.expandBraces(str);
  }

  expandParameters(str) {
    return str
      .replace(/\$\{([^}]+)\}/g, (match, expr) => {
        return this.expandParameter(expr);
      })
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name) => {
        const val = this.get(name);
        return val !== null ? val : "";
      });
  }

  expandParameter(expr) {
    const colonOps = [
      { op: ":-", handler: (val, word) => (val !== null && val.length > 0 ? val : word) },
      {
        op: ":=",
        handler: (val, word) => {
          if (val !== null && val.length > 0) return val;
          const name = expr.split(":=")[0];
          this.set(name, word);
          return word;
        }
      },
      { op: ":+", handler: (val, word) => (val !== null && val.length > 0 ? word : "") },
      {
        op: ":?",
        handler: (val, word) => {
          if (val !== null && val.length > 0) return val;
          throw new Error(`$${expr.split(":?")[0]}: ${word || "parameter null or not set"}`);
        }
      }
    ];

    for (const { op, handler } of colonOps) {
      const idx = expr.indexOf(op);
      if (idx > 0) {
        const name = expr.slice(0, idx);
        const word = expr.slice(idx + op.length);
        const val = this.get(name);
        return handler(val, word);
      }
    }

    const noColonOps = [
      { op: "-", handler: (val, word) => (val !== null ? val : word) },
      {
        op: "=",
        handler: (val, word) => {
          if (val !== null) return val;
          const name = expr.split("=")[0];
          this.set(name, word);
          return word;
        }
      },
      { op: "+", handler: (val, word) => (val !== null ? word : "") },
      {
        op: "?",
        handler: (val, word) => {
          if (val !== null) return val;
          throw new Error(`$${expr.split("?")[0]}: ${word || "parameter not set"}`);
        }
      }
    ];

    for (const { op, handler } of noColonOps) {
      const idx = expr.indexOf(op);
      if (idx > 0) {
        const name = expr.slice(0, idx);
        const word = expr.slice(idx + op.length);
        const val = this.get(name);
        return handler(val, word);
      }
    }

    const val = this.get(expr);
    return val !== null ? val : "";
  }

  expandArithmetic(str) {
    return str.replace(/\$\(\(([^()]*)\)\)/g, (match, expr) => {
      return String(this.evalArithmetic(expr.trim()));
    });
  }

  evalArithmetic(expr) {
    const tokens = this.tokenizeArithmetic(expr);
    if (tokens.length === 0) return 0;
    return this.parseArithmeticExpression(tokens, 0).value;
  }

  tokenizeArithmetic(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      if (/\s/.test(expr[i])) {
        i++;
        continue;
      }
      if (expr[i] === "+" && i + 1 < expr.length && expr[i + 1] === "+") {
        tokens.push({ type: "INC", value: "++" });
        i += 2;
        continue;
      }
      if (expr[i] === "-" && i + 1 < expr.length && expr[i + 1] === "-") {
        tokens.push({ type: "DEC", value: "--" });
        i += 2;
        continue;
      }
      if (expr[i] === "+" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_ADD", value: "+=" });
        i += 2;
        continue;
      }
      if (expr[i] === "-" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_SUB", value: "-=" });
        i += 2;
        continue;
      }
      if (expr[i] === "*" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_MUL", value: "*=" });
        i += 2;
        continue;
      }
      if (expr[i] === "/" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_DIV", value: "/=" });
        i += 2;
        continue;
      }
      if (expr[i] === "%" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_MOD", value: "%=" });
        i += 2;
        continue;
      }
      if (expr[i] === "<" && expr[i + 1] === "<" && expr[i + 2] === "=") {
        tokens.push({ type: "ASSIGN_SHL", value: "<<=" });
        i += 3;
        continue;
      }
      if (expr[i] === ">" && expr[i + 1] === ">" && expr[i + 2] === "=") {
        tokens.push({ type: "ASSIGN_SHR", value: ">>=" });
        i += 3;
        continue;
      }
      if (expr[i] === "&" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_AND", value: "&=" });
        i += 2;
        continue;
      }
      if (expr[i] === "|" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_OR", value: "|=" });
        i += 2;
        continue;
      }
      if (expr[i] === "^" && expr[i + 1] === "=") {
        tokens.push({ type: "ASSIGN_XOR", value: "^=" });
        i += 2;
        continue;
      }
      if (expr[i] === "=" && expr[i + 1] === "=") {
        tokens.push({ type: "EQ", value: "==" });
        i += 2;
        continue;
      }
      if (expr[i] === "!" && expr[i + 1] === "=") {
        tokens.push({ type: "NE", value: "!=" });
        i += 2;
        continue;
      }
      if (expr[i] === "<" && expr[i + 1] === "=") {
        tokens.push({ type: "LE", value: "<=" });
        i += 2;
        continue;
      }
      if (expr[i] === ">" && expr[i + 1] === "=") {
        tokens.push({ type: "GE", value: ">=" });
        i += 2;
        continue;
      }
      if (expr[i] === "<" && expr[i + 1] === "<") {
        tokens.push({ type: "SHL", value: "<<" });
        i += 2;
        continue;
      }
      if (expr[i] === ">" && expr[i + 1] === ">") {
        tokens.push({ type: "SHR", value: ">>" });
        i += 2;
        continue;
      }
      if (expr[i] === "&" && expr[i + 1] === "&") {
        tokens.push({ type: "LAND", value: "&&" });
        i += 2;
        continue;
      }
      if (expr[i] === "|" && expr[i + 1] === "|") {
        tokens.push({ type: "LOR", value: "||" });
        i += 2;
        continue;
      }
      if (expr[i] === "?") {
        tokens.push({ type: "TERNARY", value: "?" });
        i++;
        continue;
      }
      if (expr[i] === ":") {
        tokens.push({ type: "COLON", value: ":" });
        i++;
        continue;
      }
      if (expr[i] === "(") {
        tokens.push({ type: "LPAREN", value: "(" });
        i++;
        continue;
      }
      if (expr[i] === ")") {
        tokens.push({ type: "RPAREN", value: ")" });
        i++;
        continue;
      }
      if (expr[i] === "~") {
        tokens.push({ type: "BITNOT", value: "~" });
        i++;
        continue;
      }
      if (expr[i] === "!") {
        tokens.push({ type: "NOT", value: "!" });
        i++;
        continue;
      }
      if (expr[i] === "+") {
        tokens.push({ type: "PLUS", value: "+" });
        i++;
        continue;
      }
      if (expr[i] === "-") {
        tokens.push({ type: "MINUS", value: "-" });
        i++;
        continue;
      }
      if (expr[i] === "*") {
        tokens.push({ type: "MUL", value: "*" });
        i++;
        continue;
      }
      if (expr[i] === "/") {
        tokens.push({ type: "DIV", value: "/" });
        i++;
        continue;
      }
      if (expr[i] === "%") {
        tokens.push({ type: "MOD", value: "%" });
        i++;
        continue;
      }
      if (expr[i] === "&") {
        tokens.push({ type: "BITAND", value: "&" });
        i++;
        continue;
      }
      if (expr[i] === "|") {
        tokens.push({ type: "BITOR", value: "|" });
        i++;
        continue;
      }
      if (expr[i] === "^") {
        tokens.push({ type: "BITXOR", value: "^" });
        i++;
        continue;
      }
      if (expr[i] === "=") {
        tokens.push({ type: "ASSIGN", value: "=" });
        i++;
        continue;
      }

      if (/[0-9]/.test(expr[i])) {
        let num = "";
        const startIsZero = expr[i] === "0";
        if (expr[i] === "0" && (expr[i + 1] === "x" || expr[i + 1] === "X")) {
          num = "0x";
          i += 2;
          while (i < expr.length && /[0-9a-fA-F]/.test(expr[i])) {
            num += expr[i];
            i++;
          }
          tokens.push({ type: "NUMBER", value: parseInt(num, 16) });
        } else {
          while (i < expr.length && /[0-9]/.test(expr[i])) {
            num += expr[i];
            i++;
          }
          tokens.push({ type: "NUMBER", value: parseInt(num, 10) });
        }
        continue;
      }

      if (/[A-Za-z_]/.test(expr[i])) {
        let name = "";
        while (i < expr.length && /[A-Za-z_][A-Za-z0-9_]*/.test(expr[i])) {
          name += expr[i];
          i++;
        }
        const val = this.get(name);
        tokens.push({ type: "NUMBER", value: val !== null ? parseInt(val, 10) || 0 : 0 });
        continue;
      }

      i++;
    }
    return tokens;
  }

  parseArithmeticExpression(tokens, pos) {
    return this.parseArithmeticTernary(tokens, pos);
  }

  parseArithmeticTernary(tokens, pos) {
    let result = this.parseArithmeticLogicalOr(tokens, pos);
    if (result.pos < tokens.length && tokens[result.pos].type === "TERNARY") {
      const trueBranch = this.parseArithmeticExpression(tokens, result.pos + 1);
      if (trueBranch.pos < tokens.length && tokens[trueBranch.pos].type === "COLON") {
        const falseBranch = this.parseArithmeticExpression(tokens, trueBranch.pos + 1);
        return { value: result.value ? trueBranch.value : falseBranch.value, pos: falseBranch.pos };
      }
      return { value: result.value, pos: trueBranch.pos };
    }
    return result;
  }

  parseArithmeticLogicalOr(tokens, pos) {
    let left = this.parseArithmeticLogicalAnd(tokens, pos);
    while (left.pos < tokens.length && tokens[left.pos].type === "LOR") {
      const right = this.parseArithmeticLogicalAnd(tokens, left.pos + 1);
      left = { value: left.value || right.value ? 1 : 0, pos: right.pos };
    }
    return left;
  }

  parseArithmeticLogicalAnd(tokens, pos) {
    let left = this.parseArithmeticBitOr(tokens, pos);
    while (left.pos < tokens.length && tokens[left.pos].type === "LAND") {
      const right = this.parseArithmeticBitOr(tokens, left.pos + 1);
      left = { value: left.value && right.value ? 1 : 0, pos: right.pos };
    }
    return left;
  }

  parseArithmeticBitOr(tokens, pos) {
    let left = this.parseArithmeticBitXor(tokens, pos);
    while (left.pos < tokens.length && tokens[left.pos].type === "BITOR") {
      const right = this.parseArithmeticBitXor(tokens, left.pos + 1);
      left = { value: left.value | right.value, pos: right.pos };
    }
    return left;
  }

  parseArithmeticBitXor(tokens, pos) {
    let left = this.parseArithmeticBitAnd(tokens, pos);
    while (left.pos < tokens.length && tokens[left.pos].type === "BITXOR") {
      const right = this.parseArithmeticBitAnd(tokens, left.pos + 1);
      left = { value: left.value ^ right.value, pos: right.pos };
    }
    return left;
  }

  parseArithmeticBitAnd(tokens, pos) {
    let left = this.parseArithmeticEquality(tokens, pos);
    while (left.pos < tokens.length && tokens[left.pos].type === "BITAND") {
      const right = this.parseArithmeticEquality(tokens, left.pos + 1);
      left = { value: left.value & right.value, pos: right.pos };
    }
    return left;
  }

  parseArithmeticEquality(tokens, pos) {
    let left = this.parseArithmeticRelational(tokens, pos);
    while (left.pos < tokens.length && (tokens[left.pos].type === "EQ" || tokens[left.pos].type === "NE")) {
      const op = tokens[left.pos].type;
      const right = this.parseArithmeticRelational(tokens, left.pos + 1);
      left = {
        value: op === "EQ" ? (left.value === right.value ? 1 : 0) : left.value !== right.value ? 1 : 0,
        pos: right.pos
      };
    }
    return left;
  }

  parseArithmeticRelational(tokens, pos) {
    let left = this.parseArithmeticShift(tokens, pos);
    while (left.pos < tokens.length && ["LT", "GT", "LE", "GE"].includes(tokens[left.pos].type)) {
      const op = tokens[left.pos].type;
      const right = this.parseArithmeticShift(tokens, left.pos + 1);
      let val;
      if (op === "LT") val = left.value < right.value ? 1 : 0;
      else if (op === "GT") val = left.value > right.value ? 1 : 0;
      else if (op === "LE") val = left.value <= right.value ? 1 : 0;
      else val = left.value >= right.value ? 1 : 0;
      left = { value: val, pos: right.pos };
    }
    return left;
  }

  parseArithmeticShift(tokens, pos) {
    let left = this.parseArithmeticAddSub(tokens, pos);
    while (left.pos < tokens.length && (tokens[left.pos].type === "SHL" || tokens[left.pos].type === "SHR")) {
      const op = tokens[left.pos].type;
      const right = this.parseArithmeticAddSub(tokens, left.pos + 1);
      left = { value: op === "SHL" ? left.value << right.value : left.value >> right.value, pos: right.pos };
    }
    return left;
  }

  parseArithmeticAddSub(tokens, pos) {
    let left = this.parseArithmeticMulDiv(tokens, pos);
    while (left.pos < tokens.length && (tokens[left.pos].type === "PLUS" || tokens[left.pos].type === "MINUS")) {
      const op = tokens[left.pos].type;
      const right = this.parseArithmeticMulDiv(tokens, left.pos + 1);
      left = { value: op === "PLUS" ? left.value + right.value : left.value - right.value, pos: right.pos };
    }
    return left;
  }

  parseArithmeticMulDiv(tokens, pos) {
    let left = this.parseArithmeticUnary(tokens, pos);
    while (
      left.pos < tokens.length &&
      (tokens[left.pos].type === "MUL" || tokens[left.pos].type === "DIV" || tokens[left.pos].type === "MOD")
    ) {
      const op = tokens[left.pos].type;
      const right = this.parseArithmeticUnary(tokens, left.pos + 1);
      if (op === "DIV" && right.value === 0) throw new Error("Division by zero");
      left = {
        value:
          op === "MUL"
            ? left.value * right.value
            : op === "DIV"
              ? Math.trunc(left.value / right.value)
              : left.value % right.value,
        pos: right.pos
      };
    }
    return left;
  }

  parseArithmeticUnary(tokens, pos) {
    if (pos >= tokens.length) return { value: 0, pos };
    const tok = tokens[pos];
    if (tok.type === "PLUS") {
      const r = this.parseArithmeticUnary(tokens, pos + 1);
      return { value: +r.value, pos: r.pos };
    }
    if (tok.type === "MINUS") {
      const r = this.parseArithmeticUnary(tokens, pos + 1);
      return { value: -r.value, pos: r.pos };
    }
    if (tok.type === "NOT") {
      const r = this.parseArithmeticUnary(tokens, pos + 1);
      return { value: r.value ? 0 : 1, pos: r.pos };
    }
    if (tok.type === "BITNOT") {
      const r = this.parseArithmeticUnary(tokens, pos + 1);
      return { value: ~r.value, pos: r.pos };
    }
    if (tok.type === "INC") {
      if (pos + 1 < tokens.length && tokens[pos + 1].type === "NUMBER") {
        tokens[pos + 1] = { ...tokens[pos + 1], value: tokens[pos + 1].value + 1 };
        return { value: tokens[pos + 1].value, pos: pos + 2 };
      }
      return { value: 0, pos: pos + 1 };
    }
    if (tok.type === "DEC") {
      if (pos + 1 < tokens.length && tokens[pos + 1].type === "NUMBER") {
        tokens[pos + 1] = { ...tokens[pos + 1], value: tokens[pos + 1].value - 1 };
        return { value: tokens[pos + 1].value, pos: pos + 2 };
      }
      return { value: 0, pos: pos + 1 };
    }
    if (tok.type === "NUMBER") return { value: tok.value, pos: pos + 1 };
    if (tok.type === "LPAREN") {
      const inner = this.parseArithmeticExpression(tokens, pos + 1);
      if (inner.pos < tokens.length && tokens[inner.pos].type === "RPAREN")
        return { value: inner.value, pos: inner.pos + 1 };
      return inner;
    }
    return { value: 0, pos: pos + 1 };
  }

  expandCommandSubstitution(str, executor) {
    const result = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === "\\" && i + 1 < str.length) {
        result.push(str[i + 1]);
        i += 2;
        continue;
      }
      if (str[i] === "$" && str[i + 1] === "(") {
        let depth = 1;
        let j = i + 2;
        let inSingle = false;
        let inDouble = false;
        while (j < str.length && depth > 0) {
          const ch = str[j];
          if (ch === "'" && !inDouble) inSingle = !inSingle;
          else if (ch === '"' && !inSingle) inDouble = !inDouble;
          else if (ch === "\\" && !inSingle) {
            j++;
          } else if (!inSingle && !inDouble) {
            if (ch === "(") depth++;
            else if (ch === ")") depth--;
          }
          j++;
        }
        if (depth === 0) {
          const cmdStr = str.slice(i + 2, j - 1);
          const output = executor ? executor(cmdStr) : "";
          result.push(output);
          i = j;
          continue;
        }
        result.push(str[i]);
        i++;
        continue;
      }
      if (str[i] === "`") {
        let j = i + 1;
        let escaped = false;
        let cmdStr = "";
        while (j < str.length && (str[j] !== "`" || escaped)) {
          if (str[j] === "\\" && !escaped) {
            escaped = true;
          } else {
            if (escaped && str[j] !== "`" && str[j] !== "\\" && str[j] !== "$") cmdStr += "\\";
            cmdStr += str[j];
            escaped = false;
          }
          j++;
        }
        if (j < str.length) {
          const output = executor ? executor(cmdStr) : "";
          result.push(output);
          i = j + 1;
          continue;
        }
        result.push(str[i]);
        i++;
        continue;
      }
      result.push(str[i]);
      i++;
    }
    return result.join("");
  }

  expandWord(str, commandExecutor) {
    if (!str) return str;
    let expanded = str;
    expanded = this.expandTilde(expanded);
    expanded = this.expandParameters(expanded);
    expanded = this.expandArithmetic(expanded);
    if (commandExecutor) expanded = this.expandCommandSubstitution(expanded, commandExecutor);
    return expanded;
  }
}
