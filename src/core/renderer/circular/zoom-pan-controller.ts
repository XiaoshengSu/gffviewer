import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import type { PanOffset } from '../../../types';

export class ZoomPanController {
  private centerX: number;
  private centerY: number;
  private width: number;
  private height: number;
  private zoomLevel: number;
  
  constructor(centerX: number, centerY: number, width: number, height: number, zoomLevel: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.width = width;
    this.height = height;
    this.zoomLevel = zoomLevel;
  }
  
  /**
   * 设置Canvas缩放级别
   */
  setCanvasZoomLevel(level: number, point: { x: number; y: number } | undefined, stage: PIXI.Container | undefined): void {
    if (!stage || !stage.children[0]) {
      this.zoomLevel = level;
      return;
    }
    
    const circleContainer = stage.children[0];
    
    if (point) {
      // 以指定点为中心进行缩放
      // 计算缩放前后的坐标转换
      const prevScale = this.zoomLevel;
      const newScale = level;
      
      // 计算鼠标在容器内的相对位置（考虑当前缩放和位置）
      const containerX = point.x - circleContainer.position.x;
      const containerY = point.y - circleContainer.position.y;
      
      // 计算缩放前的世界坐标
      const worldX = containerX / prevScale;
      const worldY = containerY / prevScale;
      
      // 计算缩放后的容器位置，使鼠标点保持在同一屏幕位置
      const newContainerX = point.x - worldX * newScale;
      const newContainerY = point.y - worldY * newScale;
      
      // 更新缩放和位置
      circleContainer.scale.set(newScale);
      circleContainer.position.set(newContainerX, newContainerY);
    } else {
      // 以画布中心为中心进行缩放
      const newScale = level;
      
      // 计算画布中心
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      
      // 计算缩放后的容器位置，使画布中心保持在同一位置
      const newContainerX = centerX - (this.centerX * newScale);
      const newContainerY = centerY - (this.centerY * newScale);
      
      // 更新缩放和位置
      circleContainer.scale.set(newScale);
      circleContainer.position.set(newContainerX, newContainerY);
    }
    
    this.zoomLevel = level;
    // 不需要调用render()，直接修改缩放和位置即可
  }
  
  /**
   * 设置SVG缩放级别
   */
  setSvgZoomLevel(level: number, point: { x: number; y: number } | undefined, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!svgContainer) {
      this.zoomLevel = level;
      return;
    }
    
    const scaleFactor = level / this.zoomLevel;
    
    if (point) {
      // 以指定点为中心进行缩放，只缩放圈图相关的容器，不缩放图例容器及其子元素
      svgContainer.selectAll('g#gridContainer, g#featureContainer, g#labelContainer, g#scaleContainer').each(function() {
        const g = d3.select(this);
        const transform = g.attr('transform') || 'translate(0,0)';
        const match = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        const currentX = match ? parseFloat(match[1]) : 0;
        const currentY = match ? parseFloat(match[2]) : 0;
        
        // 计算新的位置，使鼠标点保持在同一屏幕位置
        const newX = point.x - (point.x - currentX) * scaleFactor;
        const newY = point.y - (point.y - currentY) * scaleFactor;
        
        g.attr('transform', `translate(${newX},${newY}) scale(${level})`);
      });
    } else {
      // 以画布中心为中心进行缩放，只缩放圈图相关的容器，不缩放图例容器及其子元素
      svgContainer.selectAll('g#gridContainer, g#featureContainer, g#labelContainer, g#scaleContainer').each(function() {
        const g = d3.select(this);
        const transform = g.attr('transform') || 'translate(0,0)';
        const match = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        const currentX = match ? parseFloat(match[1]) : 0;
        const currentY = match ? parseFloat(match[2]) : 0;
        
        // 保持当前位置，只应用缩放
        g.attr('transform', `translate(${currentX},${currentY}) scale(${level})`);
      });
    }
    
    this.zoomLevel = level;
    // 不需要调用render()，直接修改缩放和位置即可
  }
  
  /**
   * 设置平移偏移
   */
  setPanOffset(offset: PanOffset, stage: PIXI.Container | undefined, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined, rendererType: string): void {
    if (rendererType === 'canvas') {
      if (stage && stage.children[0]) {
        // 只移动circleContainer（stage的第一个子元素），不移动图例容器
        const circleContainer = stage.children[0];
        // 在当前位置的基础上添加偏移，而不是使用固定的偏移值
        circleContainer.position.x += offset.x;
        circleContainer.position.y += offset.y;
        // 不需要调用render()，直接修改位置即可
      }
    } else if (rendererType === 'svg' && svgContainer) {
      svgContainer.selectAll('g#gridContainer, g#featureContainer, g#labelContainer, g#scaleContainer').each(function() {
        const g = d3.select(this);
        const transform = g.attr('transform') || 'translate(0,0)';
        const match = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        if (match) {
          const x = parseFloat(match[1]) + offset.x;
          const y = parseFloat(match[2]) + offset.y;
          g.attr('transform', `translate(${x},${y})`);
        } else {
          g.attr('transform', `translate(${offset.x},${offset.y})`);
        }
      });
      // 不需要调用render()，直接修改transform即可
    }
  }
  
  /**
   * 更新中心位置
   */
  updatePosition(centerX: number, centerY: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
  }
  
  /**
   * 更新尺寸
   */
  updateSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
  
  /**
   * 获取当前缩放级别
   */
  getZoomLevel(): number {
    return this.zoomLevel;
  }
}
