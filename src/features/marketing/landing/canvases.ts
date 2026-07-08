// Ambient canvas particle backgrounds, ported from the design source
// (NetworkCanvas drives the hero + demo-modal backdrop, RiseCanvas drives the final CTA).

type Node = { x: number; y: number; vx: number; vy: number; r: number; base: number };

export class NetworkCanvas {
  private ctx: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private mouse = { x: -999, y: -999 };
  private running = true;
  private onMove: (e: MouseEvent) => void;
  private onLeave: () => void;
  private container: HTMLElement | null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    for (let i = 0; i < 140; i++) {
      this.nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.2 + 0.4,
        base: Math.random() * 0.35 + 0.08,
      });
    }

    const loop = () => {
      if (!this.running) return;
      const { ctx, canvas, nodes, mouse } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n) => {
        n.x = (n.x + n.vx + canvas.width) % canvas.width;
        n.y = (n.y + n.vy + canvas.height) % canvas.height;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 80) continue;
          const md = Math.min(Math.hypot(a.x - mouse.x, a.y - mouse.y), Math.hypot(b.x - mouse.x, b.y - mouse.y));
          const boost = md < 120 ? (1 - md / 120) * 0.3 : 0;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(77,130,232,${(1 - d / 80) * 0.06 + boost})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
      nodes.forEach((n) => {
        const md = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        const boost = md < 100 ? (1 - md / 100) * 0.5 : 0;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(77,130,232,${n.base + boost})`;
        ctx.fill();
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    this.container = canvas.parentElement;
    this.onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    this.onLeave = () => { this.mouse = { x: -999, y: -999 }; };
    this.container?.addEventListener('mousemove', this.onMove);
    this.container?.addEventListener('mouseleave', this.onLeave);
  }

  destroy() {
    this.running = false;
    this.container?.removeEventListener('mousemove', this.onMove);
    this.container?.removeEventListener('mouseleave', this.onLeave);
  }
}

type Particle = { x: number; y: number; r: number; vy: number; vx: number; o: number };

export class RiseCanvas {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private running = true;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.5,
        vy: 0.1 + Math.random() * 0.2,
        vx: (Math.random() - 0.5) * 0.05,
        o: 0.04 + Math.random() * 0.11,
      });
    }
    const loop = () => {
      if (!this.running) return;
      const { ctx, canvas, particles } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y -= p.vy;
        p.x += p.vx;
        if (p.y < 0) { p.y = canvas.height; p.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(77,130,232,${p.o})`;
        ctx.fill();
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
  }
}
