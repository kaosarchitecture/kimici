export { buildKnowledgePack, type KnowledgePack } from "./knowledge.ts";
export {
  buildChatMessages,
  cfGrokId,
  DEFAULT_XAI_MODEL,
  documentContext,
  extractModelText,
  listXaiModels,
  probeXaiModel,
  runXaiChat,
  selectWorkingXaiModel,
  SYSTEM_PROMPT,
  XAI_CHAT_URL,
  XAI_MODEL,
  xaiChatBody,
} from "./ai.ts";
export { defaultXaiEnvPath, parseXaiEnv, sortGrokNewest, WINDOWS_XAI_ENV } from "./xai-env.ts";
export { ConsentHub } from "./hub.ts";
export {
  DESK_WHERE,
  assertMachineId,
  emptyDesk,
  machineViews,
  onDisconnect,
  onHello,
  onResult,
  onRun,
  publicSnapshot,
  type AgentHello,
  type AgentResultMessage,
  type DeskLine,
  type DeskSnapshot,
  type DeskState,
  type DeskVoucher,
  type HubToAgent,
  type JobRecord,
  type JobStatus,
  type MachineView,
  type OnlineMachine,
} from "./desk.ts";
export { filterRecords, isViewField, sanitizeFields } from "./filter.ts";
export { attestWindowsIdentity, demoWindowsIdentity } from "./windows.ts";
export { documentFromFile, parseUblInvoice, type UploadedDocument } from "./ubl.ts";
export {
  SCOPE_LABELS,
  SCOPES,
  VIEW_FIELDS,
  type ConsentGrant,
  type ConsentMessage,
  type ConsentRequest,
  type HubSnapshot,
  type HubStatus,
  type ScopeId,
  type ViewField,
  type ViewPayload,
  type ViewRecord,
  type WindowsIdentity,
} from "./types.ts";
