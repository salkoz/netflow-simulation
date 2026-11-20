import { useState, useEffect, useRef } from 'react';
import { SimulationEngine } from './simulation';
import { basicNetwork, enterpriseNetwork } from './presets';
import { NetworkCanvas } from './components/NetworkCanvas';
import { TrafficChart } from './components/TrafficChart';
import type { EventLogItem } from './types';
import './App.css';

type PresetType = 'basic' | 'enterprise';

function App() {
  const [preset, setPreset] = useState<PresetType>('basic');
  const [running, setRunning] = useState(false);
  const [ddosActive, setDdosActive] = useState(false);
  const [autoBalance, setAutoBalance] = useState(false);
  const [spawnRate, setSpawnRate] = useState(10);
  const [demoRunning, setDemoRunning] = useState(false);

  const engineRef = useRef(new SimulationEngine());
  const lastTickRef = useRef(Date.now());
  const [, setForceUpdate] = useState(0);

  const [deliveredHistory, setDeliveredHistory] = useState<number[]>([0]);
  const [droppedHistory, setDroppedHistory] = useState<number[]>([0]);
  const lastStatsRef = useRef({ delivered: 0, dropped: 0 });
  const statsIntervalRef = useRef<number | undefined>(undefined);

  const demoTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const presetData = preset === 'basic' ? basicNetwork : enterpriseNetwork;
    engineRef.current.reset(presetData.nodes, presetData.links);
    setForceUpdate((n: number) => n + 1);
  }, [preset]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const deltaTime = now - lastTickRef.current;
      lastTickRef.current = now;

      engineRef.current.tick(deltaTime);
      setForceUpdate((n: number) => n + 1);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running) return;

    statsIntervalRef.current = window.setInterval(() => {
      const stats = engineRef.current.getStats();
      const deliveredRate = stats.delivered - lastStatsRef.current.delivered;
      const droppedRate = stats.dropped - lastStatsRef.current.dropped;

      lastStatsRef.current = stats;

      setDeliveredHistory(prev => {
        const next = [...prev, deliveredRate];
        return next.length > 60 ? next.slice(-60) : next;
      });

      setDroppedHistory(prev => {
        const next = [...prev, droppedRate];
        return next.length > 60 ? next.slice(-60) : next;
      });
    }, 500);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [running]);

  const handleReset = () => {
    setRunning(false);
    setDdosActive(false);
    setAutoBalance(false);
    setDemoRunning(false);

    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
    }

    const presetData = preset === 'basic' ? basicNetwork : enterpriseNetwork;
    engineRef.current.reset(presetData.nodes, presetData.links);
    engineRef.current.setDdos(false);
    engineRef.current.setAutoBalance(false);

    setDeliveredHistory([0]);
    setDroppedHistory([0]);
    lastStatsRef.current = { delivered: 0, dropped: 0 };

    setForceUpdate((n: number) => n + 1);
  };

  const handleDdosToggle = () => {
    const newState = !ddosActive;
    setDdosActive(newState);
    engineRef.current.setDdos(newState);
  };

  const handleAutoBalanceToggle = () => {
    const newState = !autoBalance;
    setAutoBalance(newState);
    engineRef.current.setAutoBalance(newState);
  };

  const handleSpawnRateChange = (value: number) => {
    setSpawnRate(value);
    engineRef.current.setSpawnRate(value);
  };

  const handleFirewallToggle = (nodeId: string) => {
    engineRef.current.toggleFirewall(nodeId);
    setForceUpdate((n: number) => n + 1);
  };

  const handleLinkToggle = (linkId: string) => {
    engineRef.current.toggleLinkBroken(linkId);
    setForceUpdate((n: number) => n + 1);
  };

  const runDemo = () => {
    handleReset();
    setDemoRunning(true);
    setRunning(true);

    // 0-3s: normal traffic
    setTimeout(() => {
      if (!demoRunning) return;
    }, 3000);

    // 3s: start DDoS + break main link
    setTimeout(() => {
      setDdosActive(true);
      engineRef.current.setDdos(true);

      const links = engineRef.current.getLinks();
      const mainLink = links.find(l => l.id === 'l2' || l.id === 'l3');
      if (mainLink) {
        engineRef.current.toggleLinkBroken(mainLink.id);
      }
      setForceUpdate((n: number) => n + 1);
    }, 3000);

    // 8s: enable firewall and auto-balance
    setTimeout(() => {
      setAutoBalance(true);
      engineRef.current.setAutoBalance(true);

      const nodes = engineRef.current.getNodes();
      nodes.forEach(node => {
        if (node.type === 'firewall' && !node.firewallEnabled) {
          engineRef.current.toggleFirewall(node.id);
        }
      });
      setForceUpdate((n: number) => n + 1);
    }, 8000);

    // 15s: end demo
    demoTimeoutRef.current = window.setTimeout(() => {
      setDemoRunning(false);
    }, 15000);
  };

  const engine = engineRef.current;
  const nodes = engine.getNodes();
  const links = engine.getLinks();
  const packets = engine.getPackets();
  const effects = engine.getVisualEffects();
  const stats = engine.getStats();
  const eventLog = engine.getEventLog();

  const linkLoadMap = new Map<string, number>();
  links.forEach(link => {
    linkLoadMap.set(link.id, engine.getLinkLoad(link.id));
  });

  return (
    <div className="app">
      <header className="header">
        <h1>🌐 NetFlow NOC Simulator</h1>
        <p className="subtitle">Network Traffic, DDoS Defense & Chaos Engineering Dashboard</p>
      </header>

      <div className="main-content">
        <div className="left-panel">
          <div className="control-panel">
            <div className="control-group">
              <label>Network Preset</label>
              <div className="button-group">
                <button
                  className={preset === 'basic' ? 'active' : ''}
                  onClick={() => !running && setPreset('basic')}
                  disabled={running}
                >
                  Basic
                </button>
                <button
                  className={preset === 'enterprise' ? 'active' : ''}
                  onClick={() => !running && setPreset('enterprise')}
                  disabled={running}
                >
                  Enterprise
                </button>
              </div>
            </div>

            <div className="control-group">
              <button
                className={`btn-large ${demoRunning ? 'demo-active' : ''}`}
                onClick={runDemo}
                disabled={demoRunning}
              >
                {demoRunning ? '⏳ Demo Running...' : '▶ Run 15s Demo'}
              </button>
            </div>

            <div className="control-group">
              <div className="button-group">
                <button onClick={() => setRunning(!running)}>
                  {running ? '⏸ Pause' : '▶ Start'}
                </button>
                <button onClick={handleReset}>🔄 Reset</button>
              </div>
            </div>

            <div className="control-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={ddosActive}
                  onChange={handleDdosToggle}
                />
                <span className={ddosActive ? 'danger' : ''}>
                  {ddosActive ? '⚠️ DDoS Attack Active' : 'DDoS Attack'}
                </span>
              </label>
            </div>

            <div className="control-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={autoBalance}
                  onChange={handleAutoBalanceToggle}
                />
                <span className={autoBalance ? 'success' : ''}>
                  {autoBalance ? '✓ Auto-Balance ON' : 'Auto-Balance'}
                </span>
              </label>
            </div>

            <div className="control-group">
              <label>Traffic Intensity: {spawnRate} pkt/s</label>
              <input
                type="range"
                min="1"
                max="30"
                value={spawnRate}
                onChange={(e) => handleSpawnRateChange(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="stats-panel">
            <div className="stat-card success">
              <div className="stat-value">{stats.delivered}</div>
              <div className="stat-label">Delivered</div>
            </div>
            <div className="stat-card danger">
              <div className="stat-value">{stats.dropped}</div>
              <div className="stat-label">Dropped</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-value">{stats.blockedByFirewall}</div>
              <div className="stat-label">Blocked by FW</div>
            </div>
            <div className="stat-card info">
              <div className="stat-value">{Math.round(stats.avgLatency)}</div>
              <div className="stat-label">Avg Latency (ms)</div>
            </div>
          </div>

          <div className="chart-panel">
            <h3>Traffic Telemetry</h3>
            <TrafficChart
              deliveredHistory={deliveredHistory}
              droppedHistory={droppedHistory}
            />
          </div>
        </div>

        <div className="right-panel">
          <div className="canvas-panel">
            <NetworkCanvas
              nodes={nodes}
              links={links}
              packets={packets}
              effects={effects}
              linkLoads={linkLoadMap}
              onFirewallToggle={handleFirewallToggle}
              onLinkToggle={handleLinkToggle}
            />
            <div className="canvas-hint">
              💡 Click firewall nodes to toggle protection | Click links to break/restore cables
            </div>
          </div>

          <div className="log-panel">
            <h3>Event Log</h3>
            <div className="log-scroll">
              {eventLog.slice().reverse().map((event: EventLogItem) => (
                <div key={event.id} className={`log-entry ${event.level}`}>
                  <span className="log-time">{event.time}</span>
                  <span className="log-message">{event.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
