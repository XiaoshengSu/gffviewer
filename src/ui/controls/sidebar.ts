// 侧边栏组件
import type { SidebarOptions } from '../../types';

/**
 * 侧边栏类
 * 显示图层控制、颜色配置等选项
 */
export class Sidebar {
  private container: HTMLElement;
  private options: SidebarOptions;
  private isCollapsed: boolean = false;
  private contentContainer: HTMLElement | null = null;
  
  constructor(container: HTMLElement, options: Partial<SidebarOptions> = {}) {
    this.container = container;
    this.options = {
      visible: true,
      width: 250,
      collapsible: true,
      ...options
    };
    this.createSidebar();
  }
  
  /**
   * 创建侧边栏
   */
  private createSidebar(): void {
    this.container.innerHTML = '';
    
    if (!this.options.visible) {
      this.container.style.display = 'none';
      return;
    }
    
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.width = `${this.options.width}px`;
    this.container.style.height = '100%';
    this.container.style.backgroundColor = 'var(--background-color, #ffffff)';
    this.container.style.borderRight = '1px solid var(--border-color, #e0e0e0)';
    this.container.style.boxShadow = '2px 0 5px rgba(0, 0, 0, 0.1)';
    this.container.style.transition = 'width 0.3s ease';
    
    // 创建标题栏
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '15px';
    header.style.borderBottom = '1px solid var(--border-color, #e0e0e0)';
    
    const title = document.createElement('h3');
    title.textContent = '控制面板';
    title.style.margin = '0';
    title.style.fontSize = '16px';
    title.style.color = 'var(--text-color, #333333)';
    
    if (this.options.collapsible) {
      const toggleButton = document.createElement('button');
      toggleButton.textContent = '«';
      toggleButton.style.background = 'none';
      toggleButton.style.border = 'none';
      toggleButton.style.fontSize = '18px';
      toggleButton.style.color = 'var(--text-color, #333333)';
      toggleButton.style.cursor = 'pointer';
      toggleButton.style.padding = '0';
      toggleButton.style.width = '20px';
      toggleButton.style.height = '20px';
      toggleButton.style.display = 'flex';
      toggleButton.style.alignItems = 'center';
      toggleButton.style.justifyContent = 'center';
      
      toggleButton.addEventListener('click', () => this.toggle());
      header.appendChild(toggleButton);
    }
    
    header.appendChild(title);
    this.container.appendChild(header);
    
    // 创建内容容器
    this.contentContainer = document.createElement('div');
    this.contentContainer.style.flex = '1';
    this.contentContainer.style.overflowY = 'auto';
    this.contentContainer.style.padding = '15px';
    this.container.appendChild(this.contentContainer);
  }
  
  /**
   * 切换侧边栏折叠状态
   */
  toggle(): void {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.container.style.width = '50px';
      if (this.contentContainer) {
        this.contentContainer.style.display = 'none';
      }
    } else {
      this.container.style.width = `${this.options.width}px`;
      if (this.contentContainer) {
        this.contentContainer.style.display = 'block';
      }
    }
  }
  
  /**
   * 添加内容
   */
  addContent(element: HTMLElement): void {
    if (this.contentContainer) {
      this.contentContainer.appendChild(element);
    }
  }
  
  /**
   * 清空内容
   */
  clearContent(): void {
    if (this.contentContainer) {
      this.contentContainer.innerHTML = '';
    }
  }
  
  /**
   * 显示侧边栏
   */
  show(): void {
    this.options.visible = true;
    this.container.style.display = 'flex';
  }
  
  /**
   * 隐藏侧边栏
   */
  hide(): void {
    this.options.visible = false;
    this.container.style.display = 'none';
  }
  
  /**
   * 设置宽度
   */
  setWidth(width: number): void {
    this.options.width = width;
    if (!this.isCollapsed) {
      this.container.style.width = `${width}px`;
    }
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}