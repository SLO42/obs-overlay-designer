// StreamTeam builder — 3D Scene (app-start hallway + deploy flip)

const StartScene = ({ onEnter }) => {
  const [stage, setStage] = React.useState('idle'); // idle -> walking -> open
  const begin = () => {
    setStage('walking');
    setTimeout(() => setStage('open'), 1400);
    setTimeout(() => onEnter(), 2300);
  };
  return (
    <div className={`scene scene-${stage}`}>
      <div className="scene-sky"/>
      <div className="scene-floor"/>
      <div className="hallway">
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className={`hall-segment seg-${i}`}>
            <div className="wall left"/>
            <div className="wall right"/>
            <div className="ceiling"/>
            <div className="strip-light"/>
            {i === 2 && <div className="hall-label left-label">CANVAS</div>}
            {i === 3 && <div className="hall-label right-label">EVENTSUB</div>}
            {i === 4 && <div className="hall-label left-label">WIDGETS</div>}
          </div>
        ))}
        <div className="end-door">
          <div className="door-panel left"/>
          <div className="door-panel right"/>
          <div className="door-glow"/>
        </div>
      </div>
      <div className="scene-ui">
        <div className="scene-brand">
          <Logo size={56}/>
          <div className="scene-word">stream<span className="ac">team</span></div>
          <div className="scene-tag">build the crew · ship to obs</div>
        </div>
        <button className="enter-btn" onClick={begin} disabled={stage !== 'idle'}>
          {stage === 'idle' ? <><span>Enter the studio</span><Icon name="chevron" size={14}/></> :
           stage === 'walking' ? 'walking in...' : 'welcome'}
        </button>
        <div className="scene-meta">
          <span className="mono-readout dim">⎯⎯⎯ v1.0 · webgl + css-3d ⎯⎯⎯</span>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { StartScene });
