// 主题系统
import type { Theme, ThemeType } from '../../types';
import { lightTheme } from './light';
import { darkTheme } from './dark';

/**
 * 主题管理器
 * 负责主题的管理和切换
 */
export class ThemeManager {
  private themes: Map<ThemeType, Theme> = new Map();
  private currentTheme: Theme;
  
  constructor() {
    // 注册默认主题
    this.themes.set('light', lightTheme);
    this.themes.set('dark', darkTheme);
    
    // 设置默认主题
    this.currentTheme = lightTheme;
  }
  
  /**
   * 设置主题
   */
  setTheme(theme: ThemeType): void {
    const selectedTheme = this.themes.get(theme);
    if (selectedTheme) {
      this.currentTheme = selectedTheme;
      this.applyTheme();
    }
  }
  
  /**
   * 获取当前主题
   */
  getTheme(): Theme {
    return this.currentTheme;
  }
  
  /**
   * 注册自定义主题
   */
  registerTheme(theme: Theme): void {
    this.themes.set(theme.name, theme);
  }
  
  /**
   * 获取所有可用主题
   */
  getThemes(): Theme[] {
    return Array.from(this.themes.values());
  }
  
  /**
   * 应用主题
   */
  private applyTheme(): void {
    // 设置 CSS 变量
    document.documentElement.style.setProperty('--background-color', this.currentTheme.backgroundColor);
    document.documentElement.style.setProperty('--text-color', this.currentTheme.textColor);
    document.documentElement.style.setProperty('--border-color', this.currentTheme.borderColor);
    document.documentElement.style.setProperty('--primary-color', this.currentTheme.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', this.currentTheme.secondaryColor);
    document.documentElement.style.setProperty('--accent-color', this.currentTheme.accentColor);
    
    // 设置特征颜色
    Object.entries(this.currentTheme.featureColors).forEach(([type, color]) => {
      document.documentElement.style.setProperty(`--feature-${type.toLowerCase()}-color`, color);
    });
  }
}

// 导出主题管理器和默认主题
export { lightTheme, darkTheme };