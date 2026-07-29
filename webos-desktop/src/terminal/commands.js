export class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.registerBuiltins();
  }

  register(name, handler) {
    this.commands.set(name, handler);
  }

  has(name) {
    return this.commands.has(name);
  }

  get(name) {
    return this.commands.get(name);
  }

  getNames() {
    return Array.from(this.commands.keys()).sort();
  }

  async execute(name, args, context) {
    const handler = this.commands.get(name);
    if (!handler) return { exitCode: 127 };
    try {
      const result = await handler(args, context);
      return { exitCode: result?.exitCode ?? 0, output: result?.output };
    } catch (err) {
      if (context.printError) context.printError(`${name}: ${err.message}`);
      return { exitCode: 1 };
    }
  }

  registerBuiltins() {
    this.register("lolcat", async (args, ctx) => {
      const stops = [
        [255, 0, 0],
        [255, 119, 0],
        [255, 255, 0],
        [0, 255, 0],
        [0, 0, 255],
        [75, 0, 130],
        [139, 0, 255]
      ];
      let text;
      if (args.length > 0) {
        const fullPath = ctx.pathToAbs(args[0]);
        try {
          if (await ctx.fs.exists(fullPath)) {
            const lastSlash = fullPath.lastIndexOf("/");
            const dir = lastSlash >= 0 ? fullPath.slice(0, lastSlash) || "/" : ".";
            const name = lastSlash >= 0 ? fullPath.slice(lastSlash + 1) : fullPath;
            if (await ctx.fs.isFile(dir, name)) {
              text = await ctx.fs.readTextFile(dir, name);
            }
          }
        } catch {}
        if (text === undefined) text = args.join(" ");
      } else {
        text = "RAINBOW!";
      }
      const n = text.length;
      const colors = new Array(n);
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0;
        const pos = t * (stops.length - 1);
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const a = stops[Math.min(idx, stops.length - 1)];
        const b = stops[Math.min(idx + 1, stops.length - 1)];
        colors[i] = [
          Math.round(a[0] + (b[0] - a[0]) * frac),
          Math.round(a[1] + (b[1] - a[1]) * frac),
          Math.round(a[2] + (b[2] - a[2]) * frac)
        ];
      }
      ctx.printInline(text, colors);
    });

    this.register("locate", async (args, ctx) => {
      if (!args.length) {
        ctx.printError("locate: missing pattern");
        return { exitCode: 1 };
      }
      const pattern = args[0];
      const results = [];
      async function walk(path) {
        try {
          const entries = await ctx.fs.getFolder(path);
          for (const [name, entry] of Object.entries(entries)) {
            const fullPath = path + "/" + name;
            if (fullPath.includes(pattern)) results.push(fullPath);
            if (entry.type !== "file") await walk(fullPath);
          }
        } catch {}
      }
      const root = ctx.env.get("HOME") || "/home/" + (ctx.env.get("USER") || "guest");
      await walk(root);
      for (const r of results) ctx.print(r);
      if (results.length === 0) ctx.print(`locate: no results for '${pattern}'`);
    });
  }
}
