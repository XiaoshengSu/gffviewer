# 技术架构设计

## 1. 技术栈选择

### 1.1 核心技术
- **TypeScript**：提供类型安全，提升开发体验和代码质量
- **Vite**：提供极速的开发体验和高效的构建
- **PixiJS**：WebGL 2D 渲染引擎，提供高性能的图形渲染
- **Zustand**：轻量级状态管理库，管理视图状态和数据缓存
- **d3**：数据驱动的可视化库，用于比例尺和交互功能

### 1.2 辅助库
- **d3-scale**：用于比例尺计算
- **d3-zoom**：用于实现缩放和平移功能
- **papaparse**：用于解析 CSV 格式数据
- **jszip**：用于处理压缩文件

## 2. 项目结构

```
src/
├── core/              # 核心引擎
│   ├── renderer/      # 渲染器
│   │   ├── circular/  # 环形渲染器
│   │   │   ├── config.ts
│   │   │   ├── feature-renderer.ts
│   │   │   ├── grid-scale-renderer.ts
│   │   │   ├── index.ts
│   │   │   ├── label-renderer.ts
│   │   │   ├── legend-renderer.ts
│   │   │   ├── utils.ts
│   │   │   └── zoom-pan-controller.ts
│   │   └── base.ts    # 基础渲染器
│   ├── data/          # 数据处理
│   │   ├── parsers/   # 格式解析器
│   │   │   └── gff3.ts
│   │   ├── models/    # 数据模型
│   │   │   ├── feature.ts
│   │   │   ├── genome.ts
│   │   │   ├── sequence.ts
│   │   │   └── track.ts
│   │   └── index.ts   # 数据管理
│   ├── utils/         # 工具函数
│   │   ├── cache-manager.ts
│   │   ├── lod-manager.ts
│   │   └── spatial-index.ts
│   └── index.ts       # 核心引擎入口
├── ui/                # UI 组件
│   ├── controls/      # 控制面板
│   │   ├── legend.ts
│   │   ├── sidebar.ts
│   │   └── toolbar.ts
│   ├── templates/     # 模板文件
│   │   ├── index.ts
│   │   └── sidebar.html
│   ├── themes/        # 主题系统
│   │   ├── dark.ts
│   │   ├── index.ts
│   │   └── light.ts
│   ├── ColorSchemeManager.ts
│   ├── ControlsManager.ts
│   ├── DragAndZoomManager.ts
│   ├── Sidebar.ts
│   ├── TooltipManager.ts
│   └── index.ts       # UI 入口
├── types/             # TypeScript 类型定义
│   ├── core.ts
│   ├── index.ts
│   └── ui.ts
├── main.ts            # 应用入口
├── style.css          # 全局样式
└── vite-env.d.ts      # Vite 类型定义
```

## 3. 核心模块设计

### 3.1 渲染引擎

#### 3.1.1 基础渲染器 (`BaseRenderer`)
- **职责**：提供渲染器的基础功能，如画布管理、事件处理
- **主要方法**：
  - `init()`：初始化渲染器
  - `render()`：渲染当前视图
  - `resize()`：调整画布大小
  - `destroy()`：销毁渲染器

#### 3.1.2 环形渲染器 (`CircularRenderer`)
- **职责**：实现环形视图的渲染逻辑
- **主要方法**：
  - `render()`：渲染整个环形视图
  - `setGenome()`：设置基因组数据
  - `setZoomLevel()`：设置缩放级别
  - `setPanOffset()`：设置平移偏移
  - `toggleLabels()`：切换标签显示/隐藏
  - `toggleGrid()`：切换网格线显示/隐藏
  - `highlightFeature()`：高亮显示特定特征

### 3.2 数据处理

#### 3.2.1 数据模型
- **`Genome`**：表示完整的基因组数据
  - 属性：`name`, `length`, `sequences`, `tracks`
  - 方法：`addTrack()`, `removeTrack()`, `searchFeatures()`

- **`Track`**：表示基因组的一个轨道
  - 属性：`name`, `type`, `features`, `color`, `visible`
  - 方法：`addFeature()`, `removeFeature()`

- **`Feature`**：表示一个基因或其他注释特征
  - 属性：`id`, `name`, `type`, `start`, `end`, `strand`, `attributes`
  - 方法：`getLength()`, `getCenter()`

- **`Sequence`**：表示基因组序列
  - 属性：`id`, `name`, `length`, `sequence`

#### 3.2.2 解析器
- **`GFF3Parser`**：GFF3 格式解析器
  - 方法：`parse()`：解析 GFF3 文件内容
  - 功能：将 GFF3 格式数据解析为 Genome 对象

### 3.3 交互系统

#### 3.3.1 缩放和平移
- **`ZoomPanController`**：管理缩放和平移操作
  - 方法：`zoomIn()`, `zoomOut()`, `zoomTo()`, `resetZoom()`, `pan()`

#### 3.3.2 事件系统
- **`EventManager`**：管理用户事件
  - 方法：`on()`, `off()`, `emit()`
  - 事件：`zoom`, `pan`, `click`, `hover`, `dataLoaded`, `viewModeChanged`, `rendererTypeChanged`

### 3.4 UI 系统

#### 3.4.1 控制面板
- **`Sidebar`**：可折叠侧边栏
  - 功能：图层控制、颜色配置、显示选项

- **`Legend`**：交互式图例
  - 功能：显示特征类型和颜色，支持点击显示/隐藏

- **`Toolbar`**：工具栏
  - 功能：视图控制、缩放控制、导出按钮

