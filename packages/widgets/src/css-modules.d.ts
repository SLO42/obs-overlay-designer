// Widgets don't import CSS modules directly, but typechecking this package
// walks into `@obs/design-system` source (resolved via tsconfig paths),
// which does. This declaration keeps the DS `.module.css` imports happy.
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.css" {
  const content: string;
  export default content;
}
