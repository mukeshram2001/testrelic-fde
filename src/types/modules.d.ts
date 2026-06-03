// Type declarations for modules without built-in types

declare module 'open' {
  function open(target: string, options?: any): Promise<any>;
  export default open;
}

declare module 'execa' {
  function execa(command: string, options?: any): Promise<any>;
  export { execa };
}
