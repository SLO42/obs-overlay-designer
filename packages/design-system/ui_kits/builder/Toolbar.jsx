// StreamTeam builder — Toolbar (top bar)

const Toolbar = ({ deployed, onDeploy, tool, setTool, stage, setStage }) => {
  const tools = [
    { id: 'select', icon: 'chevron', label: 'Select' },
    { id: 'canvas', icon: 'canvas', label: 'Canvas' },
    { id: 'layers', icon: 'layers', label: 'Layers' },
    { id: 'triggers', icon: 'zap', label: 'Triggers' },
  ];
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="logo-slot">
          <Logo size={22}/>
          <span className="brand">stream<span className="brand-accent">team</span></span>
        </div>
        <div className="divider-v"/>
        <div className="breadcrumb">
          <span className="crumb-muted">projects</span>
          <Icon name="chevron" size={12}/>
          <span className="crumb">rose-garden-overlay</span>
          <span className="crumb-tag">edited 14s ago</span>
        </div>
      </div>
      <div className="toolbar-center">
        {['builder','preview','deploy'].map(s => (
          <button key={s} className={`stage-tab ${stage===s?'on':''}`} onClick={()=>setStage(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="toolbar-right">
        <Badge variant="ok" pulse>EVENTSUB · 24MS</Badge>
        <div className="divider-v"/>
        <IconButton icon="undo" title="Undo ⌘Z"/>
        <IconButton icon="redo" title="Redo ⇧⌘Z"/>
        <div className="divider-v"/>
        <Button icon="eye">Preview<Kbd>P</Kbd></Button>
        <Button variant="primary" icon="deploy" onClick={onDeploy}>
          {deployed ? 'Re-deploy' : 'Deploy'}<Kbd>⌘↵</Kbd>
        </Button>
      </div>
    </div>
  );
};

Object.assign(window, { Toolbar });
