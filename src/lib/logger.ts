const NS_PAD = 40;

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
  const indent = "  ";

  // squash superfluous whitespace between tags
  let formatted = xml.replace(/>\s*</g, "><");

  /* ───────────────────────────────────
   *  1.  ConversationRelay  (unchanged)
   * ─────────────────────────────────── */
  formatted = formatted.replace(
    /<ConversationRelay\b([^>]*)>/g,
    (match, rawAttrs) => {
      const selfClose = rawAttrs.trim().endsWith("/");
      const attrsPart = selfClose
        ? rawAttrs.trim().slice(0, -1).trim()
        : rawAttrs;

      const attrs = attrsPart.match(/\S+="[^"]*"/g) || [];

      const prettyAttrs = attrs.map((a) => `\t${a}`).join("\n");

      return `<ConversationRelay\n${prettyAttrs}\n${selfClose ? "/>" : ">"}`;
    },
  );

  /* ───────────────────────────────────
   *  2.  Gather  (new)
   *      Produces e.g.
   *      <Gather
   *        action="…"
   *        input="…"
   *        finishOnKey="#"/>
   * ─────────────────────────────────── */
  formatted = formatted.replace(/<Gather\b([^>]*)>/g, (match, rawAttrs) => {
    const selfClose = rawAttrs.trim().endsWith("/");
    const attrsPart = selfClose
      ? rawAttrs.trim().slice(0, -1).trim()
      : rawAttrs;

    const attrs = attrsPart.match(/\S+="[^"]*"/g) || [];

    // Combine the last attribute and "/>" on the same line when self-closing
    const prettyAttrs = attrs
      .map((a, i) => `\t${a}${selfClose && i === attrs.length - 1 ? "/>" : ""}`)
      .join("\n");

    return selfClose
      ? `<Gather\n${prettyAttrs}` // already closed above
      : `<Gather\n${prettyAttrs}\n>`;
  });

  /* ───────────────────────────────────
   *  3.  Re-insert newlines before tags
   * ─────────────────────────────────── */
  formatted = formatted.replace(/</g, "\n<");

  /* ───────────────────────────────────
   *  4.  Handle CDATA / comments
   * ─────────────────────────────────── */
  const cdataAndComments: string[] = [];
  let cdataIndex = 0;
  formatted = formatted.replace(
    /(<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->)/g,
    (match) => {
      cdataAndComments.push(match);
      return `###CDATA_COMMENT_${cdataIndex++}###`;
    },
  );

  /* ───────────────────────────────────
   *  5.  Truncate <Parameter value="…">
   * ─────────────────────────────────── */
  const parameterValues: string[] = [];
  let valueIndex = 0;
  formatted = formatted.replace(
    /<Parameter[^>]*\svalue="([^"]*)"[^>]*>/g,
    (match, value) => {
      if (value.length > maxParameterValueLength) {
        parameterValues.push(value);
        return match.replace(value, `[TRUNCATED_VALUE_${valueIndex++}]`);
      }
      return match;
    },
  );

  /* ───────────────────────────────────
   *  6.  Pretty-print with indentation
   * ─────────────────────────────────── */
  let result = "";
  let indentLevel = 0;
  const lines = formatted.split("\n");

  for (let line of lines) {
    if (line.trim() === "") continue;

    const isClosingTag = line.startsWith("</");
    const isSelfClosingTag = line.includes("/>");
    const isOpeningAndClosingTag =
      !isSelfClosingTag && line.startsWith("<") && line.includes("</");

    if (isClosingTag || isOpeningAndClosingTag) indentLevel--;

    result += `${indent.repeat(Math.max(0, indentLevel))}${line}\n`;

    if (
      !isClosingTag &&
      !isSelfClosingTag &&
      !isOpeningAndClosingTag &&
      line.startsWith("<")
    ) {
      indentLevel++;
    }
  }

  /* ───────────────────────────────────
   *  7.  Restore truncated values / CDATA
   * ─────────────────────────────────── */
  result = result.replace(/\[TRUNCATED_VALUE_(\d+)\]/g, (_, i) => {
    const v = parameterValues[+i];
    return `${v.substring(0, maxParameterValueLength)}… (${v.length} chars)`;
  });

  result = result.replace(/###CDATA_COMMENT_(\d+)###/g, (_, i) => {
    return cdataAndComments[+i];
  });

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
