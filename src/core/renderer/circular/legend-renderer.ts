import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import type { Genome } from '../../../types';
import { RENDER_CONFIG } from './config';
import { hexToNumber } from './utils';

export class LegendRenderer {
  private width: number;
  
  constructor(width: number) {
    this.width = width;
  }
  
  /**
   * 渲染图例（Canvas）
   */
  renderCanvasLegend(genome: Genome | null, legendContainer: PIXI.Container | undefined): void {
    if (!genome || !legendContainer) return;
    
    legendContainer.removeChildren();
    
    // 计算图例项数量
    const visibleTracks = genome.tracks.filter(track => track.visible);
    const legendItemCount = visibleTracks.length;
    
    // 图例配置
    const itemHeight = RENDER_CONFIG.LEGEND_ITEM_HEIGHT;
    const legendWidth = RENDER_CONFIG.LEGEND_WIDTH;
    
    // 图例位置：右侧，与圈图保持一定距离
    // 动态计算图例位置，确保有足够的空间
    const legendX = Math.min(this.width - 200, this.width - legendWidth - RENDER_CONFIG.LEGEND_MARGIN);
    const legendY = 50;
    
    // 绘制图例拖拽区域（标题栏）
    const dragAreaHeight = 32;
    const contentHeight = 40 + legendItemCount * itemHeight;
    
    // 绘制标题栏
    const graphics = new PIXI.Graphics();
    // 标题栏背景（顶部圆角，底部无圆角）
    graphics.roundRect(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING, legendWidth, dragAreaHeight, 6);
    graphics.fill({ color: 0xf8f9fa }); // 更现代的浅灰色背景
    graphics.setStrokeStyle({ width: 1, color: 0xe9ecef }); // 更柔和的边框颜色
    
    // 绘制内容区域（顶部无圆角，底部圆角）
    graphics.roundRect(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1, legendWidth, contentHeight, 6);
    // 重置顶部圆角为0
    graphics.clear();
    // 重新绘制标题栏（顶部圆角，底部无圆角）
    graphics.beginFill(0xf8f9fa);
    graphics.lineStyle(1, 0xe9ecef);
    graphics.moveTo(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth - 6, legendY - RENDER_CONFIG.LEGEND_PADDING);
    graphics.quadraticCurveTo(legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth, legendY - RENDER_CONFIG.LEGEND_PADDING, legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth, legendY - RENDER_CONFIG.LEGEND_PADDING + 6);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING + 6);
    graphics.quadraticCurveTo(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING, legendX - RENDER_CONFIG.LEGEND_PADDING + 6, legendY - RENDER_CONFIG.LEGEND_PADDING);
    graphics.endFill();
    
