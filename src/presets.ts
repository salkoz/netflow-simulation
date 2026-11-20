import type { NetworkNode, NetworkLink } from './types';

export interface NetworkPreset {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

// Basic Network: Client -> Firewall -> Primary/Backup Router -> Server
export const basicNetwork: NetworkPreset = {
  nodes: [
    // Client
    { id: 'c1', type: 'client', label: 'Client-1', x: 100, y: 250 },

    // Firewall
    { id: 'fw1', type: 'firewall', label: 'Firewall-1', x: 280, y: 250, firewallEnabled: true },

    // Routers
    { id: 'r1', type: 'router', label: 'Router-Primary', x: 460, y: 180 },
    { id: 'r2', type: 'router', label: 'Router-Backup', x: 460, y: 320 },

    // Server
    { id: 's1', type: 'server', label: 'Server-1', x: 700, y: 250 },
  ],
  links: [
    { id: 'l1', from: 'c1', to: 'fw1', capacity: 15, latency: 20 },
    { id: 'l2', from: 'fw1', to: 'r1', capacity: 12, latency: 30 },
    { id: 'l3', from: 'fw1', to: 'r2', capacity: 10, latency: 40 },
    { id: 'l4', from: 'r1', to: 's1', capacity: 18, latency: 25 },
    { id: 'l5', from: 'r2', to: 's1', capacity: 15, latency: 35 },
  ],
};

// Enterprise Network: 2 Clients -> 2 Firewalls -> 2 Routers (cross-linked) -> 2 Servers
export const enterpriseNetwork: NetworkPreset = {
  nodes: [
    // Clients
    { id: 'c1', type: 'client', label: 'Client-A', x: 80, y: 150 },
    { id: 'c2', type: 'client', label: 'Client-B', x: 80, y: 350 },

    // Firewalls
    { id: 'fw1', type: 'firewall', label: 'Firewall-A', x: 250, y: 150, firewallEnabled: true },
    { id: 'fw2', type: 'firewall', label: 'Firewall-B', x: 250, y: 350, firewallEnabled: true },

    // Routers
    { id: 'r1', type: 'router', label: 'Router-Alpha', x: 450, y: 150 },
    { id: 'r2', type: 'router', label: 'Router-Beta', x: 450, y: 350 },

    // Servers
    { id: 's1', type: 'server', label: 'Server-1', x: 680, y: 150 },
    { id: 's2', type: 'server', label: 'Server-2', x: 680, y: 350 },
  ],
  links: [
    // Client -> Firewall
    { id: 'l1', from: 'c1', to: 'fw1', capacity: 15, latency: 20 },
    { id: 'l2', from: 'c2', to: 'fw2', capacity: 15, latency: 20 },

    // Firewall -> Router (cross-linked)
    { id: 'l3', from: 'fw1', to: 'r1', capacity: 12, latency: 30 },
    { id: 'l4', from: 'fw1', to: 'r2', capacity: 10, latency: 45 },
    { id: 'l5', from: 'fw2', to: 'r1', capacity: 10, latency: 45 },
    { id: 'l6', from: 'fw2', to: 'r2', capacity: 12, latency: 30 },

    // Router -> Server (cross-linked)
    { id: 'l7', from: 'r1', to: 's1', capacity: 18, latency: 25 },
    { id: 'l8', from: 'r1', to: 's2', capacity: 14, latency: 40 },
    { id: 'l9', from: 'r2', to: 's1', capacity: 14, latency: 40 },
    { id: 'l10', from: 'r2', to: 's2', capacity: 18, latency: 25 },
  ],
};
