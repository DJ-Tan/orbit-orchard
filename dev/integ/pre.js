(function () {
  window.ORCHARD_DEV = 1;
  var q = new URLSearchParams(location.search);
  try { localStorage.removeItem("orbit-orchard-v2"); } catch (e) {}
  if (q.get("sc")) try { localStorage.setItem("orbit-orchard-v2", JSON.stringify({ settings: { skin: q.get("skin") || "nocturne", unlockAll: true, grid: true, shake: true, reducedMotion: false, colorblind: false, assist: false, master: 0.8, music: 0.6, sfx: 0.8, muted: false }, seenCoach: { all: 1 } })); } catch (e) {}
})();