#### 3.4.2 主题系统
- **`ThemeManager`**：管理主题
  - 方法：`setTheme()`, `getTheme()`
  - 主题：`light`, `dark`

### 3.5 性能优化

#### 3.5.1 空间索引
- **`SpatialIndex`**：空间索引接口
  - 方法：`insert()`, `query()`, `remove()`
  - 用于快速查询特定区域内的特征

#### 3.5.2 虚拟渲染
- **`LODManager`**：Level of Detail 管理器
  - 方法：`getLOD()`, `shouldRender()`
  - 功能：根据缩放级别调整渲染细节

#### 3.5.3 数据缓存
- **`CacheManager`**：缓存管理器
  - 方法：`get()`, `set()`, `clear()`
  - 功能：缓存解析结果和计算结果

## 4. 状态管理

### 4.1 视图状态
- **状态**：
  - `viewMode`：视图模式（当前仅支持环形）
  - `zoomLevel`：缩放级别
  - `panOffset`：平移偏移
  - `selectedFeature`：选中的特征
  - `hoveredFeature`：悬停的特征

- **操作**：
  - `setViewMode()`：设置视图模式
  - `setZoomLevel()`：设置缩放级别
  - `setPanOffset()`：设置平移偏移
  - `selectFeature()`：选择特征
  - `hoverFeature()`：悬停特征

### 4.2 数据状态
- **状态**：
  - `genome`：基因组数据
  - `tracks`：轨道列表
  - `visibleTracks`：可见轨道
  - `searchResults`：搜索结果

- **操作**：
  - `loadGenome()`：加载基因组数据
  - `addTrack()`：添加轨道
  - `removeTrack()`：移除轨道
  - `toggleTrackVisibility()`：切换轨道可见性
  - `search()`：搜索特征

## 5. API 设计

### 5.1 核心 API

```typescript
class CGView {
  constructor(container: HTMLElement, options?: CGViewOptions);
  
  // 数据加载
  loadGenome(data: string | File, format?: string): Promise<void>;
  
  // 视图控制
  setViewMode(mode: 'circular' | 'linear'): void;
  zoomIn(): void;
  zoomOut(): void;
  setZoomLevel(level: number, point?: { x: number; y: number }): void;
  zoomTo(): void;
  resetView(): void;
  pan(deltaX: number, deltaY: number): void;
  
  // 显示控制
  toggleLegend(visible: boolean): void;
  toggleLabels(visible: boolean): void;
  toggleGrid(visible: boolean): void;
  setRendererType(rendererType: 'canvas' | 'svg'): void;
  
  // 数据管理
  search(query: string): any[];
  highlightFeature(feature: any): void;
  
  // 导出
  export(format: 'svg' | 'png', options?: ExportOptions): Promise<Blob>;
  
  // 事件
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  
  // 工具方法
  render(): void;
  resize(width: number, height: number): void;
  destroy(): void;
  getViewMode(): ViewMode;
  getGenome(): Genome | null;
  getOptions(): CGViewOptions;
}
```

### 5.2 配置选项

```typescript
interface CGViewOptions {
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  defaultViewMode?: 'circular' | 'linear';
  showSidebar?: boolean;
  showLegend?: boolean;
  showToolbar?: boolean;
  zoomEnabled?: boolean;
  panEnabled?: boolean;
  searchEnabled?: boolean;
  rendererType?: 'canvas' | 'svg';
}
```

## 6. 性能优化策略

### 6.1 渲染优化
- **Canvas 渲染**：使用 Canvas 2D 渲染器，提供高效的图形渲染
- **批量渲染**：将相同类型的特征批量渲染，减少绘制调用
- **LOD 技术**：根据缩放级别调整渲染细节，远距离显示概览，近距离渲染细节
- **视口裁剪**：只渲染视口内的特征，减少渲染工作量

### 6.2 数据处理优化
- **数据缓存**：缓存解析结果和计算结果，避免重复计算
- **空间索引**：使用空间索引实现高效的特征查询

### 6.3 内存优化
- **按需渲染**：只渲染当前需要的特征，释放不需要的资源

## 7. 兼容性与降级方案

### 7.1 浏览器兼容性
- **现代浏览器**：支持 Chrome、Firefox、Safari、Edge 的最新版本
- **Canvas 2D 渲染**：使用 Canvas 2D 渲染器，确保在所有现代浏览器中可用

### 7.2 降级方案
- **简化功能**：在低性能设备上，自动简化渲染效果，保证基本功能可用

## 8. 部署与发布

### 8.1 构建配置
- **开发环境**：使用 Vite 的开发服务器，支持热模块替换
- **生产环境**：使用 Vite 构建，生成优化后的生产包
- **输出格式**：支持 ESM 格式

### 8.2 版本管理
- **语义化版本**：遵循语义化版本规范
- **发布流程**：手动发布
- **文档**：维护架构设计文档

## 9. 总结

本架构设计基于 TypeScript + Vite + PixiJS 技术栈，采用模块化、可扩展的设计理念，实现了一个高性能、功能丰富的基因组可视化库。通过空间索引、LOD 技术等优化手段，确保了在处理大规模基因组数据时的性能和响应速度。同时，提供了友好的 API 和丰富的 UI 交互，满足现代生物信息学研究对基因组可视化的需求。

当前实现以环形视图为主，支持 GFF3 格式数据的解析和渲染，提供了缩放、平移、搜索、高亮等交互功能，以及 SVG/PNG 导出能力。未来可扩展支持线性视图、更多数据格式和高级分析功能。