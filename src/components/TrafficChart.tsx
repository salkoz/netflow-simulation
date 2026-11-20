import { useEffect, useRef } from 'react';

interface TrafficChartProps {
  deliveredHistory: number[];
  droppedHistory: number[];
}

export function TrafficChart({ deliveredHistory, droppedHistory }: TrafficChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 600;
    const height = 180;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Clear
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Find max value
    const maxValue = Math.max(
      ...deliveredHistory,
      ...droppedHistory,
      10
    );

    // Draw delivered line
    if (deliveredHistory.length > 1) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();

      deliveredHistory.forEach((value, index) => {
        const x = padding + (graphWidth / (deliveredHistory.length - 1)) * index;
        const y = height - padding - (value / maxValue) * graphHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // Draw dropped line
    if (droppedHistory.length > 1) {
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 2;
      ctx.beginPath();

      droppedHistory.forEach((value, index) => {
        const x = padding + (graphWidth / (droppedHistory.length - 1)) * index;
        const y = height - padding - (value / maxValue) * graphHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = '#888888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * (5 - i));
      const y = padding + (graphHeight / 5) * i;
      ctx.fillText(value.toString(), padding - 8, y + 4);
    }

    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillText('Time (30s window)', width / 2, height - 8);

    // Legend
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(width - padding - 120, padding + 10, 12, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Delivered/s', width - padding - 100, padding + 20);

    ctx.fillStyle = '#ff3366';
    ctx.fillRect(width - padding - 120, padding + 30, 12, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Dropped/s', width - padding - 100, padding + 40);

  }, [deliveredHistory, droppedHistory]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={180}
      style={{ border: '1px solid #2a3340', borderRadius: '4px' }}
    />
  );
}
