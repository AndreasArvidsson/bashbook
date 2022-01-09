export default interface RenderCommand {
  uri: string;
  data?: string;
  firstCommand: boolean;
  lastCommand: boolean;
}
