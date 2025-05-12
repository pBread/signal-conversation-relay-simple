const C = { red: "", clear: "" };

export const log = {
  red: (msg, ...args) => console.log(`${C.red}${msg}${C.clear}`, ...args),
};
