// UI 系统入口
import { ThemeManager } from './themes';
import { Toolbar } from './controls/toolbar';
import { Legend } from './controls/legend';
import { Sidebar } from './controls/sidebar';
import type { ThemeType, ToolbarOptions, LegendOptions, SidebarOptions } from '../types';

/**
 * UI 管理器
 * 整合所有 UI 组件
 */
export class UIManager {
  private themeManager: ThemeManager;
  private toolbar: Toolbar | null = null;
  private legend: Legend | null = null;
  private sidebar: Sidebar | null = null;
  
  constructor() {
    this.themeManager = new ThemeManager();
  }
  
  /**
   * 初始化工具栏
   */
  initToolbar(container: HTMLElement, options: Partial<ToolbarOptions> = {}): Toolbar {
    this.toolbar = new Toolbar(container, options);
    return this.toolbar;
  }
  
  /**
   * 初始化图例
   */
  initLegend(container: HTMLElement, options: Partial<LegendOptions> = {}): Legend {
    this.legend = new Legend(container, options);
    return this.legend;
  }
  
  /**
   * 初始化侧边栏
   */
  initSidebar(container: HTMLElement, options: Partial<SidebarOptions> = {}): Sidebar {
    this.sidebar = new Sidebar(container, options);
    return this.sidebar;
  }
  
  /**
   * 设置主题
   */
  setTheme(theme: ThemeType): void {
    this.themeManager.setTheme(theme);
  }
  
  /**
   * 获取主题管理器
   */
  getThemeManager(): ThemeManager {
    return this.themeManager;
  }
  
  /**
   * 获取工具栏
   */
  getToolbar(): Toolbar | null {
    return this.toolbar;
  }
  
  /**
   * 获取图例
   */
  getLegend(): Legend | null {
    return this.legend;
  }
  
  /**
   * 获取侧边栏
   */
  getSidebar(): Sidebar | null {
    return this.sidebar;
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.toolbar?.destroy();
    this.legend?.destroy();
    this.sidebar?.destroy();
  }
}

// 导出 UI 组件和管理器
export { ThemeManager, Toolbar, Legend, Sidebar };
export * from './themes';