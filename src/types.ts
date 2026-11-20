export type NodeType = 'client' | 'router' | 'firewall' | 'server';

export interface NetworkNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  firewallEnabled?: boolean;
}

export interface NetworkLink {
  id: string;
  from: string;
  to: string;
  capacity: number; // 5..20 packets
  latency: number; // 10..100 ms
  broken?: boolean;
}

export interface Packet {
  id: string;
  type: 'normal' | 'ddos';
  linkId: string;
  progress: number; // 0..1
  targetServerId: string;
  trail?: Array<{ x: number; y: number }>;
}

export interface SimulationStats {
  delivered: number;
  dropped: number;
  blockedByFirewall: number;
  avgLatency: number;
}

export interface EventLogItem {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'danger' | 'success';
  message: string;
}

export interface VisualEffect {
  id: string;
  kind: 'block' | 'drop' | 'reroute';
  x: number;
  y: number;
  ttl: number; // time to live in ms
}
