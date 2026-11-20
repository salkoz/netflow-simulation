import { useEffect, useRef, useState } from 'react';
import type { NetworkNode, NetworkLink, Packet, VisualEffect } from '../types';

interface NetworkCanvasProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  packets: Packet[];
  effects: VisualEffect[];
  linkLoads: Map<string, number>;
  onFirewallToggle: (nodeId: string) => void;
  onLinkToggle: (linkId: string) => void;
}

export function NetworkCanvas({
  nodes,
  links,
  packets,
  effects,
  linkLoads,
  onFirewallToggle,
  onLinkToggle,
}: NetworkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, 800, 500);

      // Draw cyber grid
      ctx.strokeStyle = '#1a2332';
      ctx.lineWidth = 1;
      for (let x = 0; x < 800; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 500);
        ctx.stroke();
      }
      for (let y = 0; y < 500; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(800, y);
        ctx.stroke();
      }

      // Draw links
      for (const link of links) {
        const fromNode = nodes.find(n => n.id === link.from);
        const toNode = nodes.find(n => n.id === link.to);
        if (!fromNode || !toNode) continue;

        const load = linkLoads.get(link.id) || 0;
        const loadRatio = Math.min(1, load / link.capacity);

        // Color based on load
        let color = '#00ff88';
        if (link.broken) {
          color = '#ff3366';
        } else if (loadRatio > 0.85) {
          color = '#ff3366';
        } else if (loadRatio > 0.5) {
          color = '#ffaa33';
        }

        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        if (link.broken) {
          ctx.setLineDash([10, 10]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw load percentage
        const midX = (fromNode.x + toNode.x) / 2;
        const midY = (fromNode.y + toNode.y) / 2;

        if (link.broken) {
          ctx.fillStyle = '#ff3366';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('OFFLINE', midX, midY - 5);
        } else {
          const loadPct = Math.round(loadRatio * 100);
          ctx.fillStyle = loadPct > 85 ? '#ff3366' : '#00ff88';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${loadPct}%`, midX, midY - 5);
        }

        // Highlight on hover
        if (hoveredLink === link.id) {
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.stroke();
        }
      }

      // Draw nodes
      for (const node of nodes) {
        let color = '#4488ff';
        let size = 16;

        switch (node.type) {
          case 'client':
            color = '#00ccff';
            size = 14;
            break;
          case 'firewall':
            color = node.firewallEnabled ? '#00ff88' : '#888888';
            size = 18;
            break;
          case 'router':
            color = '#ff8800';
            size = 16;
            break;
          case 'server':
            color = '#ff00ff';
            size = 18;
            break;
        }

        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size + 8);
        gradient.addColorStop(0, color + '88');
        gradient.addColorStop(1, color + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(node.x - size - 8, node.y - size - 8, (size + 8) * 2, (size + 8) * 2);

        // Node shape
        ctx.fillStyle = color;
        if (node.type === 'firewall') {
          // Shield shape
          ctx.beginPath();
          ctx.moveTo(node.x, node.y - size);
          ctx.lineTo(node.x + size * 0.8, node.y);
          ctx.lineTo(node.x, node.y + size);
          ctx.lineTo(node.x - size * 0.8, node.y);
          ctx.closePath();
          ctx.fill();
        } else if (node.type === 'server') {
          // Hexagon
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = node.x + size * Math.cos(angle);
            const y = node.y + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Highlight on hover
        if (hoveredNode === node.id) {
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + size + 15);
      }

      // Draw packets with trails
      for (const packet of packets) {
        const link = links.find(l => l.id === packet.linkId);
        if (!link) continue;

        const fromNode = nodes.find(n => n.id === link.from);
        const toNode = nodes.find(n => n.id === link.to);
        if (!fromNode || !toNode) continue;

        const x = fromNode.x + (toNode.x - fromNode.x) * packet.progress;
        const y = fromNode.y + (toNode.y - fromNode.y) * packet.progress;

        // Trail
        if (packet.trail && packet.trail.length > 0) {
          ctx.strokeStyle = packet.type === 'ddos' ? '#ff336644' : '#00ccff44';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(packet.trail[0].x, packet.trail[0].y);
          for (let i = 1; i < packet.trail.length; i++) {
            ctx.lineTo(packet.trail[i].x, packet.trail[i].y);
          }
          ctx.stroke();
        }

        // Packet glow
        const pColor = packet.type === 'ddos' ? '#ff3366' : '#00ccff';
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
        gradient.addColorStop(0, pColor);
        gradient.addColorStop(1, pColor + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - 12, y - 12, 24, 24);

        // Packet dot
        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw visual effects
      for (const effect of effects) {
        const alpha = Math.floor((effect.ttl / 500) * 255).toString(16).padStart(2, '0');

        if (effect.kind === 'block') {
          // Shield animation
          ctx.strokeStyle = '#00ff88' + alpha;
          ctx.lineWidth = 3;
          const radius = 20 + (1 - effect.ttl / 500) * 15;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect.kind === 'drop') {
          // X mark
          ctx.strokeStyle = '#ff3366' + alpha;
          ctx.lineWidth = 3;
          const size = 15;
          ctx.beginPath();
          ctx.moveTo(effect.x - size, effect.y - size);
          ctx.lineTo(effect.x + size, effect.y + size);
          ctx.moveTo(effect.x + size, effect.y - size);
          ctx.lineTo(effect.x - size, effect.y + size);
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, links, packets, effects, linkLoads, hoveredNode, hoveredLink]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x: e.clientX, y: e.clientY });

    // Check node hover
    let foundNode = false;
    for (const node of nodes) {
      const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (dist < 20) {
        setHoveredNode(node.id);
        foundNode = true;
        break;
      }
    }
    if (!foundNode) setHoveredNode(null);

    // Check link hover
    let foundLink = false;
    for (const link of links) {
      const fromNode = nodes.find(n => n.id === link.from);
      const toNode = nodes.find(n => n.id === link.to);
      if (!fromNode || !toNode) continue;

      const distToLine = pointToLineDistance(x, y, fromNode.x, fromNode.y, toNode.x, toNode.y);
      if (distToLine < 10) {
        setHoveredLink(link.id);
        foundLink = true;
        break;
      }
    }
    if (!foundLink) setHoveredLink(null);
  };

  const handleClick = () => {
    if (hoveredNode) {
      const node = nodes.find(n => n.id === hoveredNode);
      if (node?.type === 'firewall') {
        onFirewallToggle(hoveredNode);
      }
    } else if (hoveredLink) {
      onLinkToggle(hoveredLink);
    }
  };

  const pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const renderTooltip = () => {
    if (hoveredNode) {
      const node = nodes.find(n => n.id === hoveredNode);
      if (!node) return null;

      return (
        <div
          className="tooltip"
          style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
        >
          <div className="tooltip-title">{node.label}</div>
          <div>Type: {node.type}</div>
          {node.type === 'firewall' && (
            <div>Status: {node.firewallEnabled ? 'ENABLED' : 'DISABLED'}</div>
          )}
          {node.type === 'firewall' && (
            <div className="tooltip-hint">Click to toggle</div>
          )}
        </div>
      );
    }

    if (hoveredLink) {
      const link = links.find(l => l.id === hoveredLink);
      if (!link) return null;

      const load = linkLoads.get(link.id) || 0;
      const loadPct = Math.round((load / link.capacity) * 100);

      return (
        <div
          className="tooltip"
          style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
        >
          <div className="tooltip-title">{link.id}</div>
          <div>Capacity: {link.capacity} pkt</div>
          <div>Latency: {link.latency} ms</div>
          <div>Load: {loadPct}%</div>
          <div>Status: {link.broken ? 'OFFLINE' : 'ONLINE'}</div>
          <div className="tooltip-hint">Click to {link.broken ? 'restore' : 'break'}</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ cursor: hoveredNode || hoveredLink ? 'pointer' : 'default' }}
      />
      {renderTooltip()}
    </div>
  );
}
