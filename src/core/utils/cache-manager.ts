// 缓存管理器

/**
 * 缓存项接口
 */
export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry?: number; // 过期时间（毫秒）
}

/**
 * 缓存管理器
 * 用于缓存解析结果和计算结果，避免重复计算
 */
export class CacheManager {
  private cache: Map<string, CacheItem<any>> = new Map();
  private defaultExpiry: number = 3600000; // 默认过期时间：1小时
  
  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, expiry?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry: expiry || this.defaultExpiry
    };
    this.cache.set(key, item);
  }
  
  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.expiry!) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.expiry!) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * 设置默认过期时间
   */
  setDefaultExpiry(expiry: number): void {
    this.defaultExpiry = expiry;
  }
  
  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.expiry!) {
        this.cache.delete(key);
      }
    }
  }
}