    // 绘制内容区域（顶部无圆角，底部圆角）
    graphics.beginFill(0xffffff);
    graphics.lineStyle(1, 0xe9ecef);
    graphics.moveTo(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1 + contentHeight - 6);
    graphics.quadraticCurveTo(legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1 + contentHeight, legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth - 6, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1 + contentHeight);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING + 6, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1 + contentHeight);
    graphics.quadraticCurveTo(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1 + contentHeight, legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1 + contentHeight - 6);
    graphics.lineTo(legendX - RENDER_CONFIG.LEGEND_PADDING, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight - 1);
    graphics.endFill();
    // 添加交互性，使图例可拖拽
    graphics.eventMode = 'dynamic';
    // 移除默认的移动鼠标效果，只有在拖拽时才显示
    
    // 拖拽逻辑
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    graphics.on('pointerdown', (event) => {
      isDragging = true;
      lastX = event.data.global.x;
      lastY = event.data.global.y;
      // 只有在按住鼠标时才显示移动鼠标效果
      graphics.cursor = 'move';
    });
    
    graphics.on('pointermove', (event) => {
      if (isDragging) {
        const deltaX = event.data.global.x - lastX;
        const deltaY = event.data.global.y - lastY;
        lastX = event.data.global.x;
        lastY = event.data.global.y;
        
        // 移动整个图例容器
        if (legendContainer) {
          legendContainer.position.x += deltaX;
          legendContainer.position.y += deltaY;
        }
      }
    });
    
    graphics.on('pointerup', () => {
      isDragging = false;
      // 释放鼠标时恢复默认鼠标效果
      graphics.cursor = 'default';
    });
    
    graphics.on('pointerupoutside', () => {
      isDragging = false;
      // 释放鼠标时恢复默认鼠标效果
      graphics.cursor = 'default';
    });
    
    legendContainer.addChild(graphics);
    
    // 绘制图例标题
    const title = new PIXI.Text({
      text: 'Tracks',
      style: {
        fontSize: 14,
        fontWeight: '600', // 使用600字体权重，比bold更现代
        fill: 0x495057, // 稍浅的文字颜色，更现代
        align: 'center',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' // 使用现代无衬线字体
      }
    });
    title.anchor.set(0.5, 0.5); // 中心锚点
    title.position.set(legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth / 2, legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight / 2); // 居中定位
    legendContainer.addChild(title);
    
    // 绘制所有可见轨道的图例项
    let currentItemIndex = 0;
    genome.tracks.forEach((track) => {
      if (!track.visible) return;
      
      const itemY = legendY + 40 + currentItemIndex * itemHeight;
      
      // 绘制颜色块
      const colorBlock = new PIXI.Graphics();
      colorBlock.rect(legendX, itemY, 20, 15);
      colorBlock.fill({ color: hexToNumber(track.color), alpha: 1 });
      colorBlock.setStrokeStyle({ width: 1, color: 0x333333 });
      legendContainer.addChild(colorBlock);
      
      // 绘制轨道名称
      const trackText = new PIXI.Text({
        text: track.name,
        style: {
          fontSize: 12,
          fill: 0x333333,
          align: 'left'
        }
      });
      trackText.anchor.set(0, 0);
      trackText.position.set(legendX + 30, itemY + 2);
      legendContainer.addChild(trackText);
      
      currentItemIndex++;
    });
  }
  
  /**
   * 渲染图例（SVG）
   */
  renderSvgLegend(genome: Genome | null, svgContainer: d3.Selection<SVGElement, unknown, null, undefined> | undefined): void {
    if (!genome || !svgContainer) return;
    
    const legendContainer = svgContainer.select('g#legendContainer');
    legendContainer.selectAll('*').remove();
    
    // 计算图例项数量
    const visibleTracks = genome.tracks.filter(track => track.visible);
    const legendItemCount = visibleTracks.length;
    
    // 图例配置
    const itemHeight = RENDER_CONFIG.LEGEND_ITEM_HEIGHT;
    const legendWidth = RENDER_CONFIG.LEGEND_WIDTH;
    
    // 图例位置：右侧，与圈图保持一定距离
    // 动态计算图例位置，确保有足够的空间
    const legendX = Math.min(this.width - 200, this.width - legendWidth - RENDER_CONFIG.LEGEND_MARGIN);
    const legendY = 50;
    
    // 绘制图例背景
    const legendGroup = legendContainer.append('g');
    
    // 绘制图例拖拽区域（标题栏）
    const dragAreaHeight = 32;
    legendGroup.append('rect')
      .attr('x', legendX - RENDER_CONFIG.LEGEND_PADDING)
      .attr('y', legendY - RENDER_CONFIG.LEGEND_PADDING)
      .attr('width', legendWidth)
      .attr('height', dragAreaHeight)
      .attr('fill', '#f8f9fa') // 更现代的浅灰色背景
      .attr('fill-opacity', 1)
      .attr('stroke', '#e9ecef') // 更柔和的边框颜色
      .attr('stroke-width', 1)
      .style('cursor', 'move')
      .attr('id', 'legend-drag-area')
      .attr('rx', '6') // 顶部圆角
      .attr('ry', '0') // 底部圆角为0，与内容区域无缝连接
      .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)') // 添加轻微阴影，增强层次感
      .style('transition', 'background-color 0.2s ease'); // 添加过渡效果
    
    // 绘制图例内容区域
    const contentHeight = 40 + legendItemCount * itemHeight; // 更新内容高度计算
    legendGroup.append('rect')
      .attr('x', legendX - RENDER_CONFIG.LEGEND_PADDING)
      .attr('y', legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight)
      .attr('width', legendWidth)
      .attr('height', contentHeight)
      .attr('fill', '#ffffff')
      .attr('fill-opacity', 1)
      .attr('stroke', '#e9ecef')
      .attr('stroke-width', 1)
      .attr('rx', '0') // 内容区域顶部圆角为0，与标题栏无缝连接
      .attr('ry', '6') // 底部保持圆角
      .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)'); // 添加轻微阴影
    
    // 添加交互性，使图例可拖拽（只有按住拖拽区域才能拖拽）
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    const dragArea = legendGroup.select('#legend-drag-area');
    
    dragArea.on('mousedown', (event) => {
      event.stopPropagation(); // 阻止事件冒泡，避免触发SVG容器的mousedown事件
      isDragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    });
    
    legendGroup.on('mousemove', (event) => {
      if (isDragging) {
        event.stopPropagation(); // 阻止事件冒泡，避免触发SVG容器的mousemove事件
        const deltaX = event.clientX - lastX;
        const deltaY = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        
        // 移动整个图例容器
        const transform = legendGroup.attr('transform') || 'translate(0,0)';
        const match = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        if (match) {
          const x = parseFloat(match[1]) + deltaX;
          const y = parseFloat(match[2]) + deltaY;
          legendGroup.attr('transform', `translate(${x},${y})`);
        } else {
          legendGroup.attr('transform', `translate(${deltaX},${deltaY})`);
        }
      }
    });
    
    legendGroup.on('mouseup', () => {
      isDragging = false;
    });
    
    legendGroup.on('mouseupoutside', () => {
      isDragging = false;
    });
    
    // 绘制图例标题
    legendGroup.append('text')
      .text('Tracks')
      .attr('x', legendX - RENDER_CONFIG.LEGEND_PADDING + legendWidth / 2) // 水平居中
      .attr('y', legendY - RENDER_CONFIG.LEGEND_PADDING + dragAreaHeight / 2) // 垂直居中
      .attr('font-size', '14px')
      .attr('font-weight', '600') // 使用600字体权重，比bold更现代
      .attr('fill', '#495057') // 稍浅的文字颜色，更现代
      .attr('text-anchor', 'middle') // 文本水平居中
      .attr('dominant-baseline', 'middle') // 文本垂直居中
      .attr('font-family', 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif') // 使用现代无衬线字体
      .attr('letter-spacing', '0.5px') // 添加轻微的字母间距，提高可读性
      .attr('user-select', 'none'); // 禁止文本选择，提高交互体验
    
    // 绘制所有可见轨道的图例项
    let currentItemIndex = 0;
    genome.tracks.forEach((track) => {
      if (!track.visible) return;
      
      const itemY = legendY + 40 + currentItemIndex * itemHeight; // 增加与标题的间距
      
      // 绘制颜色块
      legendGroup.append('rect')
        .attr('x', legendX)
        .attr('y', itemY)
        .attr('width', 20)
        .attr('height', 15)
        .attr('fill', track.color)
        .attr('stroke', '#333333')
        .attr('stroke-width', 1);
      
      // 绘制轨道名称
      legendGroup.append('text')
        .text(track.name)
        .attr('x', legendX + 30)
        .attr('y', itemY + 12)
        .attr('font-size', '12px')
        .attr('fill', '#333333')
        .attr('text-anchor', 'left');
      
      currentItemIndex++;
    });
  }
  
  /**
   * 更新宽度
   */
  updateWidth(width: number): void {
    this.width = width;
  }
}
