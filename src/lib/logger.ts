const NS_PAD = 32;

const CC = {
  invert: "\x1b[7m",
  clear: "\x1b[0m",

  red: "\x1b[31m",
  yellow: "\x1b[33m",

  cyan: "\x1b[36m",
  brightCyan: "\x1b[96m",

  green: "\x1b[32m",
  magenta: "\x1b[35m",

  teal: "\x1b[38;5;30m",
  lightPurple: "\x1b[38;5;141m",
  pink: "\x1b[38;5;219m",
  orange: "\x1b[38;5;208m",
  lightBlue: "\x1b[38;5;75m",
};

let start = Date.now();

export const log = {
  webhook: (label: string, ...args: any) => {
    start = Date.now();
    console.info(title(label), ...args.map(stringify));
  },

  llm: (label: string, ...args: any) =>
    console.info(title(label, CC.pink), ...args.map(stringify)),

  relay: (label: string, ...args: any) =>
    console.info(title(label, CC.cyan), ...args.map(stringify)),

  green: (label: string, ...args: any) =>
    console.info(title(label, CC.green), ...args.map(stringify)),

  cyan: (label: string, ...args: any) =>
    console.info(title(label, CC.cyan), ...args.map(stringify)),

  brightCyan: (label: string, ...args: any) =>
    console.info(title(label, CC.brightCyan), ...args.map(stringify)),

  pink: (label: string, ...args: any) =>
    console.info(title(label, CC.pink), ...args.map(stringify)),

  yellow: (label: string, ...args: any) =>
    console.info(title(label, CC.yellow), ...args.map(stringify)),

  lightPurple: (label: string, ...args: any) =>
    console.info(title(label, CC.lightPurple), ...args.map(stringify)),

  lightBlue: (label: string, ...args: any) =>
    console.info(title(label, CC.lightBlue), ...args.map(stringify)),

  info: (label: string, ...args: any) =>
    console.info(title(label), ...args.map(stringify)),
  error: (label: string, ...args: any) =>
    console.error(title(label), ...args.map(stringify)),
  xml: (label: string, xml: string) =>
    console.log(title(label), "\n", prettyXML(redactPhoneNumbers(xml))),
};

// ========================================
// Helpers
// ========================================
function title(label: string, cc = "") {
  const elapsed = sinceStart();

  const msg = `${elapsed}  ${label}`.padEnd(NS_PAD, " ");

  return `${cc}${CC.invert}${msg}${CC.clear}${cc}`;
}

function sinceStart() {
  const elapsed = Date.now() - start;
  const min = Math.floor(elapsed / (60 * 1000));
  const sec = Math.floor((elapsed % (60 * 1000)) / 1000);
  const ms = elapsed % 1000;

  return (
    `${min.toString().padStart(2, "0")}m ` +
    `${sec.toString().padStart(2, "0")}s ` +
    `${ms.toString().padStart(3, "0")}ms`
  );
}

function stringify(item: any) {
  if (typeof item === "object") return redactPhoneNumbers(JSON.stringify(item));
  if (typeof item === "string") return redactPhoneNumbers(item);

  return item;
}

