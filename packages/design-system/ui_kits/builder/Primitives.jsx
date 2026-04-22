// StreamTeam builder — core primitives as small JSX components
// Exports to window at the end so the main index.html can use them.

const Icon = ({ name, size = 16, className = '', stroke = 1.5 }) => {
  const paths = {
    plus: <path d="M12 5v14M5 12h14"/>,
    x: <path d="M18 6 6 18M6 6l12 12"/>,
    play: <polygon points="5 3 19 12 5 21 5 3"/>,
    pause: <><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></>,
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    zap: <path d="m13 2-10 12h9l-1 8 10-12h-9l1-8z"/>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></>,
    sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>,
    gift: <><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5c1.5 0 4.5 3 4.5 5M16.5 8a2.5 2.5 0 0 0 0-5c-1.5 0-4.5 3-4.5 5"/></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></>,
    layers: <><path d="m12 2 10 6-10 6-10-6 10-6Z"/><path d="m2 14 10 6 10-6"/></>,
    canvas: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    cmd: <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>,
    dot: <circle cx="12" cy="12" r="4" fill="currentColor"/>,
    twitch: <path d="M4 3v13l4 3v-3h4l4-4V3H4Zm2 2h12v8l-3 3h-3l-2 2v-2H6V5Zm6 2v5h2V7h-2Zm-4 0v5h2V7H8Z" fill="currentColor" stroke="none"/>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    undo: <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7"/>,
    redo: <path d="M21 7v6h-6M21 13a9 9 0 1 1-3-7"/>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    deploy: <path d="m5 12 14-7-7 14-2-5-5-2z"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
         className={className}>{paths[name] || paths.dot}</svg>
  );
};

const Logo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M 12 22 Q 10 10, 22 10 Q 36 8, 38 20 Q 40 32, 30 36 Q 18 40, 12 32 Q 8 28, 12 22 Z" fill="#5939b8" opacity="0.85"/>
    <path d="M 16 16 Q 14 6, 26 8 Q 38 10, 36 22 Q 38 34, 26 32 Q 14 30, 16 16 Z" fill="#8b5cf6"/>
    <circle cx="22" cy="16" r="2" fill="#c4b5fd" opacity="0.9"/>
    <path d="M 24 34 Q 24 40, 26 42 Q 28 40, 26 34 Z" fill="#8b5cf6"/>
  </svg>
);

const Kbd = ({ children }) => <span className="kbd">{children}</span>;

const Badge = ({ variant = 'ok', pulse, children }) => (
  <span className={`badge badge-${variant}`}>
    <span className={`dot ${pulse ? 'pulse' : ''}`}></span>{children}
  </span>
);

const Button = ({ variant = 'secondary', icon, kbd, children, onClick }) => (
  <button className={`btn btn-${variant}`} onClick={onClick}>
    {icon && <Icon name={icon} size={14}/>}
    {children}
    {kbd && <Kbd>{kbd}</Kbd>}
  </button>
);

const IconButton = ({ icon, active, onClick, title }) => (
  <button className={`iconbtn ${active ? 'active' : ''}`} title={title} onClick={onClick}>
    <Icon name={icon} size={16}/>
  </button>
);

Object.assign(window, { Icon, Logo, Kbd, Badge, Button, IconButton });
