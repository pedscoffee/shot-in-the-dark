export interface Template {
  id: string;
  name: string;
  triggers: string[];
  content: string;
  priority: number;
  category?: string;
}

export type JoinStyle = 'comma_and' | 'comma_or' | 'comma_nor' | 'comma' | 'newline';

export interface DropdownConfig {
  id: string;
  name: string;
  options: string[];
  joinStyle: JoinStyle;
  template: string; // e.g., "Patient reports {selections}."
}

export interface Behavior {
  autoCopyEnabled: boolean;
  autoCopyDelay: number;
  autoClearDelay: number;
  plainTextCopy: boolean;
  sourceLabels: boolean;
}

export interface AppState {
  noteTemplate: string;
  templates: Template[];
  dropdowns: DropdownConfig[];
  behavior: Behavior;
}
