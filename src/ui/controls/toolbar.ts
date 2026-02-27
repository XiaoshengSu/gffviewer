// 工具栏组件
import type { ToolbarOptions, ToolbarItem } from '../../types';

/**
 * 工具栏类
 * 提供视图切换、缩放控制等功能
 */
export class Toolbar {
  private container: HTMLElement;
  private options: ToolbarOptions;
  private items: ToolbarItem[];
  
  constructor(container: HTMLElement, options: Partial<ToolbarOptions> = {}) {
    this.container = container;
    this.options = {
      visible: true,
      position: 'top',
      items: [],
      ...options
    };
    this.items = this.options.items;
    this.createToolbar();
  }
  
  /**
   * 创建工具栏
   */
  private createToolbar(): void {
    this.container.innerHTML = '';
    
    if (!this.options.visible) {
      this.container.style.display = 'none';
      return;
    }
    
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.padding = '10px';
    this.container.style.backgroundColor = 'var(--background-color, #ffffff)';
    this.container.style.borderBottom = '1px solid var(--border-color, #e0e0e0)';
    this.container.style.gap = '10px';
    
    // 添加工具栏项
    this.items.forEach(item => this.addToolbarItem(item));
  }
  
  /**
   * 添加工具栏项
   */
  private addToolbarItem(item: ToolbarItem): void {
    const button = document.createElement('button');
    button.id = item.id;
    button.textContent = item.label;
    button.style.padding = '8px 12px';
    button.style.border = '1px solid var(--border-color, #e0e0e0)';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = 'var(--background-color, #ffffff)';
    button.style.color = 'var(--text-color, #333333)';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.disabled = !item.enabled;
    
    button.addEventListener('click', item.action);
    
    this.container.appendChild(button);
  }
  
  /**
   * 添加工具栏项
   */
  addItem(item: ToolbarItem): void {
    this.items.push(item);
    this.addToolbarItem(item);
  }
  
  /**
   * 移除工具栏项
   */
  removeItem(itemId: string): void {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index > -1) {
      this.items.splice(index, 1);
      const button = document.getElementById(itemId);
      if (button) {
        button.remove();
      }
    }
  }
  
  /**
   * 更新工具栏项
   */
  updateItem(itemId: string, updates: Partial<ToolbarItem>): void {
    const item = this.items.find(item => item.id === itemId);
    if (item) {
      Object.assign(item, updates);
      const button = document.getElementById(itemId);
      if (button) {
        if (updates.label) {
          button.textContent = updates.label;
        }
        if (updates.enabled !== undefined) {
          (button as HTMLButtonElement).disabled = !updates.enabled;
        }
      }
    }
  }
  
  /**
   * 显示工具栏
   */
  show(): void {
    this.options.visible = true;
    this.container.style.display = 'flex';
  }
  
  /**
   * 隐藏工具栏
   */
  hide(): void {
    this.options.visible = false;
    this.container.style.display = 'none';
  }
  
  /**
   * 设置位置
   */
  setPosition(position: 'top' | 'bottom'): void {
    this.options.position = position;
    // 实际位置需要由父容器控制
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}