export function prettyXML(xml: string): string {
  const maxParameterValueLength = 50;
  const indent = "  "; // two-space indent everywhere

  /* ──────────────────────────────
   * 0. Remove stray whitespace
   * ────────────────────────────── */
  let formatted = xml
    .replace(/>\s*</g, "><")
    .replace("rapid-champion-snake", "•".repeat(9));

  /* ──────────────────────────────
   * 1. ConversationRelay (unchanged, but
   *    uses `indent` instead of “\t”)
   * ────────────────────────────── */
  formatted = formatted.replace(
    /<ConversationRelay\b([^>]*)>/g,
    (_match, rawAttrs) => {
      const selfClose = rawAttrs.trim().endsWith("/");
      const attrsPart = selfClose
        ? rawAttrs.trim().slice(0, -1).trim()
        : rawAttrs;

      const attrs = attrsPart.match(/\S+="[^"]*"/g) || [];

      const prettyAttrs = attrs.map((a) => `\n${indent}${a}`).join("");

      return `<ConversationRelay${prettyAttrs}${selfClose ? "/>" : ">"}`;
    },
  );

  /* ──────────────────────────────
   * 2. Gather  (new)
   * ────────────────────────────── */
  formatted = formatted.replace(/<Gather\b([^>]*)>/g, (_match, rawAttrs) => {
    const selfClose = rawAttrs.trim().endsWith("/");
    const attrsPart = selfClose
      ? rawAttrs.trim().slice(0, -1).trim()
      : rawAttrs;

    const attrs = attrsPart.match(/\S+="[^"]*"/g) || [];

    // each attr on its own line, prefixed with `indent`
    const prettyAttrs = attrs.map((a) => `\n${indent}${a}`).join("");

    return `<Gather${prettyAttrs}${selfClose ? "/>" : ">"}`;
  });

  /* ──────────────────────────────
   * 3. Insert newline before every “<”
   * ────────────────────────────── */
  formatted = formatted.replace(/</g, "\n<");

  /* ──────────────────────────────
   * 4. Shield CDATA + comments
   * ────────────────────────────── */
  const cdataAndComments: string[] = [];
  let cdataIndex = 0;
  formatted = formatted.replace(
    /(<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->)/g,
    (m) => {
      cdataAndComments.push(m);
      return `###CDATA_COMMENT_${cdataIndex++}###`;
    },
  );

  /* ──────────────────────────────
   * 5. Truncate very long <Parameter …>
   * ────────────────────────────── */
  const parameterValues: string[] = [];
  let valueIndex = 0;
  formatted = formatted.replace(
    /<Parameter[^>]*\svalue="([^"]*)"[^>]*>/g,
    (m, v) => {
      if (v.length > maxParameterValueLength) {
        parameterValues.push(v);
        return m.replace(v, `[TRUNCATED_VALUE_${valueIndex++}]`);
      }
      return m;
    },
  );

  /* ──────────────────────────────
   * 6. Indentation pass
   * ────────────────────────────── */
  let result = "";
  let level = 0;
  for (const rawLine of formatted.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const isClosing = line.startsWith("</");
    const isSelfClosing = line.includes("/>");
    const isOpeningAndClosing =
      !isSelfClosing && line.startsWith("<") && line.includes("</");

    if (isClosing || isOpeningAndClosing) level--;

    result += `${indent.repeat(Math.max(0, level))}${line}\n`;

    if (
      !isClosing &&
      !isSelfClosing &&
      !isOpeningAndClosing &&
      line.startsWith("<")
    ) {
      level++;
    }
  }

  /* ──────────────────────────────
   * 7. Restore truncated values / CDATA
   * ────────────────────────────── */
  result = result.replace(/\[TRUNCATED_VALUE_(\d+)\]/g, (_, i) => {
    const v = parameterValues[+i];
    return `${v.substring(0, maxParameterValueLength)}… (${v.length} chars)`;
  });

  result = result.replace(
    /###CDATA_COMMENT_(\d+)###/g,
    (_, i) => cdataAndComments[+i],
  );

  /* ──────────────────────────────
   * 8. Collapse simple <Say> lines
   *    Turns:
   *      <Say>hello
   *      </Say>
   *    into:
   *      <Say>hello</Say>
   * ────────────────────────────── */
  result = result.replace(
    /<Say>([^<\n]+)\n\s*<\/Say>/g,
    (_m, text) => `<Say>${text.trim()}</Say>`,
  );

  return result.trim();
}

export function redactPhoneNumbers(input: string): string {
  const phoneRegex = /(\+?1[-\s.]?)?\(?(\d{3})\)?[-\s.]?(\d{3})[-\s.]?(\d{4})/g;

  return input.replace(
    phoneRegex,
    (match, countryCode, areaCode, prefix, lastFour) => {
      // Preserve the +1 country code if it exists
      const preservedCountryCode =
        countryCode && countryCode.includes("+") ? countryCode : "";

      // Count how many digits need to be redacted (excluding country code and last four)
      const digitsInAreaCodeAndPrefix = 11; // 3 for area code + 3 for prefix

      // Create bullet points for redacted digits
      const bullets = "•".repeat(digitsInAreaCodeAndPrefix);

      return bullets;

      return `${preservedCountryCode}${bullets}${lastFour}`;
    },
  );
}
