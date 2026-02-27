// LOD (Level of Detail) 管理器
import type { Feature } from '../../types';

/**
 * LOD 级别配置
 */
export interface LODLevel {
  minZoom: number;
  maxZoom: number;
  detailLevel: number;
  showLabels: boolean;
  showFeatures: boolean;
  featureDensity: number; // 每像素显示的特征数量
}

/**
 * LOD 管理器
 * 根据缩放级别调整渲染细节
 */
export class LODManager {
  private levels: LODLevel[];
  
  constructor() {
    // 定义 LOD 级别
    this.levels = [
      {
        minZoom: 0,
        maxZoom: 0.1,
        detailLevel: 1,
        showLabels: false,
        showFeatures: true,
        featureDensity: 0.01
      },
      {
        minZoom: 0.1,
        maxZoom: 0.5,
        detailLevel: 2,
        showLabels: false,
        showFeatures: true,
        featureDensity: 0.05
      },
      {
        minZoom: 0.5,
        maxZoom: 1,
        detailLevel: 3,
        showLabels: true, // 在缩放级别0.5时就开始显示标签
        showFeatures: true,
        featureDensity: 0.1
      },
      {
        minZoom: 1,
        maxZoom: 2,
        detailLevel: 4,
        showLabels: true,
        showFeatures: true,
        featureDensity: 0.5
      },
      {
        minZoom: 2,
        maxZoom: 5,
        detailLevel: 5,
        showLabels: true,
        showFeatures: true,
        featureDensity: 1
      },
      {
        minZoom: 5,
        maxZoom: Infinity,
        detailLevel: 6,
        showLabels: true,
        showFeatures: true,
        featureDensity: 2
      }
    ];
  }
  
  /**
   * 获取当前缩放级别的 LOD 配置
   */
  getLOD(zoomLevel: number): LODLevel {
    for (const level of this.levels) {
      if (zoomLevel >= level.minZoom && zoomLevel < level.maxZoom) {
        return level;
      }
    }
    return this.levels[this.levels.length - 1];
  }
  
  /**
   * 检查特征是否应该渲染
   */
  shouldRenderFeature(_feature: Feature, zoomLevel: number): boolean {
    const lod = this.getLOD(zoomLevel);
    
    if (!lod.showFeatures) {
      return false;
    }
    
    // 移除对特征宽度的限制，确保所有gene都能被渲染
    // 即使是非常短的基因也应该显示
    
    return true;
  }
  
  /**
   * 检查标签是否应该渲染
   */
  shouldRenderLabel(feature: Feature, zoomLevel: number): boolean {
    const lod = this.getLOD(zoomLevel);
    
    if (!lod.showLabels) {
      return false;
    }
    
    // 根据特征长度和缩放级别判断是否渲染标签
    const featureWidth = (feature.end - feature.start) * zoomLevel;
    if (featureWidth < 30) { // 小于 30 像素的特征不渲染标签，降低阈值以显示更多标签
      return false;
    }
    
    return true;
  }
  
  /**
   * 过滤特征，只返回应该渲染的特征
   */
  filterFeatures(features: Feature[], zoomLevel: number): Feature[] {
    return features.filter(feature => this.shouldRenderFeature(feature, zoomLevel));
  }
  
  /**
   * 获取应该渲染标签的特征
   */
  getFeaturesWithLabels(features: Feature[], zoomLevel: number): Feature[] {
    return features.filter(feature => this.shouldRenderLabel(feature, zoomLevel));
  }
  
  /**
   * 添加自定义 LOD 级别
   */
  addLODLevel(level: LODLevel): void {
    this.levels.push(level);
    // 按 minZoom 排序
    this.levels.sort((a, b) => a.minZoom - b.minZoom);
  }
  
  /**
   * 重置 LOD 级别
   */
  resetLODLevels(): void {
    this.levels = [
      {
        minZoom: 0,
        maxZoom: 0.1,
        detailLevel: 1,
        showLabels: false,
        showFeatures: true,
        featureDensity: 0.01
      },
      {
        minZoom: 0.1,
        maxZoom: 0.5,
        detailLevel: 2,
        showLabels: false,
        showFeatures: true,
        featureDensity: 0.05
      },
      {
        minZoom: 0.5,
        maxZoom: 1,
        detailLevel: 3,
        showLabels: true, // 在缩放级别0.5时就开始显示标签
        showFeatures: true,
        featureDensity: 0.1
      },
      {
        minZoom: 1,
        maxZoom: 2,
        detailLevel: 4,
        showLabels: true,
        showFeatures: true,
        featureDensity: 0.5
      },
      {
        minZoom: 2,
        maxZoom: 5,
        detailLevel: 5,
        showLabels: true,
        showFeatures: true,
        featureDensity: 1
      },
      {
        minZoom: 5,
        maxZoom: Infinity,
        detailLevel: 6,
        showLabels: true,
        showFeatures: true,
        featureDensity: 2
      }
    ];
  }
}