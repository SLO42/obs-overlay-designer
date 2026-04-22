// StreamTeam builder — Canvas (the 1920×1080 preview stage)

const CanvasStage = ({ placed, selected, onSelect, zoom }) => {
  return (
    <main className="canvas-region">
      <div className="canvas-chrome-top">
        <span className="mono-readout">1920 × 1080</span>
        <div className="chrome-sep"/>
        <span className="mono-readout dim">16:9</span>
        <div className="chrome-sep"/>
        <span className="mono-readout"><span className="dot-live"/>LIVE PREVIEW · 60FPS</span>
        <div style={{flex: 1}}/>
        <span className="mono-readout dim">ZOOM</span>
        <button className="zoom-btn">−</button>
        <span className="mono-readout">{Math.round(zoom*100)}%</span>
        <button className="zoom-btn">+</button>
        <div className="chrome-sep"/>
        <IconButton icon="grid" title="Toggle grid" active/>
      </div>
      <div className="canvas-viewport">
        <div className="stage-wrapper" style={{transform: `scale(${zoom})`}}>
          <div className="stage">
            {/* Simulated webcam placeholder */}
            <div className="fake-webcam">
              <div className="webcam-inner">
                <div className="cam-ring"/>
                <span className="cam-label">CAM · IN</span>
              </div>
            </div>
            {placed.map((w, i) => (
              <div key={i}
                   className={`placed lane-${w.lane} ${selected===i?'selected':''}`}
                   style={{left: w.x, top: w.y, width: w.w, height: w.h}}
                   onClick={() => onSelect(i)}>
                <div className="placed-head">
                  <Icon name={w.icon} size={12}/>
                  <span>{w.name}</span>
                  <span className="placed-z">z{i+1}</span>
                </div>
                <div className="placed-body">
                  {w.id==='chat' && <ChatPreview/>}
                  {w.id==='alert' && <AlertPreview/>}
                  {w.id==='emote' && <EmotePreview/>}
                  {w.id==='redeem' && <RedeemPreview/>}
                </div>
                {selected===i && <>
                  <span className="handle nw"/><span className="handle ne"/>
                  <span className="handle sw"/><span className="handle se"/>
                </>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="canvas-chrome-bottom">
        <span className="mono-readout"><Icon name="dot" size={8}/>CHAT 48 MSG/S</span>
        <span className="mono-readout"><Icon name="dot" size={8}/>EMOTES 31 POOLED</span>
        <span className="mono-readout"><Icon name="dot" size={8}/>BITS 2 QUEUED</span>
        <div style={{flex: 1}}/>
        <span className="mono-readout dim">OUTPUT · ws://localhost:4567/overlay.html</span>
      </div>
    </main>
  );
};

// Mini-previews rendered inside placed widgets on the canvas
const ChatPreview = () => (
  <div className="mini-chat">
    <div className="msg"><span className="u u-mod">@rosenoire</span> the synth tone is crispy tonight</div>
    <div className="msg"><span className="u u-sub">@beepbox</span> w pog w pog w pog</div>
    <div className="msg"><span className="u">@jennyfromtheip</span> what BPM is this</div>
    <div className="msg new"><span className="u u-mod">@rosenoire</span> 124 baby</div>
  </div>
);
const AlertPreview = () => (
  <div className="mini-alert">
    <div className="alert-ico"><Icon name="gift" size={20}/></div>
    <div className="alert-copy">
      <div className="alert-big">@vaporwave_dad</div>
      <div className="alert-sub">gifted <b>5</b> subs · tier 1</div>
    </div>
  </div>
);
const EmotePreview = () => (
  <div className="mini-emote">
    {['🌹','🎛️','⚡','🔮','💜','🎨','✨'].map((e,i)=>(
      <span key={i} className="em" style={{'--d': `${i*0.1}s`}}>{e}</span>
    ))}
  </div>
);
const RedeemPreview = () => (
  <div className="mini-redeem">
    <div className="redeem-row"><span className="rdot"/>reverse mouse · 500pt</div>
    <div className="redeem-row on"><span className="rdot"/>highlight message · 100pt</div>
  </div>
);

Object.assign(window, { CanvasStage });
