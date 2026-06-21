import json
import os
import re
import time
import urllib.request
import urllib.error

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
CACHE_TTL = 3600


def _ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)


def fetch_text(url):
    _ensure_cache_dir()
    cache_key = re.sub(r"[^a-zA-Z0-9]", "_", url.split("/")[-1])
    cache_path = os.path.join(CACHE_DIR, f"raw_{cache_key}.txt")
    ts_path = os.path.join(CACHE_DIR, f"raw_{cache_key}_ts.txt")

    if os.path.exists(cache_path) and os.path.exists(ts_path):
        with open(ts_path) as f:
            cached_ts = float(f.read().strip())
        if time.time() - cached_ts < CACHE_TTL:
            with open(cache_path, encoding="utf-8") as f:
                return f.read()

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "YukiOS-Discord-Bot/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8")
    except Exception as e:
        if os.path.exists(cache_path):
            with open(cache_path, encoding="utf-8") as f:
                return f.read()
        raise RuntimeError(f"Failed to fetch {url}: {e}")

    with open(cache_path, "w", encoding="utf-8") as f:
        f.write(text)
    with open(ts_path, "w") as f:
        f.write(str(time.time()))

    return text


def _extract_balanced(text, start_pos):
    first_char = text[start_pos]
    if first_char == "{":
        close_char = "}"
    elif first_char == "[":
        close_char = "]"
    else:
        raise ValueError(f"Unexpected starting character '{first_char}'")

    depth = 1
    pos = start_pos + 1
    in_str = False
    str_ch = None

    while pos < len(text) and depth > 0:
        ch = text[pos]
        if in_str:
            if ch == "\\":
                pos += 2
                continue
            elif ch == str_ch:
                in_str = False
        elif ch in "\"'`":
            in_str = True
            str_ch = ch
        elif ch == "/" and pos + 1 < len(text):
            if text[pos + 1] == "/":
                end = text.find("\n", pos)
                pos = end if end != -1 else len(text)
                continue
            elif text[pos + 1] == "*":
                end = text.find("*/", pos + 2)
                pos = end + 2 if end != -1 else len(text)
                continue
        elif ch == first_char:
            depth += 1
        elif ch == close_char:
            depth -= 1
        pos += 1

    if depth != 0:
        raise ValueError("Unbalanced brackets")

    return text[start_pos:pos]


def extract_js_var(js_text, var_name, var_map=None):
    pattern = r"(?:export\s+)?(?:const|let|var)\s+" + re.escape(var_name) + r"\s*=\s*"
    m = re.search(pattern, js_text, re.DOTALL)
    if not m:
        raise ValueError(f"Variable '{var_name}' not found in JS")

    start = m.end()
    while start < len(js_text) and js_text[start] in " \t\n\r":
        start += 1
    if start >= len(js_text):
        raise ValueError("Unexpected end of JS text")

    literal = _extract_balanced(js_text, start)
    return _parse_js_literal(literal, var_map or {})


def extract_js_string_var(js_text, var_name):
    pattern = r"(?:const|let|var)\s+" + re.escape(var_name) + r"\s*=\s*"
    m = re.search(pattern, js_text)
    if not m:
        return None
    start = m.end()
    val_text = js_text[start:].strip()
    if val_text.startswith('"'):
        end = val_text.find('"', 1)
        if end != -1:
            return val_text[1:end]
    elif val_text.startswith("'"):
        end = val_text.find("'", 1)
        if end != -1:
            return val_text[1:end]
    return None


def _resolve_template_expr(text, var_map):
    result = []
    i = 0
    while i < len(text):
        dollar_brace = text.find("${", i)
        if dollar_brace == -1:
            result.append(text[i:])
            break
        result.append(text[i:dollar_brace])
        end = text.find("}", dollar_brace + 2)
        if end == -1:
            result.append(text[dollar_brace:])
            break
        expr = text[dollar_brace + 2:end].strip()
        result.append(var_map.get(expr, ""))
        i = end + 1
    return "".join(result)


def _replace_js_identifiers(text):
    result = []
    i = 0
    in_str = False
    str_ch = None
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                result.append(ch)
                i += 1
                if i < len(text):
                    result.append(text[i])
            elif ch == str_ch:
                in_str = False
                result.append(ch)
            else:
                result.append(ch)
            i += 1
            continue
        if ch in "\"'`":
            in_str = True
            str_ch = ch
            result.append(ch)
            i += 1
            continue
        rest = text[i:]
        m = re.match(r'\b[A-Za-z_$][A-Za-z0-9_$]*\.[A-Za-z_$][A-Za-z0-9_$]*', rest)
        if m:
            result.append('null')
            i += m.end()
            continue
        result.append(ch)
        i += 1
    return "".join(result)


