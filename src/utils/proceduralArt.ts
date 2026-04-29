/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a vibrant, premium gradient based on a string seed.
 */
export function generateProceduralArt(seed: string): string {
  const hash = seed.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const getHue = (offset: number) => Math.abs((hash + offset) % 360);
  
  const h1 = getHue(0);
  const h2 = getHue(120);
  const h3 = getHue(240);

  // Creating a layered radial gradient string
  return `radial-gradient(circle at 20% 20%, hsl(${h1}, 70%, 60%) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, hsl(${h2}, 80%, 50%) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, hsl(${h3}, 60%, 40%) 0%, transparent 100%),
          white`;
}

/**
 * Generates a simplified CSS color for small dots or accents.
 */
export function getAccentColor(seed: string): string {
  const hash = seed.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return `hsl(${Math.abs(hash % 360)}, 70%, 65%)`;
}
