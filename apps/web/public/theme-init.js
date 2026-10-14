// Runs before first paint so the page never flashes the wrong theme. Kept external so the
// Content-Security-Policy can stay at script-src 'self'.
try {
  var t = localStorage.getItem("exo-theme");
  var dark = t === "dark" || ((!t || t === "system") && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.mode = dark ? "dark" : "light";
} catch {
  document.documentElement.dataset.mode = "light";
}
