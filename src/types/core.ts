// 核心类型定义

// 特征类型
export type FeatureType = 'CDS' | 'tRNA' | 'rRNA' | 'misc_RNA' | 'repeat_region' | 'tmRNA' | string;

// 链方向
export type Strand = '+' | '-' | '.';

// 特征属性
export interface FeatureAttributes {
  [key: string]: string;
}

// 特征
export interface Feature {
  id: string;
  name?: string;
  type: FeatureType;
  start: number;
  end: number;
  strand: Strand;
  attributes: FeatureAttributes;
  sequenceId?: string;
  seqid?: string; // 用于存储contig ID
  track?: any; // 用于存储所属track信息
}

// 轨道选项
export interface TrackOptions {
  id?: string;
  name: string;
  type: string;
  color?: string | number;
  visible?: boolean;
  height?: number;
}

// 轨道
export interface Track {
  id: string;
  name: string;
  type: string;
  color: string | number;
  visible: boolean;
  height: number;
  features: Feature[];
}

// 序列
export interface Sequence {
  id: string;
  name: string;
  length: number;
  features: Feature[];
}

// 基因组
export interface Genome {
  id?: string;
  name?: string;
  sequences: Sequence[];
  tracks: Track[];
  length: number;
}

// 视图模式
export type ViewMode = 'circular' | 'linear';

// 缩放级别
export interface ZoomLevel {
  level: number;
  min: number;
  max: number;
}

// 平移偏移
export interface PanOffset {
  x: number;
  y: number;
}

// 区域
export interface Region {
  start: number;
  end: number;
  sequenceId?: string;
}

// 导出选项
export interface ExportOptions {
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
}

// 颜色选项
export interface ColorOptions {
  [featureType: string]: string;
}

// 渲染器类型
export type RendererType = 'canvas' | 'svg';

// CGView 选项
export interface CGViewOptions {
  width?: number;
  height?: number;
  theme?: 'light' | 'dark' | 'high-contrast';
  defaultViewMode?: ViewMode;
  showSidebar?: boolean;
  showLegend?: boolean;
  showToolbar?: boolean;
  zoomEnabled?: boolean;
  panEnabled?: boolean;
  searchEnabled?: boolean;
  rendererType?: RendererType;
  tracks?: TrackOptions[];
  colors?: ColorOptions;
}

// 事件类型
export type EventType = 'zoom' | 'pan' | 'click' | 'hover' | 'dataLoaded' | 'viewModeChanged' | 'initialized' | 'rendererTypeChanged';

// 事件回调
export type EventCallback = (data?: any) => void;