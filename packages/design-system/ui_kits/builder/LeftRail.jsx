// StreamTeam builder — LeftRail (widget palette)

const WIDGETS = [
  { id: 'chat', icon: 'chat', name: 'Chat Feed', lane: 'chat', count: 1 },
  { id: 'alert', icon: 'gift', name: 'Alert Box', lane: 'alerts', count: 1 },
  { id: 'emote', icon: 'sparkle', name: 'Emote Wall', lane: 'emotes', count: 0 },
  { id: 'redeem', icon: 'zap', name: 'Channel Points', lane: 'points', count: 2 },
  { id: 'keyword', icon: 'search', name: 'Keyword FX', lane: 'events', count: 0 },
  { id: 'camera', icon: 'image', name: 'Camera Frame', lane: 'events', count: 0 },
  { id: 'ticker', icon: 'layers', name: 'Ticker Tape', lane: 'events', count: 0 },
  { id: 'timer', icon: 'settings', name: 'Sub Timer', lane: 'events', count: 0 },
];

const LeftRail = ({ onAdd, activeLane, setActiveLane }) => {
  const lanes = [
    { id: 'all',    label: 'ALL',    color: '#9399ac' },
    { id: 'chat',   label: 'CHAT',   color: '#4ade80' },
    { id: 'alerts', label: 'ALERTS', color: '#ff6b8a' },
    { id: 'emotes', label: 'EMOTES', color: '#f5b95a' },
    { id: 'points', label: 'POINTS', color: '#a78bfa' },
    { id: 'events', label: 'EVENTS', color: '#4da3ff' },
  ];
  const filtered = activeLane === 'all' ? WIDGETS : WIDGETS.filter(w => w.lane === activeLane);
  return (
    <aside className="leftrail">
      <div className="rail-header">
        <span className="rail-title">Widgets</span>
        <span className="rail-count">{filtered.length}</span>
      </div>
      <div className="rail-lanes">
        {lanes.map(l => (
          <button key={l.id} className={`lane-chip ${activeLane===l.id?'on':''}`}
                  onClick={()=>setActiveLane(l.id)}
                  style={{'--lane-color': l.color}}>
            <span className="lane-dot"/>{l.label}
          </button>
        ))}
      </div>
      <div className="rail-search">
        <Icon name="search" size={14}/>
        <input placeholder="Search widgets" />
        <Kbd>/</Kbd>
      </div>
      <div className="widget-list">
        {filtered.map(w => (
          <div key={w.id} className="widget-item" onClick={() => onAdd(w)}>
            <div className={`widget-ico lane-${w.lane}`}>
              <Icon name={w.icon} size={16}/>
            </div>
            <div className="widget-meta">
              <div className="widget-name">{w.name}</div>
              <div className="widget-hint">drag or double-click</div>
            </div>
            {w.count > 0 && <span className="widget-pill">{w.count}</span>}
          </div>
        ))}
      </div>
      <div className="rail-footer">
        <Icon name="plus" size={12}/>
        <span>Add custom widget</span>
      </div>
    </aside>
  );
};

Object.assign(window, { LeftRail, WIDGETS });