def _remove_arrow_functions(text):
    result = []
    i = 0
    in_str = False
    str_ch = None
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                result.append(ch)
                i += 1
                if i < len(text):
                    result.append(text[i])
            elif ch == str_ch:
                in_str = False
                result.append(ch)
            else:
                result.append(ch)
        elif ch in "\"'`":
            in_str = True
            str_ch = ch
            result.append(ch)
        else:
            rest = text[i:]
            m = re.match(r'(:\s*)(?:async\s+)?\([^)]*\)\s*=>\s*\{', rest)
            if m:
                result.append(m.group(1) + 'null')
                i += m.end()
                depth = 1
                while i < len(text) and depth > 0:
                    if text[i] == '{':
                        depth += 1
                    elif text[i] == '}':
                        depth -= 1
                    i += 1
                continue
            result.append(ch)
        i += 1
    return "".join(result)


def _parse_js_literal(literal, var_map=None):
    literal = _replace_js_identifiers(literal)
    literal = _resolve_template_expr(literal, var_map or {})
    literal = _remove_arrow_functions(literal)
    try:
        import json5
        try:
            return json5.loads(literal)
        except Exception:
            pass
    except ImportError:
        pass

    cleaned = _js_literal_to_json(literal)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        lines = cleaned.split("\n")
        ctx = ""
        if e.lineno and e.lineno <= len(lines):
            idx = e.lineno - 1
            start = max(0, idx - 2)
            end = min(len(lines), idx + 3)
            ctx = "\n".join(f"  {i+1}: {lines[i][:200]}" for i in range(start, end))
        raise ValueError(f"JSON parse error at {e.msg}\nContext:\n{ctx}")


def _js_literal_to_json(text):
    text = _strip_js_comments(text)
    text = _convert_single_quotes(text)
    text = _convert_template_literals(text)
    text = _strip_trailing_commas(text)
    text = _quote_keys(text)
    return text


def _strip_js_comments(text):
    result = []
    i = 0
    in_str = False
    str_ch = None
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                result.append(ch)
                i += 1
                if i < len(text):
                    result.append(text[i])
            elif ch == str_ch:
                in_str = False
                result.append(ch)
            else:
                result.append(ch)
            i += 1
            continue
        if ch in "\"'`":
            in_str = True
            str_ch = ch
            result.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < len(text):
            if text[i + 1] == "/":
                end = text.find("\n", i)
                i = end if end != -1 else len(text)
                continue
            elif text[i + 1] == "*":
                end = text.find("*/", i + 2)
                i = end + 2 if end != -1 else len(text)
                continue
        result.append(ch)
        i += 1
    return "".join(result)


def _convert_single_quotes(text):
    result = []
    i = 0
    in_str = False
    str_ch = None
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                result.append(ch)
                i += 1
                if i < len(text):
                    result.append(text[i])
            elif ch == str_ch:
                in_str = False
                result.append('"')
            elif ch == "'":
                result.append("'")
            else:
                result.append(ch)
        else:
            if ch == "'":
                in_str = True
                result.append('"')
            elif ch == '"':
                in_str = True
                str_ch = ch
                result.append(ch)
            else:
                result.append(ch)
        i += 1
    return "".join(result)


def _convert_template_literals(text):
    result = []
    i = 0
    in_tpl = False
    depth = 0
    expr_stack = [""]
    while i < len(text):
        ch = text[i]
        if not in_tpl:
            if ch == "`":
                in_tpl = True
                result.append('"')
            else:
                result.append(ch)
        else:
            if ch == "\\":
                result.append(ch)
                i += 1
                if i < len(text):
                    result.append(text[i])
            elif ch == "${" and not expr_stack[-1]:
                depth += 1
                expr_stack.append("")
                result.append(ch)
            elif ch == "}" and depth > 0:
                expr_stack.pop()
                depth -= 1
                if depth == 0:
                    in_tpl = False
                result.append(ch)
            elif ch == "`" and depth == 0:
                in_tpl = False
                result.append('"')
            else:
                result.append(ch)
        i += 1
    return "".join(result)


def _quote_keys(text):
    return re.sub(
        r"([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:",
        lambda m: m.group(1) + '"' + m.group(2) + '":',
        text
    )


def _strip_trailing_commas(text):
    return re.sub(r",\s*([}\]])", r"\1", text)
