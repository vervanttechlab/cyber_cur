// Command-line tokenizer: quotes, PowerShell script blocks, pipes, ; && and > / >> redirects.

export interface Cmd { argv: string[] }
export interface Pipeline { cmds: Cmd[]; redirect?: { file: string; append: boolean } }
export interface Chain { items: { pipeline: Pipeline; op: ';' | '&&' | null }[] }

type Tok = { t: 'word'; v: string } | { t: 'op'; v: '|' | ';' | '&&' | '>' | '>>' };

export function tokenize(line: string, windows: boolean): Tok[] {
  const toks: Tok[] = [];
  let i = 0, cur = '', inWord = false;
  const push = () => { if (inWord) { toks.push({ t: 'word', v: cur }); cur = ''; inWord = false; } };
  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t') { push(); i++; continue; }
    if (c === "'") {
      const j = line.indexOf("'", i + 1);
      const end = j < 0 ? line.length : j;
      cur += line.slice(i + 1, end); inWord = true; i = end + 1; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < line.length && line[j] !== '"') {
        if (!windows && line[j] === '\\' && (line[j + 1] === '"' || line[j + 1] === '\\')) { s += line[j + 1]; j += 2; continue; }
        s += line[j]; j++;
      }
      cur += s; inWord = true; i = j + 1; continue;
    }
    if (windows && c === '{') { // PowerShell script block -> one token including braces
      let depth = 0, j = i;
      for (; j < line.length; j++) { if (line[j] === '{') depth++; else if (line[j] === '}' && --depth === 0) break; }
      cur += line.slice(i, j + 1); inWord = true; i = j + 1; continue;
    }
    if (!windows && c === '\\' && i + 1 < line.length) { cur += line[i + 1]; inWord = true; i += 2; continue; }
    if (c === '|') { push(); toks.push({ t: 'op', v: '|' }); i++; continue; }
    if (c === ';') { push(); toks.push({ t: 'op', v: ';' }); i++; continue; }
    if (c === '&' && line[i + 1] === '&') { push(); toks.push({ t: 'op', v: '&&' }); i += 2; continue; }
    if (c === '>') {
      push();
      if (line[i + 1] === '>') { toks.push({ t: 'op', v: '>>' }); i += 2; } else { toks.push({ t: 'op', v: '>' }); i++; }
      continue;
    }
    cur += c; inWord = true; i++;
  }
  push();
  return toks;
}

export function parse(line: string, windows: boolean): Chain {
  const toks = tokenize(line, windows);
  const chain: Chain = { items: [] };
  let pipe: Pipeline = { cmds: [] }, argv: string[] = [];
  const endCmd = () => { if (argv.length) pipe.cmds.push({ argv }); argv = []; };
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k];
    if (tk.t === 'word') { argv.push(tk.v); continue; }
    if (tk.v === '|') { endCmd(); continue; }
    if (tk.v === '>' || tk.v === '>>') {
      const f = toks[k + 1];
      if (f && f.t === 'word') { pipe.redirect = { file: f.v, append: tk.v === '>>' }; k++; }
      continue;
    }
    endCmd();
    if (pipe.cmds.length) chain.items.push({ pipeline: pipe, op: tk.v });
    pipe = { cmds: [] };
  }
  endCmd();
  if (pipe.cmds.length) chain.items.push({ pipeline: pipe, op: null });
  return chain;
}
