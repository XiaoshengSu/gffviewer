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
   * 格式化数值（添加千分位）
   */
  private formatNumber(num: number): string {
    return num.toLocaleString();
  }

  /**
   * 格式化碱基长度（bp -> kb -> Mb）
   */
  private formatLength(bp: number): string {
    if (bp >= 1_000_000) {
      return (bp / 1_000_000).toFixed(2) + ' Mb';
    } else if (bp >= 1_000) {
      return (bp / 1_000).toFixed(1) + ' kb';
    }
    return bp + ' bp';
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
    
    // 图例配置 - 使用统一的配置参数
    const itemHeight = 46; // 固定高度以适应双行文本
    const legendWidth = RENDER_CONFIG.LEGEND_WIDTH;
    const padding = RENDER_CONFIG.LEGEND_PADDING;
    
    // 图例位置：右侧，与圈图保持一定距离
    const legendX = Math.min(this.width - 200, this.width - legendWidth - RENDER_CONFIG.LEGEND_MARGIN);
    const legendY = 50;
    
    // 绘制图例拖拽区域（标题栏）
    const dragAreaHeight = 36;
    const contentHeight = padding * 2 + legendItemCount * itemHeight; // 增加底部padding
    
    // 绘制背景容器（包含标题栏和内容）
    const container = new PIXI.Graphics();
    
    // 1. 阴影层
    container.roundRect(legendX + 2, legendY + 2, legendWidth, dragAreaHeight + contentHeight, 8);
    container.fill({ color: 0x000000, alpha: 0.1 });
    
    // 2. 主体背景（纯白）
    container.roundRect(legendX, legendY, legendWidth, dragAreaHeight + contentHeight, 8);
    container.fill({ color: 0xffffff });
    container.stroke({ width: 1, color: 0xe9ecef });
    
    // 3. 标题栏背景（浅灰）
    const titleHeader = new PIXI.Graphics();
    titleHeader.roundRect(legendX, legendY, legendWidth, dragAreaHeight, 8); // 先画圆角
    titleHeader.fill({ color: 0xf8f9fa });
    
    // 遮盖底部的圆角，变成直角
    const titleMask = new PIXI.Graphics();
    titleMask.rect(legendX, legendY + dragAreaHeight - 4, legendWidth, 4);
    titleMask.fill({ color: 0xf8f9fa });
    
    // 添加分割线
    const borderLine = new PIXI.Graphics();
    borderLine.moveTo(legendX, legendY + dragAreaHeight);
    borderLine.lineTo(legendX + legendWidth, legendY + dragAreaHeight);
    borderLine.stroke({ width: 1, color: 0xe9ecef });

    container.addChild(titleHeader);
    container.addChild(titleMask);
    container.addChild(borderLine);

    // 添加交互性
    container.eventMode = 'dynamic';
    
    // 拖拽逻辑
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    // 只有标题栏区域响应拖拽
    container.on('pointerdown', (event) => {
      const localPoint = container.toLocal(event.global);
      // 只有点击标题栏区域（高度范围内）才触发拖拽
      if (localPoint.y <= dragAreaHeight) {
        isDragging = true;
        lastX = event.data.global.x;
        lastY = event.data.global.y;
        container.cursor = 'move';
      }
    });
    
    container.on('pointermove', (event) => {
      if (isDragging) {
        const deltaX = event.data.global.x - lastX;
        const deltaY = event.data.global.y - lastY;
        lastX = event.data.global.x;
        lastY = event.data.global.y;
        
        if (legendContainer) {
          legendContainer.position.x += deltaX;
          legendContainer.position.y += deltaY;
        }
      }
    });
    
    container.on('pointerup', () => { isDragging = false; container.cursor = 'default'; });
    container.on('pointerupoutside', () => { isDragging = false; container.cursor = 'default'; });
    
    legendContainer.addChild(container);
    
    // 绘制图例标题
    const title = new PIXI.Text({
      text: 'Genome Features',
      style: {
        fontSize: 13,
        fontWeight: '600',
        fill: 0x343a40,
        fontFamily: 'Inter, system-ui, sans-serif'
      }
    });
    title.anchor.set(0.5, 0.5);
    title.position.set(legendX + legendWidth / 2, legendY + dragAreaHeight / 2);
    legendContainer.addChild(title);
    
    // 绘制图例项
    let currentItemIndex = 0;
    const startY = legendY + dragAreaHeight + padding;
    
    genome.tracks.forEach((track) => {
      if (!track.visible) return;
      
      const itemY = startY + currentItemIndex * itemHeight;
      
      // 1. 绘制颜色指示器（圆形，带边框）
      const colorDot = new PIXI.Graphics();
      const dotRadius = 5;
      const dotX = legendX + padding + dotRadius;
      const dotY = itemY + 8 + dotRadius;
      
      // 绘制外圈边框
      colorDot.circle(dotX, dotY, dotRadius + 1);
      colorDot.fill({ color: 0xe9ecef });
      
      // 绘制内圈颜色
      colorDot.circle(dotX, dotY, dotRadius);
      colorDot.fill({ color: hexToNumber(track.color) });
      
      legendContainer.addChild(colorDot);
      
      // 2. 轨道名称（第一行，加粗）
      const nameText = new PIXI.Text({
        text: track.name,
        style: {
          fontSize: 13,
          fontWeight: '500',
          fill: 0x212529,
          fontFamily: 'Inter, system-ui, sans-serif'
        }
      });
      nameText.position.set(legendX + padding + 18, itemY + 2);
      legendContainer.addChild(nameText);

      // 3. 统计信息（第二行，灰色小字）
      let statsContent = '';
      
      if (track.type === 'gc_content') {
        // GC Content: 计算并显示平均值
        if (track.features.length > 0) {
          const values = track.features.map(feature => parseFloat(feature.attributes?.value || '0'));
          const sum = values.reduce((acc, val) => acc + val, 0);
          const avg = sum / values.length;
          statsContent = `Avg: ${avg.toFixed(1)}%`;
        } else {
          statsContent = 'No data';
        }
      } else if (track.type.includes('gc_skew')) {
        // GC Skew: 计算并显示范围
        if (track.features.length > 0) {
          const values = track.features.map(feature => parseFloat(feature.attributes?.value || '0'));
          const min = Math.min(...values);
          const max = Math.max(...values);
          statsContent = `Range: ${min.toFixed(2)} to ${max.toFixed(2)}`;
        } else {
          statsContent = 'No data';
        }
      } else {
        // 普通特征：显示数量和总长度
        const count = this.formatNumber(track.features.length);
        const totalLen = track.features.reduce((sum, f) => sum + (f.end - f.start), 0);
        statsContent = `${count} items | ${this.formatLength(totalLen)}`;
      }

      const statsText = new PIXI.Text({
        text: statsContent,
        style: {
          fontSize: 11,
          fill: 0x868e96, // 灰色
          fontFamily: 'Inter, system-ui, sans-serif'
        }
      });
      statsText.position.set(legendX + padding + 18, itemY + 20); // 放在名称下方
      legendContainer.addChild(statsText);
      
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
    
    // 图例配置 - 使用与Canvas模式相同的参数
    const itemHeight = 46; // 固定高度以适应双行文本
    const legendWidth = RENDER_CONFIG.LEGEND_WIDTH;
    const padding = RENDER_CONFIG.LEGEND_PADDING;
    
    // 图例位置：右侧，与圈图保持一定距离
    // 动态计算图例位置，确保有足够的空间
    const legendX = Math.min(this.width - 200, this.width - legendWidth - RENDER_CONFIG.LEGEND_MARGIN);
    const legendY = 50;
    
    // 绘制图例背景
    const legendGroup = legendContainer.append('g');
    
    // 绘制图例拖拽区域（标题栏）
    const dragAreaHeight = 36;
    const contentHeight = padding * 2 + legendItemCount * itemHeight; // 增加底部padding
    
    // 绘制阴影（模拟）
    legendGroup.append('rect')
      .attr('x', legendX + 2)
      .attr('y', legendY + 2)
      .attr('width', legendWidth)
      .attr('height', dragAreaHeight + contentHeight)
      .attr('rx', 8)
      .attr('fill', '#000000')
      .attr('fill-opacity', 0.1);

    // 绘制主体背景（纯白）
    legendGroup.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', dragAreaHeight + contentHeight)
      .attr('rx', 8)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e9ecef')
      .attr('stroke-width', 1);

    // 绘制标题栏背景（浅灰）
    // 使用 path 绘制顶部圆角
    const titlePath = `
      M ${legendX} ${legendY + 8}
      Q ${legendX} ${legendY} ${legendX + 8} ${legendY}
      L ${legendX + legendWidth - 8} ${legendY}
      Q ${legendX + legendWidth} ${legendY} ${legendX + legendWidth} ${legendY + 8}
      L ${legendX + legendWidth} ${legendY + dragAreaHeight}
      L ${legendX} ${legendY + dragAreaHeight}
      Z
    `;
    
    legendGroup.append('path')
      .attr('d', titlePath)
      .attr('fill', '#f8f9fa')
      .attr('stroke', 'none')
      .style('cursor', 'move')
      .attr('id', 'legend-drag-area');

    // 分割线
    legendGroup.append('line')
      .attr('x1', legendX)
      .attr('y1', legendY + dragAreaHeight)
      .attr('x2', legendX + legendWidth)
      .attr('y2', legendY + dragAreaHeight)
      .attr('stroke', '#e9ecef')
      .attr('stroke-width', 1);
    
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
      .text('Genome Features')
      .attr('x', legendX + legendWidth / 2) // 水平居中
      .attr('y', legendY + dragAreaHeight / 2) // 垂直居中
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .attr('fill', '#343a40')
      .attr('text-anchor', 'middle') // 文本水平居中
      .attr('dominant-baseline', 'middle') // 文本垂直居中
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('user-select', 'none'); // 禁止文本选择，提高交互体验
    
    // 绘制所有可见轨道的图例项
    let currentItemIndex = 0;
    const startY = legendY + dragAreaHeight + padding;

    genome.tracks.forEach((track) => {
      if (!track.visible) return;
      
      const itemY = startY + currentItemIndex * itemHeight;
      const dotX = legendX + padding + 5;
      const dotY = itemY + 8 + 5;
      
      // 1. 绘制颜色指示器（圆形，带边框）
      // 绘制外圈边框
      legendGroup.append('circle')
        .attr('cx', dotX)
        .attr('cy', dotY)
        .attr('r', 6)
        .attr('fill', '#e9ecef');
      
      // 绘制内圈颜色
      legendGroup.append('circle')
        .attr('cx', dotX)
        .attr('cy', dotY)
        .attr('r', 5)
        .attr('fill', track.color);
      
      // 2. 轨道名称（第一行，加粗）
      legendGroup.append('text')
        .text(track.name)
        .attr('x', legendX + padding + 18)
        .attr('y', itemY + 12)
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('fill', '#212529')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('text-anchor', 'left');
      
      // 3. 统计信息（第二行，灰色小字）
      let statsContent = '';
      if (track.type === 'gc_content') {
        // GC Content: 计算并显示平均值
        if (track.features.length > 0) {
          const values = track.features.map(feature => parseFloat(feature.attributes?.value || '0'));
          const sum = values.reduce((acc, val) => acc + val, 0);
          const avg = sum / values.length;
          statsContent = `Avg: ${avg.toFixed(1)}%`;
        } else {
          statsContent = 'No data';
        }
      } else if (track.type.includes('gc_skew')) {
        // GC Skew: 计算并显示范围
        if (track.features.length > 0) {
          const values = track.features.map(feature => parseFloat(feature.attributes?.value || '0'));
          const min = Math.min(...values);
          const max = Math.max(...values);
          statsContent = `Range: ${min.toFixed(2)} to ${max.toFixed(2)}`;
        } else {
          statsContent = 'No data';
        }
      } else {
        const count = this.formatNumber(track.features.length);
        const totalLen = track.features.reduce((sum, f) => sum + (f.end - f.start), 0);
        statsContent = `${count} items | ${this.formatLength(totalLen)}`;
      }

      legendGroup.append('text')
        .text(statsContent)
        .attr('x', legendX + padding + 18)
        .attr('y', itemY + 28) // 第二行位置
        .attr('font-size', '11px')
        .attr('fill', '#868e96')
        .attr('font-family', 'Inter, system-ui, sans-serif')
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
