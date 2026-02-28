// 渲染配置常量
export const RENDER_CONFIG = {
  // 布局配置
  SIDEBAR_WIDTH: 250,
  LEGEND_WIDTH: 200,
  MARGIN: 50,

  // 轨道配置
  MIN_TRACK_HEIGHT: 15,
  MAX_TRACK_HEIGHT: 30,
  TRACK_SPACING: 5,

  // 注解特征配置
  // MIN_ANGLE_WIDTH 已废弃 —— 现在用像素锚定缝隙，不需要全局最小角度
  MIN_ANGLE_WIDTH: 0.001,       // 保留字段兼容性，实际不再使用

  // GC 轨道缝隙配置（保持原有逻辑）
  MIN_GAP_ANGLE: 0.005,
  MAX_GAP_ANGLE: 0.015,
  GAP_ANGLE_RATIO: 0.2,

  // 注解轨道缝隙像素配置（新增，供 computeAnnotationAngles 使用）
  // 含义：每个注解基因弧段两侧各留 GAP_PIXELS 个屏幕像素的空白间隙
  // 调大 → 缝隙更宽更明显；调小 → 基因更紧密
  // 推荐范围：1.0（密集）~ 2.5（稀疏）
  ANNOTATION_GAP_PIXELS: 1.5,

  // 标签配置
  LABEL_RADIUS_OFFSET: 60,
  LABEL_ANGLE_WIDTH: 0.08,
  LABEL_FONT_SIZE: 11,

  // 网格配置
  GRID_CIRCLES: 5,
  GRID_RADIAL_LINES: 12,

  // 比例尺配置
  SCALE_RADIUS_OFFSET: 30,
  SCALE_LENGTH_RATIO: 0.1,
  SCALE_FONT_SIZE: 12,

  // 图例配置
  LEGEND_ITEM_HEIGHT: 25,
  LEGEND_MARGIN: 20,
  LEGEND_PADDING: 10,
  LEGEND_TITLE_FONT_SIZE: 14,
  LEGEND_ITEM_FONT_SIZE: 12,

  // GC 轨道配置
  GC_MAX_BAR_HEIGHT_RATIO: 0.8,
  GC_CONTENT_NORMALIZATION: 20,
  GC_CONTENT_MIDPOINT: 50,
  GC_SKEW_RANGE: 0.5,
};

// 颜色常量
export const COLORS = {
  BACKGROUND: 0xffffff,
  GRID: 0xe0e0e0,
  TRACK_BACKGROUND: 0xf5f5f5,
  TEXT: 0x333333,
  BORDER: 0x333333,
};