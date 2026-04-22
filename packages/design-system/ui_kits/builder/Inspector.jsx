// StreamTeam builder — Inspector (right rail)

const Inspector = ({ widget, onChange }) => {
  const [tab, setTab] = React.useState('style');
  if (!widget) {
    return (
      <aside className="inspector">
        <div className="inspector-empty">
          <Icon name="layers" size={28}/>
          <div className="empty-title">Nothing selected</div>
          <div className="empty-hint">Click a widget on the canvas<br/>or press <Kbd>⌘K</Kbd> to add</div>
        </div>
      </aside>
    );
  }
  return (
    <aside className="inspector">
      <div className="insp-header">
        <div className={`lane-badge lane-${widget.lane}`}/>
        <input className="insp-name" defaultValue={widget.name}/>
        <IconButton icon="trash" title="Delete ⌫"/>
      </div>
      <div className="insp-tabs">
        {['style','data','triggers','debug'].map(t => (
          <button key={t} className={`insp-tab ${tab===t?'on':''}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="insp-body">
        {tab==='style' && <StyleTab widget={widget}/>}
        {tab==='data'  && <DataTab widget={widget}/>}
        {tab==='triggers' && <TriggerTab widget={widget}/>}
        {tab==='debug' && <DebugTab widget={widget}/>}
      </div>
    </aside>
  );
};

const InspectorField = ({ label, desc, error, children }) => (
  <div className="insp-field">
    <div className="insp-label">{label}</div>
    <div className="insp-control">
      {children}
      {desc && !error && <div className="insp-desc">{desc}</div>}
      {error && <div className="insp-err">{error}</div>}
    </div>
  </div>
);

const NumberField = ({ value, unit }) => (
  <div className="numfield">
    <input defaultValue={value}/>
    {unit && <span className="numunit">{unit}</span>}
  </div>
);
const ColorField = ({ value }) => (
  <div className="colorfield">
    <div className="colorsw" style={{background: value}}/>
    <input defaultValue={value}/>
  </div>
);
const Slider = ({ value, max = 100, unit }) => (
  <div className="slider-row">
    <div className="slider-track">
      <div className="slider-fill" style={{width: `${value/max*100}%`}}/>
      <div className="slider-thumb" style={{left: `calc(${value/max*100}% - 7px)`}}/>
    </div>
    <span className="slider-val">{value}{unit}</span>
  </div>
);
const Switch = ({ on }) => <div className={`switch ${on?'on':''}`}><span/></div>;

const StyleTab = ({ widget }) => (
  <div className="insp-section">
    <div className="section-title">Geometry</div>
    <InspectorField label="Position">
      <div className="xy"><NumberField value={widget.x} unit="x"/><NumberField value={widget.y} unit="y"/></div>
    </InspectorField>
    <InspectorField label="Size">
      <div className="xy"><NumberField value={widget.w} unit="w"/><NumberField value={widget.h} unit="h"/></div>
    </InspectorField>
    <InspectorField label="Opacity" desc="value multiplied against widget's own alpha">
      <Slider value={85} unit="%"/>
    </InspectorField>
    <div className="section-title">Appearance</div>
    <InspectorField label="Tint"><ColorField value="#8B5CF6"/></InspectorField>
    <InspectorField label="Font">
      <select className="select" defaultValue="Inter"><option>Inter</option><option>JetBrains Mono</option><option>Bricolage Grotesque</option></select>
    </InspectorField>
    <InspectorField label="Radius"><Slider value={6} max={24} unit="px"/></InspectorField>
    <InspectorField label="Shadow">
      <div className="seg-group">
        <button className="seg">none</button><button className="seg">sm</button>
        <button className="seg on">md</button><button className="seg">lg</button>
      </div>
    </InspectorField>
  </div>
);
const DataTab = ({ widget }) => (
  <div className="insp-section">
    <div className="section-title">Source</div>
    <InspectorField label="Channel">
      <div className="link-field"><Icon name="twitch" size={12}/><span>@rosenoire</span><span className="link-badge">verified</span></div>
    </InspectorField>
    <InspectorField label="Events">
      <div className="event-list">
        <div className="event-row on"><span className="rdot" style={{background:'#4ade80'}}/>channel.chat.message<Switch on/></div>
        <div className="event-row on"><span className="rdot" style={{background:'#4ade80'}}/>channel.subscribe<Switch on/></div>
        <div className="event-row"><span className="rdot" style={{background:'#4a5162'}}/>channel.cheer<Switch/></div>
      </div>
    </InspectorField>
    <InspectorField label="Cooldown" desc="per-user throttle · ms">
      <NumberField value={1500} unit="ms"/>
    </InspectorField>
  </div>
);
const TriggerTab = ({ widget }) => (
  <div className="insp-section">
    <div className="section-title">When</div>
    <div className="trigger-card">
      <div className="trig-head"><Icon name="zap" size={12}/><span>on message contains</span></div>
      <input className="trig-input" defaultValue="!rose"/>
      <div className="trig-arrow">▾</div>
      <div className="trig-head"><Icon name="sparkle" size={12}/><span>play emote burst</span></div>
      <div className="trig-params">
        <span className="param-k">emote</span><span className="param-v">🌹</span>
        <span className="param-k">count</span><span className="param-v">24</span>
        <span className="param-k">duration</span><span className="param-v">2400ms</span>
      </div>
    </div>
    <button className="add-trigger"><Icon name="plus" size={12}/>Add trigger</button>
  </div>
);
const DebugTab = ({ widget }) => (
  <div className="insp-section">
    <div className="section-title">Live log</div>
    <div className="log">
      <div className="log-row"><span className="log-t">12:04:08.124</span><span className="log-tag ok">RX</span><span className="log-msg">channel.chat.message · @beepbox</span></div>
      <div className="log-row"><span className="log-t">12:04:08.081</span><span className="log-tag ok">RX</span><span className="log-msg">channel.chat.message · @jenny</span></div>
      <div className="log-row"><span className="log-t">12:04:07.950</span><span className="log-tag warn">DELAY</span><span className="log-msg">frame drift 40ms</span></div>
      <div className="log-row"><span className="log-t">12:04:07.210</span><span className="log-tag ok">RX</span><span className="log-msg">channel.subscribe · tier 1</span></div>
      <div className="log-row"><span className="log-t">12:04:06.002</span><span className="log-tag info">SYS</span><span className="log-msg">eventsub connected · 24ms rtt</span></div>
    </div>
  </div>
);

Object.assign(window, { Inspector, InspectorField, NumberField, ColorField, Slider, Switch });
