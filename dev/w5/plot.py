import json, sys, math
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
idx = sys.argv[1]
d = json.load(open(f"/data2/tjunheng/Desktop-Materials/test/random-claude-task-1/dev/w5/lv{idx}.json"))
lv = d["lv"]
fig, ax = plt.subplots(figsize=(12, 7.5))
ax.set_xlim(0, 1600); ax.set_ylim(1000, 0); ax.set_aspect("equal"); ax.set_facecolor("#111")
col = {"fertile": "#5c5", "barren": "#888", "sun": "#fa0", "ice": "#aef", "blackhole": "#f0f", "repulsor": "#f33"}
for t in d["trajs"]:
    xs = [p[0] for p in t["pts"]]; ys = [p[1] for p in t["pts"]]
    if t["tag"] == "fan": ax.plot(xs, ys, color="#444", lw=0.5)
for t in d["trajs"]:
    xs = [p[0] for p in t["pts"]]; ys = [p[1] for p in t["pts"]]
    if t["tag"] != "fan": ax.plot(xs, ys, color="#ff0", lw=1)
for i, b in enumerate(lv["bodies"]):
    x, y = d["P0"][i]
    ax.add_patch(plt.Circle((x, y), b["r"], color=col[b["kind"]]))
    if b.get("orbit"):
        o = b["orbit"]
        cx, cy = (d["P0"][o["p"]] if "p" in o else (o["cx"], o["cy"]))
        ax.add_patch(plt.Circle((cx, cy), o["R"], fill=False, ls=":", color="#777"))
    if b.get("shield"):
        ax.add_patch(plt.Circle((x, y), b["r"] + 20, fill=False, color="#0ff"))
    ax.text(x, y, str(i), color="w", ha="center", va="center")
for p in lv.get("portals", []):
    for e in (p["a"], p["b"]): ax.add_patch(plt.Circle(e, 26, fill=False, color="#a6f", lw=2))
for g in lv.get("boosts", []): ax.add_patch(plt.Circle((g["x"], g["y"]), 24, fill=False, color="#0f8", lw=2))
for w in lv.get("winds", []): ax.add_patch(plt.Rectangle((w["x"], w["y"]), w["w"], w["h"], fill=True, alpha=0.15, color="#0af"))
for q in lv.get("pollen", []): ax.add_patch(plt.Circle(q, 20, color="#ff8", alpha=0.6))
ax.plot(*lv["launch"], "w^", ms=10)
ax.set_title(lv["id"] + " " + lv["name"])
plt.savefig(f"/data2/tjunheng/Desktop-Materials/test/random-claude-task-1/dev/w5/lv{idx}.png", dpi=70, bbox_inches="tight")
