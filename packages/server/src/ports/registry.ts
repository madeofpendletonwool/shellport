import { db } from '../db/index.js'
import { registeredPorts } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export interface PortEntry {
  port:         number
  label:        string
  registeredAt: number
}

class PortRegistry {
  private ports = new Map<number, PortEntry>()

  load() {
    const rows = db.select().from(registeredPorts).all()
    for (const row of rows) {
      this.ports.set(row.port, row as PortEntry)
    }
  }

  register(port: number, label: string): PortEntry {
    const entry: PortEntry = { port, label, registeredAt: Math.floor(Date.now() / 1000) }
    db.insert(registeredPorts).values(entry)
      .onConflictDoUpdate({ target: registeredPorts.port, set: { label, registeredAt: entry.registeredAt } })
      .run()
    this.ports.set(port, entry)
    return entry
  }

  unregister(port: number) {
    db.delete(registeredPorts).where(eq(registeredPorts.port, port)).run()
    this.ports.delete(port)
  }

  isRegistered(port: number) {
    return this.ports.has(port)
  }

  list(): PortEntry[] {
    return Array.from(this.ports.values()).sort((a, b) => a.port - b.port)
  }
}

export const portRegistry = new PortRegistry()
