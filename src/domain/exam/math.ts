// Công thức trong đề Word → "văn bản xen LaTeX trong \( … \)".
//  - ommlToLatex(xml): Equation gốc của Word (OMML, <m:oMath>) → LaTeX.
//  - prettifyPlainMath(text): công thức gõ bằng chữ ("π/6", "√3", "sin²x", "<=") → bọc cụm biểu thức thành \( … \).
// Chạy được cả trên trình duyệt (Web Worker) lẫn server: không dùng DOMParser.

const SYM: Record<string, string> = {
  'π': '\\pi ', 'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'Δ': '\\Delta ', 'θ': '\\theta ',
  'φ': '\\varphi ', 'ω': '\\omega ', 'λ': '\\lambda ', 'μ': '\\mu ', 'σ': '\\sigma ', 'ε': '\\varepsilon ', 'Ω': '\\Omega ',
  '∞': '\\infty ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '±': '\\pm ', '∓': '\\mp ', '×': '\\times ', '·': '\\cdot ',
  '÷': '\\div ', '∈': '\\in ', '∉': '\\notin ', '⊂': '\\subset ', '⊄': '\\not\\subset ', '∪': '\\cup ', '∩': '\\cap ',
  '∅': '\\varnothing ', 'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', '→': '\\to ',
  '⇒': '\\Rightarrow ', '⇔': '\\Leftrightarrow ', '°': '^\\circ ', '∠': '\\angle ', '⊥': '\\perp ', '∥': '\\parallel ',
  '≈': '\\approx ', '−': '-', '…': '\\ldots ', '∀': '\\forall ', '∃': '\\exists ', '∑': '\\sum ', '∫': '\\int ',
  '∏': '\\prod ', '△': '\\triangle ', '′': "'", '{': '\\{', '}': '\\}', '%': '\\%', '#': '\\#', '$': '\\$', '&': '',
  '_': '\\_', '\\': '\\backslash ', '~': '\\sim ',
};
const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', 'ⁿ': 'n' };
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n' };
const FUNCS = ['arcsin', 'arccos', 'arctan', 'sin', 'cos', 'tan', 'cot', 'log', 'ln', 'lim', 'max', 'min', 'exp'];

export function charsToTex(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; ) {
    const fn = FUNCS.find((f) => s.startsWith(f, i) && !/[A-Za-z]/.test(s[i + f.length] || ''));
    if (fn && !/[A-Za-z]/.test(s[i - 1] || '')) { out += `\\${fn} `; i += fn.length; continue; }
    const ch = s[i];
    if (SUP[ch]) { let t = ''; while (SUP[s[i]]) t += SUP[s[i++]]; out += `^{${t}}`; continue; }
    if (SUB[ch]) { let t = ''; while (SUB[s[i]]) t += SUB[s[i++]]; out += `_{${t}}`; continue; }
    if (ch === '√') {
      const g = sqrtArg(s, i + 1);
      if (g) { out += `\\sqrt{${charsToTex(g.inner)}}`; i = g.end; continue; }
    }
    out += SYM[ch] ?? ch;
    i++;
  }
  return out;
}

/* ---------------- OMML → LaTeX ---------------- */

interface XNode { name: string; attrs: Record<string, string>; children: XNode[]; text?: string }

export const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
   .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');

