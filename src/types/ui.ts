// UI 类型定义

// 主题类型
export type ThemeType = 'light' | 'dark' | 'high-contrast';

// 主题
export interface Theme {
  name: ThemeType;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  featureColors: {
    [featureType: string]: string;
  };
}

// 侧边栏选项
export interface SidebarOptions {
  visible: boolean;
  width: number;
  collapsible: boolean;
}

// 图例选项
export interface LegendOptions {
  visible: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  orientation: 'horizontal' | 'vertical';
}

// 工具栏选项
export interface ToolbarOptions {
  visible: boolean;
  position: 'top' | 'bottom';
  items: ToolbarItem[];
}

// 工具栏项
export interface ToolbarItem {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  enabled: boolean;
}

// 上下文菜单项
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  enabled: boolean;
  separator?: boolean;
}

// 提示框选项
export interface TooltipOptions {
  visible: boolean;
  position: { x: number; y: number };
  content: string;
  delay: number;
  duration: number;
}

// 对话框选项
export interface DialogOptions {
  visible: boolean;
  title: string;
  content: string;
  width?: number;
  height?: number;
  buttons: DialogButton[];
}

// 对话框按钮
export interface DialogButton {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: () => void;
  enabled: boolean;
}