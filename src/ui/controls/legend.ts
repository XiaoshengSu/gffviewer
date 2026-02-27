// 图例组件
import type { LegendOptions } from '../../types';

/**
 * 图例类
 * 显示特征类型和颜色，支持点击显示/隐藏
 */
export class Legend {
  private container: HTMLElement;
  private options: LegendOptions;
  private items: Map<string, { color: string; visible: boolean; label: string }> = new Map();
  private clickHandlers: Map<string, () => void> = new Map();
  
  constructor(container: HTMLElement, options: Partial<LegendOptions> = {}) {
    this.container = container;
    this.options = {
      visible: true,
      position: 'right',
      orientation: 'vertical',
      ...options
    };
    this.createLegend();
  }
  
  /**
   * 创建图例
   */
  private createLegend(): void {
    this.container.innerHTML = '';
    
    if (!this.options.visible) {
      this.container.style.display = 'none';
      return;
    }
    
    this.container.style.display = 'block';
    this.container.style.padding = '10px';
    this.container.style.backgroundColor = 'var(--background-color, #ffffff)';
    this.container.style.border = '1px solid var(--border-color, #e0e0e0)';
    this.container.style.borderRadius = '4px';
    
    if (this.options.orientation === 'horizontal') {
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'row';
      this.container.style.flexWrap = 'wrap';
      this.container.style.gap = '15px';
    } else {
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'column';
      this.container.style.gap = '8px';
    }
  }
  
  /**
   * 添加图例项
   */
  addItem(id: string, label: string, color: string, visible: boolean = true, onClick?: () => void): void {
    this.items.set(id, { color, visible, label });
    if (onClick) {
      this.clickHandlers.set(id, onClick);
    }
    this.renderItem(id);
  }
  
  /**
   * 渲染图例项
   */
  private renderItem(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    
    const itemElement = document.createElement('div');
    itemElement.id = `legend-item-${id}`;
    itemElement.style.display = 'flex';
    itemElement.style.alignItems = 'center';
    itemElement.style.gap = '8px';
    itemElement.style.cursor = 'pointer';
    
    // 颜色块
    const colorBlock = document.createElement('div');
    colorBlock.style.width = '16px';
    colorBlock.style.height = '16px';
    colorBlock.style.backgroundColor = item.color;
    colorBlock.style.border = '1px solid var(--border-color, #e0e0e0)';
    colorBlock.style.borderRadius = '2px';
    
    // 标签
    const labelElement = document.createElement('span');
    labelElement.textContent = item.label;
    labelElement.style.fontSize = '14px';
    labelElement.style.color = 'var(--text-color, #333333)';
    
    // 添加点击事件
    itemElement.addEventListener('click', () => {
      const onClick = this.clickHandlers.get(id);
      if (onClick) {
        onClick();
      }
    });
    
    itemElement.appendChild(colorBlock);
    itemElement.appendChild(labelElement);
    this.container.appendChild(itemElement);
  }
  
  /**
   * 移除图例项
   */
  removeItem(id: string): void {
    this.items.delete(id);
    this.clickHandlers.delete(id);
    const itemElement = document.getElementById(`legend-item-${id}`);
    if (itemElement) {
      itemElement.remove();
    }
  }
  
  /**
   * 更新图例项
   */
  updateItem(id: string, updates: { label?: string; color?: string; visible?: boolean }): void {
    const item = this.items.get(id);
    if (item) {
      Object.assign(item, updates);
      const itemElement = document.getElementById(`legend-item-${id}`);
      if (itemElement) {
        const colorBlock = itemElement.querySelector('div') as HTMLElement;
        const labelElement = itemElement.querySelector('span') as HTMLElement;
        
        if (updates.color && colorBlock) {
          colorBlock.style.backgroundColor = updates.color;
        }
        if (updates.label && labelElement) {
          labelElement.textContent = updates.label;
        }
      }
    }
  }
  
  /**
   * 显示图例
   */
  show(): void {
    this.options.visible = true;
    this.container.style.display = this.options.orientation === 'horizontal' ? 'flex' : 'flex';
  }
  
  /**
   * 隐藏图例
   */
  hide(): void {
    this.options.visible = false;
    this.container.style.display = 'none';
  }
  
  /**
   * 设置位置
   */
  setPosition(position: 'top' | 'bottom' | 'left' | 'right'): void {
    this.options.position = position;
    // 实际位置需要由父容器控制
  }
  
  /**
   * 设置方向
   */
  setOrientation(orientation: 'horizontal' | 'vertical'): void {
    this.options.orientation = orientation;
    this.createLegend();
    // 重新渲染所有项
    this.items.forEach((_, id) => this.renderItem(id));
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.container.innerHTML = '';
    this.items.clear();
    this.clickHandlers.clear();
  }
}