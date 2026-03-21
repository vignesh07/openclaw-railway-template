export function cn(...inputs) {
  return inputs.flat(Infinity).filter(Boolean).join(" ");
}
