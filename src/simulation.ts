import type {
  NetworkNode,
  NetworkLink,
  Packet,
  SimulationStats,
  EventLogItem,
  VisualEffect,
} from './types';

interface PacketInFlight {
  packet: Packet;
  startTime: number;
  fromNode: string;
  toNode: string;
}

export class SimulationEngine {
  private nodes: NetworkNode[] = [];
  private links: NetworkLink[] = [];
  private packetsInFlight: PacketInFlight[] = [];
  private visualEffects: VisualEffect[] = [];
  private eventLog: EventLogItem[] = [];

  private stats: SimulationStats = {
    delivered: 0,
    dropped: 0,
    blockedByFirewall: 0,
    avgLatency: 0,
  };

  private ddosActive = false;
  private autoBalance = false;
  private spawnRate = 10; // packets/sec
  private timeSinceLastSpawn = 0;
  private currentTime = 0;

  private latencySamples: number[] = [];
  private linkLoadMap = new Map<string, number>();
  private lastFirewallBlockTime = 0;
  private lastOverloadTime = 0;

  reset(nodes: NetworkNode[], links: NetworkLink[]): void {
    this.nodes = JSON.parse(JSON.stringify(nodes));
    this.links = JSON.parse(JSON.stringify(links));
    this.packetsInFlight = [];
    this.visualEffects = [];
    this.eventLog = [];
    this.stats = { delivered: 0, dropped: 0, blockedByFirewall: 0, avgLatency: 0 };
    this.latencySamples = [];
    this.linkLoadMap.clear();
    this.timeSinceLastSpawn = 0;
    this.currentTime = 0;
    this.lastFirewallBlockTime = 0;
    this.lastOverloadTime = 0;

    this.addEvent('info', 'Simulation initialized');
  }

  tick(deltaTime: number): void {
    this.currentTime += deltaTime;
    this.timeSinceLastSpawn += deltaTime;

    // Spawn packets
    const spawnInterval = 1000 / this.spawnRate;
    while (this.timeSinceLastSpawn >= spawnInterval) {
      this.spawnPacket();
      this.timeSinceLastSpawn -= spawnInterval;
    }

    // Update packets in flight
    this.updatePackets(deltaTime);

    // Update visual effects
    this.visualEffects = this.visualEffects
      .map(effect => ({ ...effect, ttl: effect.ttl - deltaTime }))
      .filter(effect => effect.ttl > 0);

    // Trim event log
    if (this.eventLog.length > 100) {
      this.eventLog = this.eventLog.slice(-100);
    }
  }

