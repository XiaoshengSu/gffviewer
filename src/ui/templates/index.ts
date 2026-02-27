/**
 * 模板加载器
 * 负责加载和管理UI模板
 */

export class TemplateLoader {
  /**
   * 加载侧边栏模板
   * @returns 侧边栏HTML字符串
   */
  static async loadSidebarTemplate(): Promise<string> {
    try {
      const response = await fetch('/src/ui/templates/sidebar.html');
      if (!response.ok) {
        throw new Error(`Failed to load sidebar template: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Error loading sidebar template:', error);
      // 提供一个默认的侧边栏模板作为后备
      return `
        <div id="sidebar" class="sidebar">
          <div class="sidebar-header">
            <h3>Tracks</h3>
            <button id="sidebar-toggle" class="sidebar-toggle">&lt;</button>
          </div>
          <div id="track-list" class="track-list"></div>
          <div class="actions-section">
            <button id="fullscreen-btn" class="action-btn">Fullscreen</button>
            <button id="export-svg-btn" class="action-btn">Export SVG</button>
          </div>
        </div>
      `;
    }
  }
  
  /**
   * 加载应用容器模板
   * @param sidebarHtml 侧边栏HTML
   * @returns 完整的应用容器HTML
   */
  static getAppContainerTemplate(sidebarHtml: string): string {
    return `
      <div class="app-container">
        ${sidebarHtml}
        <!-- 主画布区域 -->
        <div id="cgview-container" class="cgview-container"></div>
      </div>
    `;
  }
}