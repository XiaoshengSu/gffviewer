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
    
    // 保存当前的 zoomLevel 用于计算
    const prevScale = this.zoomLevel;
    
    if (point) {
      // 以指定点为中心进行缩放，只缩放圈图相关的容器，不缩放图例容器及其子元素
      svgContainer.selectAll('g#gridContainer, g#featureContainer, g#labelContainer, g#scaleContainer').each(function() {
        const g = d3.select(this);
        const transform = g.attr('transform') || 'translate(0,0)';
        const match = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        const currentX = match ? parseFloat(match[1]) : 0;
        const currentY = match ? parseFloat(match[2]) : 0;
        
        // 使用与 Canvas 相同的逻辑：先计算世界坐标，再反算新位移
        // 1. 计算鼠标点在"世界坐标系"（未缩放、未平移）中的位置
        // containerX = point.x - currentX
        // worldX = containerX / prevScale
        const worldX = (point.x - currentX) / prevScale;
        const worldY = (point.y - currentY) / prevScale;
        
        // 2. 计算新的平移量，使得该世界坐标点在新的缩放 level 下依然位于鼠标点 point.x
        // point.x = worldX * level + newX
        // newX = point.x - worldX * level
        const newX = point.x - worldX * level;
        const newY = point.y - worldY * level;
        
        g.attr('transform', `translate(${newX},${newY}) scale(${level})`);
      });
    } else {
      // 以画布中心为中心进行缩放
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      
      svgContainer.selectAll('g#gridContainer, g#featureContainer, g#labelContainer, g#scaleContainer').each(function() {
        const g = d3.select(this);
        const transform = g.attr('transform') || 'translate(0,0)';
        const match = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        const currentX = match ? parseFloat(match[1]) : 0;
        const currentY = match ? parseFloat(match[2]) : 0;
        
        // 1. 计算画布中心在"世界坐标系"中的位置
        const worldCenterX = (centerX - currentX) / prevScale;
        const worldCenterY = (centerY - currentY) / prevScale;
        
        // 2. 反算新位移
        const newX = centerX - worldCenterX * level;
        const newY = centerY - worldCenterY * level;
        
        g.attr('transform', `translate(${newX},${newY}) scale(${level})`);
      });
    }
    
    this.zoomLevel = level;
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
        
        // 解析当前的 translate 和 scale
        let currentX = 0;
        let currentY = 0;
        let currentScale = 1;
        
        const translateMatch = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        if (translateMatch) {
          currentX = parseFloat(translateMatch[1]);
          currentY = parseFloat(translateMatch[2]);
        }
        
        const scaleMatch = transform.match(/scale\(([^\)]+)\)/);
        if (scaleMatch) {
          currentScale = parseFloat(scaleMatch[1]);
        }
        
        // 计算新的位置
        const newX = currentX + offset.x;
        const newY = currentY + offset.y;
        
        // 构建新的 transform 字符串，保留 scale
        if (currentScale !== 1) {
          g.attr('transform', `translate(${newX},${newY}) scale(${currentScale})`);
        } else {
          g.attr('transform', `translate(${newX},${newY})`);
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
