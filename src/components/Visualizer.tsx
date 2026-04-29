/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  accentColor: string;
}

export default function Visualizer({ isPlaying, accentColor }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Array<{ x: number, y: number, vx: number, vy: number, age: number, color: string }> = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isPlaying) {
        // Emit particles
        if (particles.length < 100) {
          particles.push({
            x: canvas.width / (2 * window.devicePixelRatio),
            y: canvas.height / (2 * window.devicePixelRatio),
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            age: 0,
            color: accentColor
          });
        }
      }

      particles = particles.filter(p => p.age < 100);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.age += 1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, (100 - p.age) / 20, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = (100 - p.age) / 100;
        ctx.fill();
      });

      // Flowing waves
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const time = Date.now() / 1000;
      for (let i = 0; i < canvas.width; i++) {
        const x = i / window.devicePixelRatio;
        const y = (canvas.height / (2 * window.devicePixelRatio)) + 
                  Math.sin(x * 0.05 + time * 2) * (isPlaying ? 30 : 5) +
                  Math.cos(x * 0.1 + time) * (isPlaying ? 20 : 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [isPlaying, accentColor]);

  return (
    <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}
