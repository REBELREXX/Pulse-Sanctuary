/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

export default function Background() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 20,
        y: (e.clientY / window.innerHeight) * 20,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 bg-[#0a0502] overflow-hidden">
      {/* Primary Blob */}
      <motion.div
        animate={{
          x: mousePos.x * 2,
          y: mousePos.y * 2,
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] rounded-full bg-violet-600/20 blur-[120px]"
      />
      
      {/* Secondary Blob */}
      <motion.div
        animate={{
          x: -mousePos.x * 1.5,
          y: -mousePos.y * 1.5,
          scale: [1.1, 1, 1.1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-orange-400/10 blur-[100px]"
      />

      {/* Tertiary Blob (Moving peach accent) */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -50, 100, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[30%] left-[40%] w-[40%] h-[40%] rounded-full bg-purple-500/15 blur-[150px]"
      />
      
      {/* Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