function parseXml(xml: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const m of xml.matchAll(/<(\/?)([\w:]+)((?:\s+[\w:]+="[^"]*")*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack[stack.length - 1];
    if (m[5] != null) { top.children.push({ name: '#text', attrs: {}, children: [], text: decodeXml(m[5]) }); continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(/([\w:]+)="([^"]*)"/g)) attrs[a[1]] = decodeXml(a[2]);
    const node: XNode = { name: m[2], attrs, children: [] };
    top.children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}
const kid = (n: XNode | undefined, name: string) => n?.children.find((c) => c.name === name);
const kids = (n: XNode, name: string) => n.children.filter((c) => c.name === name);
const prop = (n: XNode, prName: string, key: string): string | undefined => {
  const k = kid(kid(n, prName), key);
  return k ? (k.attrs['m:val'] ?? '') : undefined;
};
const textOf = (n: XNode | undefined): string => (!n ? '' : n.name === '#text' ? (n.text ?? '') : n.children.map(textOf).join(''));

const DELIM: Record<string, string> = { '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '': '.' };
const NARY: Record<string, string> = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' };
const ACC: Record<string, string> = { '̂': '\\hat', '⃗': '\\vec', '̅': '\\overline', '¯': '\\overline', '̃': '\\tilde', '̇': '\\dot', '̈': '\\ddot', '̌': '\\check', '⃖': '\\overleftarrow', '̀': '\\grave', '́': '\\acute' };
const on = (v: string | undefined) => v === '1' || v === 'on' || v === 'true';

function om(n: XNode): string {
  const e = (name: string) => { const c = kid(n, name); return c ? om(c) : ''; };
  switch (n.name) {
    case '#text': return '';
    case 'm:oMathPara': return kids(n, 'm:oMath').map(om).join('\\\\ ');
    case 'm:r': {
      const t = textOf(kid(n, 'm:t'));
      const rpr = kid(n, 'm:rPr');
      if (rpr && kid(rpr, 'm:nor') && /[^\x00-\x7F]|\s/.test(t) && !/^[\s\dπ√²³=+\-×·:;,.()]*$/.test(t)) return `\\text{${t.replace(/[{}\\]/g, '')}}`;
      return charsToTex(t);
    }
    case 'm:f': {
      const type = prop(n, 'm:fPr', 'm:type');
      const a = e('m:num'), b = e('m:den');
      if (type === 'lin') return `{${a}}/{${b}}`;
      if (type === 'noBar') return `\\genfrac{}{}{0pt}{}{${a}}{${b}}`;
      return `\\frac{${a}}{${b}}`;
    }
    case 'm:sSup': return `{${e('m:e')}}^{${e('m:sup')}}`;
    case 'm:sSub': return `{${e('m:e')}}_{${e('m:sub')}}`;
    case 'm:sSubSup': return `{${e('m:e')}}_{${e('m:sub')}}^{${e('m:sup')}}`;
    case 'm:sPre': return `{}_{${e('m:sub')}}^{${e('m:sup')}}{${e('m:e')}}`;
    case 'm:rad': {
      const deg = e('m:deg');
      return on(prop(n, 'm:radPr', 'm:degHide')) || !deg ? `\\sqrt{${e('m:e')}}` : `\\sqrt[${deg}]{${e('m:e')}}`;
    }
    case 'm:d': {
      const beg = prop(n, 'm:dPr', 'm:begChr'), end = prop(n, 'm:dPr', 'm:endChr'), sep = prop(n, 'm:dPr', 'm:sepChr');
      const b = DELIM[beg ?? '('] ?? beg, c = DELIM[end ?? ')'] ?? end;
      const inner = kids(n, 'm:e').map(om).join(sep === undefined ? '|' : (SYM[sep] ?? sep));
      return `\\left${b} ${inner} \\right${c}`;
    }
    case 'm:nary': {
      const chr = prop(n, 'm:naryPr', 'm:chr') ?? '∫';
      const sub = on(prop(n, 'm:naryPr', 'm:subHide')) ? '' : e('m:sub');
      const sup = on(prop(n, 'm:naryPr', 'm:supHide')) ? '' : e('m:sup');
      return `${NARY[chr] ?? chr}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}{${e('m:e')}}`;
    }
    case 'm:func': return `${e('m:fName').trim()} {${e('m:e')}}`;
    case 'm:limLow': {
      const base = e('m:e').trim();
      return /^\\lim$|^lim$/.test(base) ? `\\lim_{${e('m:lim')}}` : `\\underset{${e('m:lim')}}{${base}}`;
    }
    case 'm:limUpp': return `\\overset{${e('m:lim')}}{${e('m:e')}}`;
    case 'm:acc': {
      const chr = prop(n, 'm:accPr', 'm:chr') ?? '̂';
      const base = e('m:e');
      const cmd = ACC[chr] ?? '\\hat';
      const wide = textOf(kid(n, 'm:e')).length > 1;
      if (cmd === '\\vec' && wide) return `\\overrightarrow{${base}}`;
      if (cmd === '\\hat' && wide) return `\\widehat{${base}}`;
      return `${cmd}{${base}}`;
    }
    case 'm:bar': return prop(n, 'm:barPr', 'm:pos') === 'bot' ? `\\underline{${e('m:e')}}` : `\\overline{${e('m:e')}}`;
    case 'm:groupChr': return prop(n, 'm:groupChrPr', 'm:pos') === 'top' ? `\\overbrace{${e('m:e')}}` : `\\underbrace{${e('m:e')}}`;
    case 'm:m': return `\\begin{matrix}${kids(n, 'm:mr').map((r) => kids(r, 'm:e').map(om).join(' & ')).join(' \\\\ ')}\\end{matrix}`;
    case 'm:eqArr': return `\\begin{array}{l}${kids(n, 'm:e').map(om).join(' \\\\ ')}\\end{array}`;
    default: return n.children.filter((c) => !/Pr$/.test(c.name)).map(om).join('');
  }
}

export function ommlToLatex(xml: string): string {
  return om(parseXml(xml)).replace(/\s+/g, ' ').trim();
}

/* ---------------- Công thức gõ bằng chữ ---------------- */

const ATOM = /[0-9A-Za-zπα-ωΔΩ√²³¹⁰⁴-⁹ⁿ₀-₉ₙ.,']/;
const isLetter = (ch: string | undefined) => !!ch && /\p{L}/u.test(ch);
// Chữ của một "từ" (Latin/tiếng Việt), không tính chữ Hy Lạp như π.
const isWordLetter = (ch: string | undefined) => !!ch && /\p{L}/u.test(ch) && !/[α-ωΑ-Ω]/.test(ch);
const balanced = (s: string) => { let d = 0; for (const c of s) { if (c === '(') d++; if (c === ')' && --d < 0) return false; } return d === 0; };

function balancedBack(s: string, close: number) { let d = 0; for (let i = close; i >= 0; i--) { if (s[i] === ')') d++; else if (s[i] === '(' && --d === 0) return i; } return -1; }
function balancedFwd(s: string, open: number) { let d = 0; for (let i = open; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')' && --d === 0) return i; } return -1; }

function sqrtArg(s: string, i: number) {
  if (s[i] === '(') { const j = balancedFwd(s, i); return j > 0 ? { inner: s.slice(i + 1, j), end: j + 1 } : null; }
  const m = s.slice(i).match(/^(\d+(?:[.,]\d+)?|[A-Za-z])/);
  return m ? { inner: m[1], end: i + m[1].length } : null;
}

// Toán hạng của "/": nhóm ngoặc, hoặc chuỗi ký tự toán có tối đa 1 chữ Latin (không bắt "cm/s", "km/h").
function atomOk(run: string, before: string | undefined, after: string | undefined) {
  if (!run) return false;
  if ((run.match(/[A-Za-z]/g) || []).length > 1) return false;
  if (/^[.,']|[.,]$/.test(run)) return false;
  return !isLetter(before) && !isLetter(after);
}
function leftOperand(s: string, slash: number) {
  let i = slash - 1;
  if (s[i] === ' ') i--;
  if (s[i] === ')') {
    const o = balancedBack(s, i);
    if (o < 0) return null;
    const st = s[o - 1] === '√' ? o - 1 : o;
    if (isLetter(s[st - 1])) return null; // sin(…)/2: bỏ qua
    return { start: st, tex: s[st] === '√' ? charsToTex(s.slice(st, i + 1)) : charsToTex(s.slice(o + 1, i)) };
  }
  let st = i + 1;
  while (st > 0 && ATOM.test(s[st - 1])) st--;
  const run = s.slice(st, i + 1);
  return atomOk(run, s[st - 1], undefined) ? { start: st, tex: charsToTex(run) } : null;
}
function rightOperand(s: string, slash: number) {
  let i = slash + 1;
  if (s[i] === ' ') i++;
  if (s[i] === '(') {
    const c = balancedFwd(s, i);
    return c < 0 ? null : { end: c + 1, tex: charsToTex(s.slice(i + 1, c)) };
  }
  let en = i;
  while (en < s.length && ATOM.test(s[en])) en++;
  let run = s.slice(i, en);
  while (/[.,]$/.test(run)) { run = run.slice(0, -1); en--; }
  return atomOk(run, undefined, s[en]) ? { end: en, tex: charsToTex(run) } : null;
}

const TYPO: [RegExp, string][] = [[/<=>/g, '⇔'], [/<=/g, '≤'], [/>=/g, '≥'], [/=>/g, '⇒'], [/!=/g, '≠']];
const MATH_SYM = /[=+\-−×·:/<>≤≥≠±∓∈∉⊂∪∩→⇒⇔√²³¹⁰⁴-⁹ⁿ₀-₉ₙ()[\]{};,.'|°∞∠⊥∥≈△π α-ωΔΩℝℕℤℚ∅…]/;
const OPS = /[=+\-−×·:/<>≤≥≠±∈∉⊂∪∩→⇒⇔√²³⁰⁴-⁹ⁿπα-ωΔΩ∞]/;

function tokens(text: string) {
  const out: { t: string; math: boolean }[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < text.length && /[A-Za-z]/.test(text[j])) j++;
      const w = text.slice(i, j);
      const isMath = w.length === 1 || FUNCS.includes(w);
      out.push({ t: w, math: isMath && !isWordLetter(text[j]) && !isWordLetter(text[i - 1]) });
      i = j; continue;
    }
    if (/\d/.test(ch)) { let j = i; while (j < text.length && /\d/.test(text[j])) j++; out.push({ t: text.slice(i, j), math: true }); i = j; continue; }
    out.push({ t: ch, math: MATH_SYM.test(ch) });
    i++;
  }
  return out;
}

function runToTex(run: string) {
  const spans: { start: number; end: number; tex: string }[] = [];
  for (let k = 0; k < run.length; k++) {
    if (run[k] !== '/') continue;
    const L = leftOperand(run, k), R = rightOperand(run, k);
    if (L && R) spans.push({ start: L.start, end: R.end, tex: `\\frac{${L.tex}}{${R.tex}}` });
  }
  const taken: typeof spans = [];
  for (const sp of spans) if (!taken.some((t) => sp.start < t.end && t.start < sp.end)) taken.push(sp);
  taken.sort((a, b) => a.start - b.start);
  let out = '', pos = 0;
  for (const t of taken) { out += charsToTex(run.slice(pos, t.start)) + t.tex; pos = t.end; }
  out += charsToTex(run.slice(pos));
  return out
    .replace(/(\d),(\d)/g, '$1{,}$2')
    .replace(/\\in\s*([RNZQ])(?![A-Za-z])/g, '\\in \\mathbb{$1}')
    .replace(/\s+/g, ' ').trim();
}

function prettifyPlain(text: string) {
  for (const [re, to] of TYPO) text = text.replace(re, to);
  let out = '', buf = '';
  const flush = () => {
    if (!buf) return;
    const m = buf.match(/^([\s,.;:+=]*)([\s\S]*?)([\s,.;:(+\-=]*)$/)!;
    const core = m[2];
    const worth = core.replace(/\s/g, '').length >= 2 && !/^[/)]/.test(core) && balanced(core) &&
      (OPS.test(core) || FUNCS.some((f) => new RegExp('(^|[^A-Za-z])' + f + '(?![A-Za-z]{2})').test(core)));
    out += worth ? `${m[1]}\\(${runToTex(core)}\\)${m[3]}` : buf;
    buf = '';
  };
  for (const tk of tokens(text)) { if (tk.math) buf += tk.t; else { flush(); out += tk.t; } }
  flush();
  return out;
}

/** Bọc công thức gõ bằng chữ thành \( … \). Giữ nguyên LaTeX sẵn có (\( … \), $…$) và token ảnh ⟦img:…⟧. */
export function prettifyPlainMath(s: string | null): string | null {
  if (!s) return s;
  s = s.replace(/\$([^$\n]+)\$/g, (_, t) => `\\(${t}\\)`);
  return s.split(/(\\\([\s\S]*?\\\)|⟦img:[^⟧]*⟧)/).map((part) => (part.startsWith('\\(') || part.startsWith('⟦') ? part : prettifyPlain(part))).join('');
}
