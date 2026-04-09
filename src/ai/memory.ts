import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJ_ROOT } from "../config";

const MEMORY_FILE = join(PROJ_ROOT, "memory.json");

export interface MemoryEntry {
  fact: string;
  tags?: string[];
  timestamp: string;
}

export class MemoryManager {
  private memories: MemoryEntry[] = [];
  private static instance: MemoryManager;

  private constructor() {
    this.load();
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private load() {
    if (existsSync(MEMORY_FILE)) {
      try {
        const data = readFileSync(MEMORY_FILE, "utf-8");
        this.memories = JSON.parse(data);
      } catch (e) {
        console.error("Failed to load memory.json:", e);
        this.memories = [];
      }
    }
  }

  private save() {
    try {
      writeFileSync(MEMORY_FILE, JSON.stringify(this.memories, null, 2));
    } catch (e) {
      console.error("Failed to save memory.json:", e);
    }
  }

  public memorize(fact: string, tags: string[] = []) {
    this.memories.push({
      fact,
      tags,
      timestamp: new Date().toISOString(),
    });
    this.save();
  }

  public recall(query: string): MemoryEntry[] {
    const q = query.toLowerCase();
    // Simple filter for now: check if query words exist in fact or tags
    const words = q.split(/\s+/).filter(w => w.length > 2);
    
    if (words.length === 0) return this.memories.slice(-5); // Return last 5 if query is empty

    return this.memories.filter(m => {
      const content = (m.fact + " " + (m.tags?.join(" ") || "")).toLowerCase();
      return words.some(word => content.includes(word));
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Return top 10 matches
  }

  public getAll(): MemoryEntry[] {
    return this.memories;
  }
}
