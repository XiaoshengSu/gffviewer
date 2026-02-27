// 空间索引
import type { Feature } from '../../types';

/**
 * 空间索引接口
 */
export interface SpatialIndex {
  insert(feature: Feature): void;
  query(start: number, end: number): Feature[];
  remove(featureId: string): void;
  clear(): void;
}

/**
 * 区间树实现
 * 用于快速查询特定区域内的特征
 */
export class IntervalTree implements SpatialIndex {
  private root: IntervalNode | null = null;
  private features: Map<string, Feature> = new Map();
  
  /**
   * 插入特征
   */
  insert(feature: Feature): void {
    this.features.set(feature.id, feature);
    this.root = this.insertNode(this.root, feature);
  }
  
  /**
   * 插入节点
   */
  private insertNode(node: IntervalNode | null, feature: Feature): IntervalNode {
    if (!node) {
      return new IntervalNode(feature);
    }
    
    const nodeCenter = node.getCenter();
    const featureCenter = (feature.start + feature.end) / 2;
    
    if (featureCenter < nodeCenter) {
      node.left = this.insertNode(node.left, feature);
    } else {
      node.right = this.insertNode(node.right, feature);
    }
    
    node.updateMax();
    return node;
  }
  
  /**
   * 查询特定区域内的特征
   */
  query(start: number, end: number): Feature[] {
    const results: Feature[] = [];
    this.queryNode(this.root, start, end, results);
    return results;
  }
  
  /**
   * 查询节点
   */
  private queryNode(node: IntervalNode | null, start: number, end: number, results: Feature[]): void {
    if (!node) return;
    
    // 检查当前节点是否与查询区间相交
    if (this.intersects(node.feature, start, end)) {
      results.push(node.feature);
    }
    
    // 检查左子树
    if (node.left && node.left.max >= start) {
      this.queryNode(node.left, start, end, results);
    }
    
    // 检查右子树
    if (node.right && node.right.min <= end) {
      this.queryNode(node.right, start, end, results);
    }
  }
  
  /**
   * 检查特征是否与查询区间相交
   */
  private intersects(feature: Feature, start: number, end: number): boolean {
    return feature.end >= start && feature.start <= end;
  }
  
  /**
   * 移除特征
   */
  remove(featureId: string): void {
    const feature = this.features.get(featureId);
    if (feature) {
      this.features.delete(featureId);
      this.root = this.removeNode(this.root, feature);
    }
  }
  
  /**
   * 移除节点
   */
  private removeNode(node: IntervalNode | null, feature: Feature): IntervalNode | null {
    if (!node) return null;
    
    const nodeCenter = node.getCenter();
    const featureCenter = (feature.start + feature.end) / 2;
    
    if (node.feature.id === feature.id) {
      // 找到要删除的节点
      if (!node.left && !node.right) {
        // 叶子节点
        return null;
      } else if (!node.left) {
        // 只有右子树
        return node.right;
      } else if (!node.right) {
        // 只有左子树
        return node.left;
      } else {
        // 有两个子树，找到右子树的最小节点
        const minNode = this.findMin(node.right);
        node.feature = minNode.feature;
        node.right = this.removeNode(node.right, minNode.feature);
      }
    } else if (featureCenter < nodeCenter) {
      node.left = this.removeNode(node.left, feature);
    } else {
      node.right = this.removeNode(node.right, feature);
    }
    
    node.updateMax();
    return node;
  }
  
  /**
   * 找到最小节点
   */
  private findMin(node: IntervalNode): IntervalNode {
    let current = node;
    while (current.left) {
      current = current.left;
    }
    return current;
  }
  
  /**
   * 清空索引
   */
  clear(): void {
    this.root = null;
    this.features.clear();
  }
  
  /**
   * 获取所有特征
   */
  getAllFeatures(): Feature[] {
    return Array.from(this.features.values());
  }
}

/**
 * 区间树节点
 */
class IntervalNode {
  feature: Feature;
  left: IntervalNode | null = null;
  right: IntervalNode | null = null;
  min: number;
  max: number;
  
  constructor(feature: Feature) {
    this.feature = feature;
    this.min = feature.start;
    this.max = feature.end;
  }
  
  /**
   * 获取节点中心
   */
  getCenter(): number {
    return (this.feature.start + this.feature.end) / 2;
  }
  
  /**
   * 更新最大值
   */
  updateMax(): void {
    this.max = this.feature.end;
    if (this.left && this.left.max > this.max) {
      this.max = this.left.max;
    }
    if (this.right && this.right.max > this.max) {
      this.max = this.right.max;
    }
  }
}