import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getImageUrl(key: string | null | undefined, type: 'ad' | 'page' = 'ad'): string {
  if (!key || key.includes('undefined')) {
    // Return high-quality placeholders for demo purposes
    if (type === 'ad') {
      return `https://loremflickr.com/400/300/business,advertising,logo?lock=${Math.abs(hashCode(key || 'default'))}`;
    }
    return `https://loremflickr.com/800/600/newspaper,city,finance?lock=${Math.abs(hashCode(key || 'default'))}`;
  }
  
  if (key.startsWith("http")) return key;
  return `/${key.startsWith("/") ? key.slice(1) : key}`;
}

// Simple hash function to keep placeholders consistent for the same key
function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}


