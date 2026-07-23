const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;

function color(code, value) {
  return supportsColor ? `\u001b[${code}m${value}\u001b[0m` : value;
}

export const output = {
  heading(message) {
    console.log(color("1;36", message));
  },
  info(message) {
    console.log(`${color("36", "i")} ${message}`);
  },
  success(message) {
    console.log(`${color("32", "ok")} ${message}`);
  },
  warning(message) {
    console.log(`${color("33", "!")} ${message}`);
  },
  step(message) {
    console.log(`${color("35", ">")} ${message}`);
  }
};
