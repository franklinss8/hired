"use client";
import { useEffect, useRef } from "react";

/*
 * GoldScene : décor en couches réactif à la souris.
 * - 3 couches de rubans de verre doré pré-rendues sur des canvas hors écran (dessinées une fois),
 *   puis composées à chaque frame avec un décalage de parallaxe (8 à 25 px) et une légère rotation.
 * - Un halo doré diffus qui suit lentement le pointeur, derrière le contenu.
 * - Une animation ambiante très lente quand le pointeur est immobile.
 * Tout est en pointer-events:none, et prefers-reduced-motion fige le décor.
 */
const LAYERS = [
  // depth : amplitude de parallaxe ; paths : rubans (points de contrôle en fraction de la largeur/hauteur)
  { depth: 10, width: 70, alpha: .55, blur: 14, paths: [[[-.05, .95], [.25, 1.15], [.55, .35], [.4, -.1]], [[1.1, .05], [.8, -.1], [.6, .35], [.9, .6]]] },
  { depth: 18, width: 110, alpha: .85, blur: 8, paths: [[[-.1, .75], [.3, .75], [.15, 1.25], [.55, 1.1]], [[1.15, .25], [.7, .05], [1.05, .55], [.75, .8]]] },
  { depth: 26, width: 46, alpha: 1, blur: 3, paths: [[[-.1, .6], [.1, 1.05], [.35, .6], [.2, 1.2]], [[1.1, .4], [.95, .1], [.7, .35], [1.05, .75]]] },
];

function drawRibbon(ctx, pts, w, h, width, alpha, blur) {
  const P = pts.map(([x, y]) => [x * w, y * h]);
  const path = new Path2D();
  path.moveTo(P[0][0], P[0][1]);
  path.bezierCurveTo(P[1][0], P[1][1], P[2][0], P[2][1], P[3][0], P[3][1]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // halo ambré
  ctx.save(); ctx.filter = `blur(${blur * 3}px)`; ctx.globalAlpha = alpha * .35;
  ctx.strokeStyle = "#b8860b"; ctx.lineWidth = width * 2.2; ctx.stroke(path); ctx.restore();
  // corps du ruban : dégradé or sombre → or clair
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#3a2a05"); g.addColorStop(.25, "#c9961a"); g.addColorStop(.45, "#fff2b0"); g.addColorStop(.6, "#d4a017"); g.addColorStop(.8, "#5a3f08"); g.addColorStop(1, "#f3d35a");
  ctx.save(); ctx.filter = `blur(${blur * .4}px)`; ctx.globalAlpha = alpha;
  ctx.strokeStyle = g; ctx.lineWidth = width; ctx.stroke(path); ctx.restore();
  // ombre interne (bord bas)
  ctx.save(); ctx.globalAlpha = alpha * .5; ctx.translate(0, width * .22);
  ctx.strokeStyle = "rgba(20,12,0,.9)"; ctx.lineWidth = width * .5; ctx.stroke(path); ctx.restore();
  // reflet chrome (bord haut)
  ctx.save(); ctx.globalAlpha = alpha * .9; ctx.translate(0, -width * .28); ctx.filter = `blur(${blur * .3}px)`;
  const hg = ctx.createLinearGradient(0, 0, w, 0);
  hg.addColorStop(0, "rgba(255,255,255,0)"); hg.addColorStop(.4, "rgba(255,250,220,.95)"); hg.addColorStop(.7, "rgba(255,230,120,.6)"); hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = hg; ctx.lineWidth = Math.max(2, width * .12); ctx.stroke(path); ctx.restore();
  // fil lumineux fin
  ctx.save(); ctx.globalAlpha = alpha * .7; ctx.translate(0, -width * .05);
  ctx.strokeStyle = "rgba(255,243,180,.8)"; ctx.lineWidth = 1.2; ctx.stroke(path); ctx.restore();
}

export default function GoldScene({ calm = "center" }) {
  const ref = useRef(null), halo = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, layers = [], raf = 0;
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, hal = { x: .5, y: .5 }, halT = { x: .5, y: .5 };
    let last = performance.now(), idle = 0;

    function build() {
      w = c.width = Math.round(innerWidth * dpr); h = c.height = Math.round(innerHeight * dpr);
      c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px";
      const scale = Math.max(.6, Math.min(1.4, innerWidth / 1440)) * dpr;
      layers = LAYERS.map((L) => {
        const off = document.createElement("canvas");
        off.width = Math.round(w * 1.12); off.height = Math.round(h * 1.12);
        const o = off.getContext("2d");
        o.translate(w * .06, h * .06);
        for (const p of L.paths) drawRibbon(o, p, w, h, L.width * scale, L.alpha, L.blur * dpr);
        return { ...L, off };
      });
    }
    function frame(now) {
      const dt = Math.min(50, now - last); last = now;
      idle += dt;
      const k = 1 - Math.pow(.001, dt / 1000); // inertie douce
      cur.x += (target.x - cur.x) * k * .35; cur.y += (target.y - cur.y) * k * .35;
      hal.x += (halT.x - hal.x) * k * .18; hal.y += (halT.y - hal.y) * k * .18;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const L of layers) {
        const amb = reduce ? 0 : 1;
        const ax = Math.sin(t * .11 + L.depth) * 6 * amb, ay = Math.cos(t * .09 + L.depth * 2) * 5 * amb;
        const dx = cur.x * L.depth + ax, dy = cur.y * L.depth + ay;
        const rot = (cur.x * .6 + Math.sin(t * .07 + L.depth) * .25 * amb) * (Math.PI / 180) * (L.depth / 18);
        ctx.save();
        ctx.translate(w / 2 + dx * dpr, h / 2 + dy * dpr); ctx.rotate(rot); ctx.translate(-w / 2 - w * .06, -h / 2 - h * .06);
        ctx.drawImage(L.off, 0, 0);
        ctx.restore();
      }
      if (halo.current) halo.current.style.transform = `translate(${hal.x * innerWidth - 400}px, ${hal.y * innerHeight - 400}px)`;
      raf = requestAnimationFrame(frame);
    }
    const move = (e) => { idle = 0; target.x = (e.clientX / innerWidth - .5) * 2; target.y = (e.clientY / innerHeight - .5) * 2; halT.x = e.clientX / innerWidth; halT.y = e.clientY / innerHeight; };
    const leave = () => { target.x = 0; target.y = 0; };
    build();
    if (reduce) { frame(performance.now()); cancelAnimationFrame(raf); }
    else { raf = requestAnimationFrame(frame); addEventListener("pointermove", move, { passive: true }); addEventListener("pointerleave", leave); }
    let ro; const onResize = () => { clearTimeout(ro); ro = setTimeout(build, 150); };
    addEventListener("resize", onResize);
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener("visibilitychange", vis);
    return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", move); removeEventListener("pointerleave", leave); removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", vis); };
  }, []);
  return (
    <div className={"scene " + calm} aria-hidden="true">
      <div className="mist" />
      <div className="halo" ref={halo} />
      <canvas ref={ref} className="ribbons" />
      <div className="orbits" />
      <div className="calmzone" />
    </div>
  );
}
