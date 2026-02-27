import type { Feature, Track } from '../../../types';

/**
 * 将十六进制颜色转换为数字
 */
export function hexToNumber(hex: string | number): number {
  if (typeof hex === 'number') {
    return hex;
  }
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * 创建圆弧路径
 */
export function createArcPath(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number): string {
  const startX1 = cx + Math.cos(startAngle) * outerRadius;
  const startY1 = cy + Math.sin(startAngle) * outerRadius;
  const endX1 = cx + Math.cos(endAngle) * outerRadius;
  const endY1 = cy + Math.sin(endAngle) * outerRadius;
  const startX2 = cx + Math.cos(endAngle) * innerRadius;
  const startY2 = cy + Math.sin(endAngle) * innerRadius;
  const endX2 = cx + Math.cos(startAngle) * innerRadius;
  const endY2 = cy + Math.sin(startAngle) * innerRadius;
  
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  
  return `M ${startX1} ${startY1} ` +
         `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX1} ${endY1} ` +
         `L ${startX2} ${startY2} ` +
         `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endX2} ${endY2} Z`;
}

/**
 * 创建圆环路径
 */
export function createAnnulusPath(cx: number, cy: number, outerRadius: number, innerRadius: number): string {
  return `M ${cx} ${cy - outerRadius} ` +
         `A ${outerRadius} ${outerRadius} 0 1 1 ${cx - 0.1} ${cy - outerRadius} ` +
         `L ${cx - 0.1} ${cy - innerRadius} ` +
         `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius} Z`;
}

/**
 * 检查角度范围是否碰撞
 */
export function checkAngleCollision(currentStart: number, currentEnd: number, labelStart: number, labelEnd: number): boolean {
  // 处理角度环绕的情况
  return (currentStart < labelEnd && currentEnd > labelStart) ||
         (currentStart + 2 * Math.PI < labelEnd && currentEnd + 2 * Math.PI > labelStart);
}

/**
 * 合并GC Skew特征
 */
export function mergeGCSkewFeatures(gcSkewPlusTrack: Track, gcSkewMinusTrack: Track, gcSkewPlusVisible: boolean | undefined, gcSkewMinusVisible: boolean | undefined, zoomLevel: number, lodManager: any): Array<{feature: any, value: number}> {
  const gcSkewFeatures: Array<{feature: any, value: number}> = [];
  
  // 添加GC Skew+特征
  if (gcSkewPlusVisible) {
    const visibleFeatures = lodManager.filterFeatures(gcSkewPlusTrack.features, zoomLevel);
    visibleFeatures.forEach((feature: Feature) => {
      // 添加track信息到feature对象，以便在hover事件中使用
      feature.track = gcSkewPlusTrack;
      const value = parseFloat(feature.attributes.value || '0');
      if (value > 0) {
        gcSkewFeatures.push({ feature, value });
      }
    });
  }
  
  // 添加GC Skew-特征
  if (gcSkewMinusVisible) {
    const visibleFeatures = lodManager.filterFeatures(gcSkewMinusTrack.features, zoomLevel);
    visibleFeatures.forEach((feature: Feature) => {
      // 添加track信息到feature对象，以便在hover事件中使用
      feature.track = gcSkewMinusTrack;
      const value = parseFloat(feature.attributes.value || '0');
      if (value < 0) {
        gcSkewFeatures.push({ feature, value });
      }
    });
  }
  
  // 按位置排序
  return gcSkewFeatures.sort((a, b) => a.feature.start - b.feature.start);
}

/**
 * 检查是否可以渲染标签（无碰撞）
 */
export function canRenderLabel(feature: Feature, genomeLength: number, renderedLabelAngles: { start: number; end: number }[], labelAngleWidth: number): boolean {
  // 计算特征的角度范围
  const featureStartAngle = (feature.start / genomeLength) * Math.PI * 2;
  const featureEndAngle = (feature.end / genomeLength) * Math.PI * 2;
  const featureCenterAngle = (featureStartAngle + featureEndAngle) / 2;
  
  // 计算标签所需的角度空间
  const labelStartAngle = featureCenterAngle - labelAngleWidth / 2;
  const labelEndAngle = featureCenterAngle + labelAngleWidth / 2;
  
  // 检查是否与已渲染的标签碰撞
  const isCollision = renderedLabelAngles.some(label => {
    return checkAngleCollision(labelStartAngle, labelEndAngle, label.start, label.end);
  });
  
  // 如果没有碰撞，记录标签角度范围
  if (!isCollision) {
    renderedLabelAngles.push({ start: labelStartAngle, end: labelEndAngle });
    return true;
  }
  
  return false;
}
