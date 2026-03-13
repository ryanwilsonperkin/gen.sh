export const DEBUG = process.env.DEBUG === "1";

export function debug(msg) {
  if (DEBUG) process.stderr.write(`[gen:debug] ${msg}\n`);
}