  private spawnPacket(): void {
    const clientNodes = this.nodes.filter(n => n.type === 'client');
    const serverNodes = this.nodes.filter(n => n.type === 'server');

    if (clientNodes.length === 0 || serverNodes.length === 0) return;

    const client = clientNodes[Math.floor(Math.random() * clientNodes.length)];
    const server = serverNodes[Math.floor(Math.random() * serverNodes.length)];

    const outgoingLinks = this.links.filter(l => l.from === client.id && !l.broken);
    if (outgoingLinks.length === 0) return;

    const link = outgoingLinks[0];
    const packetType = this.ddosActive && Math.random() < 0.75 ? 'ddos' : 'normal';

    const packet: Packet = {
      id: `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: packetType,
      linkId: link.id,
      progress: 0,
      targetServerId: server.id,
      trail: [],
    };

    this.packetsInFlight.push({
      packet,
      startTime: this.currentTime,
      fromNode: link.from,
      toNode: link.to,
    });

    this.incrementLinkLoad(link.id);
  }

  private updatePackets(deltaTime: number): void {
    const updatedPackets: PacketInFlight[] = [];

    for (const pif of this.packetsInFlight) {
      const link = this.links.find(l => l.id === pif.packet.linkId);
      if (!link) {
        this.stats.dropped++;
        continue;
      }

      // Check if link broke during flight
      if (link.broken) {
        this.dropPacket(pif);
        continue;
      }

      // Progress packet
      const speed = 1000 / link.latency; // progress per ms
      pif.packet.progress += speed * deltaTime;

      // Update trail
      const fromNode = this.nodes.find(n => n.id === pif.fromNode);
      const toNode = this.nodes.find(n => n.id === pif.toNode);
      if (fromNode && toNode) {
        const x = fromNode.x + (toNode.x - fromNode.x) * pif.packet.progress;
        const y = fromNode.y + (toNode.y - fromNode.y) * pif.packet.progress;
        if (!pif.packet.trail) pif.packet.trail = [];
        pif.packet.trail.push({ x, y });
        if (pif.packet.trail.length > 8) pif.packet.trail.shift();
      }

      // Check if reached destination
      if (pif.packet.progress >= 1.0) {
        this.decrementLinkLoad(link.id);

        const destNode = this.nodes.find(n => n.id === pif.toNode);
        if (!destNode) {
          this.stats.dropped++;
          continue;
        }

        // Firewall check
        if (destNode.type === 'firewall' && destNode.firewallEnabled && pif.packet.type === 'ddos') {
          this.blockPacket(pif);
          continue;
        }

        // Check if reached final server
        if (destNode.type === 'server' && destNode.id === pif.packet.targetServerId) {
          const latency = this.currentTime - pif.startTime;
          this.latencySamples.push(latency);
          if (this.latencySamples.length > 100) this.latencySamples.shift();
          this.stats.avgLatency = this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
          this.stats.delivered++;
          continue;
        }

        // Route to next hop
        const routed = this.routePacket(pif);
        if (routed) {
          updatedPackets.push(routed);
        }
      } else {
        updatedPackets.push(pif);
      }
    }

    this.packetsInFlight = updatedPackets;

    // Check for overloaded links
    if (this.currentTime - this.lastOverloadTime > 2000) {
      for (const [linkId, load] of this.linkLoadMap.entries()) {
        const link = this.links.find(l => l.id === linkId);
        if (link && load / link.capacity > 0.85) {
          this.addEvent('warn', `Link ${linkId} overloaded: ${Math.round(load / link.capacity * 100)}%`);
          this.lastOverloadTime = this.currentTime;
          break;
        }
      }
    }
  }

  private routePacket(pif: PacketInFlight): PacketInFlight | null {
    const currentNode = this.nodes.find(n => n.id === pif.toNode);
    if (!currentNode) return null;

    const outgoingLinks = this.links.filter(l => l.from === currentNode.id && !l.broken);
    if (outgoingLinks.length === 0) {
      this.dropPacket(pif);
      return null;
    }

    let selectedLink: NetworkLink;

    if (this.autoBalance) {
      // Select link with lowest load
      selectedLink = outgoingLinks.reduce((best, link) => {
        const load = this.getLinkLoad(link.id);
        const bestLoad = this.getLinkLoad(best.id);
        return load < bestLoad ? link : best;
      });
    } else {
      selectedLink = outgoingLinks[0];
    }

    // Check capacity
    const currentLoad = this.getLinkLoad(selectedLink.id);
    if (currentLoad >= selectedLink.capacity) {
      this.dropPacket(pif);
      return null;
    }

    this.incrementLinkLoad(selectedLink.id);

    return {
      packet: {
        ...pif.packet,
        linkId: selectedLink.id,
        progress: 0,
        trail: [],
      },
      startTime: pif.startTime,
      fromNode: selectedLink.from,
      toNode: selectedLink.to,
    };
  }

  private dropPacket(pif: PacketInFlight): void {
    this.stats.dropped++;
    const toNode = this.nodes.find(n => n.id === pif.toNode);
    if (toNode) {
      this.addVisualEffect('drop', toNode.x, toNode.y);
    }
  }

  private blockPacket(pif: PacketInFlight): void {
    this.stats.blockedByFirewall++;
    const toNode = this.nodes.find(n => n.id === pif.toNode);
    if (toNode) {
      this.addVisualEffect('block', toNode.x, toNode.y);
    }

    if (this.currentTime - this.lastFirewallBlockTime > 1000) {
      this.addEvent('success', `Firewall ${pif.toNode} blocked DDoS packet`);
      this.lastFirewallBlockTime = this.currentTime;
    }
  }

  private incrementLinkLoad(linkId: string): void {
    const current = this.linkLoadMap.get(linkId) || 0;
    this.linkLoadMap.set(linkId, current + 1);
  }

  private decrementLinkLoad(linkId: string): void {
    const current = this.linkLoadMap.get(linkId) || 0;
    this.linkLoadMap.set(linkId, Math.max(0, current - 1));
  }

  getLinkLoad(linkId: string): number {
    return this.linkLoadMap.get(linkId) || 0;
  }

  private addVisualEffect(kind: VisualEffect['kind'], x: number, y: number): void {
    this.visualEffects.push({
      id: `effect-${Date.now()}-${Math.random()}`,
      kind,
      x,
      y,
      ttl: 500,
    });
  }

  private addEvent(level: EventLogItem['level'], message: string): void {
    this.eventLog.push({
      id: `event-${Date.now()}-${Math.random()}`,
      time: new Date().toLocaleTimeString(),
      level,
      message,
    });
  }

  toggleFirewall(nodeId: string): void {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node && node.type === 'firewall') {
      node.firewallEnabled = !node.firewallEnabled;
      this.addEvent(
        node.firewallEnabled ? 'success' : 'warn',
        `Firewall ${nodeId} ${node.firewallEnabled ? 'enabled' : 'disabled'}`
      );
    }
  }

  toggleLinkBroken(linkId: string): void {
    const link = this.links.find(l => l.id === linkId);
    if (link) {
      link.broken = !link.broken;
      this.addEvent(
        link.broken ? 'danger' : 'info',
        `Link ${linkId} ${link.broken ? 'broken' : 'restored'}`
      );
      if (link.broken) {
        this.linkLoadMap.set(linkId, 0);
      }
    }
  }

  setDdos(active: boolean): void {
    if (this.ddosActive !== active) {
      this.ddosActive = active;
      this.addEvent(active ? 'danger' : 'success', `DDoS attack ${active ? 'started' : 'stopped'}`);
    }
  }

  setAutoBalance(active: boolean): void {
    if (this.autoBalance !== active) {
      this.autoBalance = active;
      this.addEvent('info', `Auto-balance ${active ? 'enabled' : 'disabled'}`);
    }
  }

  setSpawnRate(rate: number): void {
    this.spawnRate = Math.max(1, Math.min(30, rate));
  }

  getNodes(): NetworkNode[] {
    return this.nodes;
  }

  getLinks(): NetworkLink[] {
    return this.links;
  }

  getPackets(): Packet[] {
    return this.packetsInFlight.map(pif => pif.packet);
  }

  getVisualEffects(): VisualEffect[] {
    return this.visualEffects;
  }

  getStats(): SimulationStats {
    return { ...this.stats };
  }

  getEventLog(): EventLogItem[] {
    return [...this.eventLog];
  }
}
