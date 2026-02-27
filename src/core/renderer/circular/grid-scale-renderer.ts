import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import type { Genome } from '../../../types';
import { RENDER_CONFIG, COLORS } from './config';

export class GridScaleRenderer {
  private centerX: number;
  private centerY: number;
  private radius: number;
  private gridVisible: boolean = true;
  
  constructor(centerX: number, centerY: number, radius: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
  }
  
  /**
   * 设置参考圆线的显示状态
   */
  setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
  }
  
  /**
   * 获取参考圆线的显示状态
   */
  isGridVisible(): boolean {
    return this.gridVisible;
  }
  
  /**
   * 渲染网格线（Canvas）
   */
  renderCanvasGrid(gridContainer: PIXI.Container | undefined): void {
    if (!gridContainer) return;
    
    gridContainer.removeChildren();
    
    if (this.gridVisible) {
      const graphics = new PIXI.Graphics();
      graphics.setStrokeStyle({ width: 1, color: COLORS.GRID });
      
      // 绘制同心圆
      for (let i = 1; i <= RENDER_CONFIG.GRID_CIRCLES; i++) {
        const r = this.radius * (i / RENDER_CONFIG.GRID_CIRCLES);
        graphics.circle(this.centerX, this.centerY, r);
      }
      
      // 绘制径向线
      for (let i = 0; i < RENDER_CONFIG.GRID_RADIAL_LINES; i++) {
        const angle = (i / RENDER_CONFIG.GRID_RADIAL_LINES) * Math.PI * 2;
        const x1 = this.centerX + Math.cos(angle) * this.radius;
        const y1 = this.centerY + Math.sin(angle) * this.radius;
        graphics.moveTo(this.centerX, this.centerY);
        graphics.lineTo(x1, y1);
      }
      
      gridContainer.addChild(graphics);
    }
  }
  
  /**
   * 渲染网格线（SVG）
   */
  renderSvgGrid(svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!svgContainer) return;
    
    const gridContainer = svgContainer.select('g#gridContainer');
    gridContainer.selectAll('*').remove();
    
    if (this.gridVisible) {
      // 绘制同心圆
      for (let i = 1; i <= RENDER_CONFIG.GRID_CIRCLES; i++) {
        const r = this.radius * (i / RENDER_CONFIG.GRID_CIRCLES);
        gridContainer
          .append('circle')
          .attr('cx', this.centerX)
          .attr('cy', this.centerY)
          .attr('r', r)
          .attr('fill', 'none')
          .attr('stroke', '#e0e0e0')
          .attr('stroke-width', 1);
      }
      
      // 绘制径向线
      for (let i = 0; i < RENDER_CONFIG.GRID_RADIAL_LINES; i++) {
        const angle = (i / RENDER_CONFIG.GRID_RADIAL_LINES) * Math.PI * 2;
        const x1 = this.centerX + Math.cos(angle) * this.radius;
        const y1 = this.centerY + Math.sin(angle) * this.radius;
        gridContainer
          .append('line')
          .attr('x1', this.centerX)
          .attr('y1', this.centerY)
          .attr('x2', x1)
          .attr('y2', y1)
          .attr('stroke', '#e0e0e0')
          .attr('stroke-width', 1);
      }
    }
  }
  
  /**
   * 渲染比例尺（Canvas）
   */
  renderCanvasScale(genome: Genome | null, scaleContainer: PIXI.Container | undefined): void {
    if (!genome || !scaleContainer) return;
    
    scaleContainer.removeChildren();
    
    const genomeLength = genome.length;
    const scaleLength = genomeLength * RENDER_CONFIG.SCALE_LENGTH_RATIO;
    const scaleRadius = this.radius + RENDER_CONFIG.SCALE_RADIUS_OFFSET;
    
    const graphics = new PIXI.Graphics();
    graphics.setStrokeStyle({ width: 2, color: COLORS.BORDER });
    graphics.moveTo(this.centerX, this.centerY - scaleRadius);
    graphics.lineTo(this.centerX + Math.cos(0) * scaleRadius, this.centerY + Math.sin(0) * scaleRadius);
    graphics.lineTo(this.centerX + Math.cos((scaleLength / genomeLength) * Math.PI * 2) * scaleRadius, this.centerY + Math.sin((scaleLength / genomeLength) * Math.PI * 2) * scaleRadius);
    
    // 添加刻度标签
    const text = new PIXI.Text({
      text: `${scaleLength.toLocaleString()} bp`,
      style: {
        fontSize: RENDER_CONFIG.SCALE_FONT_SIZE,
        fill: COLORS.TEXT,
        align: 'center'
      }
    });
    text.anchor.set(0.5);
    text.position.set(this.centerX + 50, this.centerY - scaleRadius - 10);
    
    scaleContainer.addChild(graphics);
    scaleContainer.addChild(text);
  }
  
  /**
   * 渲染比例尺（SVG）
   */
  renderSvgScale(genome: Genome | null, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!genome || !svgContainer) return;
    
    const scaleContainer = svgContainer.select('g#scaleContainer');
    scaleContainer.selectAll('*').remove();
    
    // 不渲染任何内容，保持空容器
  }
  
  /**
   * 更新中心位置和半径
   */
  updatePosition(centerX: number, centerY: number, radius: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
  }
}
