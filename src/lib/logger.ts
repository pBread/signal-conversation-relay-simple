export const log = {
  info: (title: string, ...args: any) =>
    console.info(`${title}`, ...args.map(stringify)),
  error: (title: string, ...args: any) =>
    console.info(`${title}`, ...args.map(stringify)),
  xml: (title: string, xml: string) =>
    console.info(`${title}`, prettyXML(redactPhoneNumbers(xml))),
};

// ========================================
// Helpers
// ========================================
function stringify(item: any) {
  if (typeof item === "object") return JSON.stringify(item);

  return item;
}

export function prettyXML(xml: string): string {
  const maxParameterValueLength = 50;
  const indent = "  ";

  let formatted = xml.replace(/>\s*</g, "><");

  formatted = formatted.replace(
    /<ConversationRelay\b([^>]*)>/g,
    (match, rawAttrs) => {
      // keep track of self-closing syntax (unlikely but just in case)
      const selfClose = rawAttrs.trim().endsWith("/");

      // strip the trailing '/' if present so it doesn’t end up on a new line
      const attrsPart = selfClose
        ? rawAttrs.trim().slice(0, -1).trim()
        : rawAttrs;

      // split attributes safely: <name="value"> where value cannot contain "
      const attrs = attrsPart.match(/\S+="[^"]*"/g) || [];

      // join them, each on its own line starting with a tab
      const prettyAttrs = attrs.map((a) => `\t${a}`).join("\n");

      // rebuild the tag
      return `<ConversationRelay\n${prettyAttrs}\n${selfClose ? "/>" : ">"}`;
    },
  );

  formatted = formatted.replace(/</g, "\n<");

  const cdataAndComments: string[] = [];
  let cdataIndex = 0;
  formatted = formatted.replace(
    /(<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->)/g,
    (match) => {
      cdataAndComments.push(match);
      return `###CDATA_COMMENT_${cdataIndex++}###`;
    },
  );

  //

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

  let result = "";
  let indentLevel = 0;
  const lines = formatted.split("\n");

  for (let line of lines) {
    if (line.trim() === "") continue;

    const isClosingTag = line.indexOf("</") === 0;
    const isSelfClosingTag = line.indexOf("/>") >= 0;
    const isOpeningAndClosingTag =
      !isSelfClosingTag && line.indexOf("<") === 0 && line.indexOf("</") > 0;

    if (isClosingTag || isOpeningAndClosingTag) indentLevel--;

    result += `${indent.repeat(Math.max(0, indentLevel))}${line}\n`;

    if (
      !isClosingTag &&
      !isSelfClosingTag &&
      !isOpeningAndClosingTag &&
      line.indexOf("<") === 0
    ) {
      indentLevel++;
    }
  }

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
      const digitsInAreaCodeAndPrefix = 6; // 3 for area code + 3 for prefix

      // Create bullet points for redacted digits
      const bullets = "•".repeat(digitsInAreaCodeAndPrefix);

      return `${preservedCountryCode}${bullets}${lastFour}`;
    },
  );
}
