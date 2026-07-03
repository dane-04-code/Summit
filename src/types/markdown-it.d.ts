declare module 'markdown-it' {
  // Loose declaration — we only use the parser/plugin surface dynamically.
  const MarkdownIt: any;
  export default MarkdownIt;
}
