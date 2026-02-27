/**
 * CGView 主应用入口
 * 负责初始化应用容器、加载基因组数据和管理各个功能模块
 */
import './style.css'
import { CGView } from './core'
import { ThemeManager } from './ui'
import { SidebarManager } from './ui/Sidebar'
import { ColorSchemeManager } from './ui/ColorSchemeManager'
import { ControlsManager } from './ui/ControlsManager'
import { TooltipManager } from './ui/TooltipManager'
import { DragAndZoomManager } from './ui/DragAndZoomManager'
import { TemplateLoader } from './ui/templates'

const themeManager = new ThemeManager();
themeManager.setTheme('light');

// 创建应用容器
const appContainer = document.querySelector<HTMLDivElement>('#app')!;

// 加载侧边栏模板
async function loadAppTemplate() {
  try {
    const sidebarHtml = await TemplateLoader.loadSidebarTemplate();
    const appHtml = TemplateLoader.getAppContainerTemplate(sidebarHtml);
    appContainer.innerHTML = appHtml;
  } catch (error) {
    console.error('Error loading app template:', error);
    // 提供一个简单的默认模板作为后备
    appContainer.innerHTML = `
      <div class="app-container">
        <div id="sidebar" class="sidebar">
          <div class="sidebar-header">
            <h3>Tracks</h3>
            <button id="sidebar-toggle" class="sidebar-toggle">&lt;</button>
          </div>
          <div id="track-list" class="track-list"></div>
        </div>
        <div id="cgview-container" class="cgview-container"></div>
      </div>
    `;
  }
}

// 等待DOM渲染完成后初始化应用
requestAnimationFrame(async () => {
  // 等待模板加载完成
  await loadAppTemplate();
  
  // 获取CGView容器
  const container = document.getElementById('cgview-container')!;
  
  // 检查容器尺寸
  console.log('Container dimensions:', {
    clientWidth: container.clientWidth,
    clientHeight: container.clientHeight,
    offsetWidth: container.offsetWidth,
    offsetHeight: container.offsetHeight
  });
  
  // 强制设置容器尺寸
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.minWidth = '800px';
  container.style.minHeight = '600px';
  container.style.backgroundColor = '#f0f0f0'; // 添加背景色以便查看容器
  
  // 再次检查容器尺寸
  console.log('Container dimensions after style:', {
    clientWidth: container.clientWidth,
    clientHeight: container.clientHeight,
    offsetWidth: container.offsetWidth,
    offsetHeight: container.offsetHeight
  });
  
  // 确保容器有足够的尺寸
  const width = Math.max(container.clientWidth || 800, 800);
  const height = Math.max(container.clientHeight || 600, 600);
  console.log('Final CGView dimensions:', { width, height });
  
  let cgview: any;
  let sidebarManager: SidebarManager;
  let colorSchemeManager: ColorSchemeManager;
  let controlsManager: ControlsManager;
  let tooltipManager: TooltipManager;
  let dragAndZoomManager: DragAndZoomManager;

  // 初始化所有管理器
  function initManagers() {
    sidebarManager = new SidebarManager();
    colorSchemeManager = new ColorSchemeManager();
    controlsManager = new ControlsManager();
    tooltipManager = new TooltipManager();
    dragAndZoomManager = new DragAndZoomManager();
  }

  // 初始化CGView
  function initCGView(_content: string) {
    // 清空容器，准备重新初始化
    container.innerHTML = '';
    
    // 重新初始化CGView
    console.log('Initializing CGView...');
    cgview = new CGView(container, {
      width: width,
      height: height,
      defaultViewMode: 'circular',
      showSidebar: true,
      showLegend: true,
      showToolbar: true,
      rendererType: 'svg' // 使用SVG渲染模式
    });
    // 将CGView实例添加到window对象，以便在侧边栏切换时访问
    (window as any).cgview = cgview;
    console.log('CGView initialized');
    console.log('CGView instance added to window.cgview');

    // 设置CGView实例到所有管理器
    sidebarManager.setCGView(cgview);
    colorSchemeManager.setCGView(cgview);
    controlsManager.setCGView(cgview);
    tooltipManager.setCGView(cgview);
    dragAndZoomManager.setCGView(cgview);

    // 同步缩放级别
    controlsManager.setCurrentZoom(dragAndZoomManager.getCurrentZoom());
  }

  // 加载demo.gff文件
  async function loadDemoData() {
    try {
      // 显示加载中状态
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 18px; color: #666;">Loading genome data...</div>';
      
      console.log('Starting to load demo.gff...');
      const response = await fetch('/demo.gff');
      console.log('Fetch response:', { status: response.status, statusText: response.statusText });
      if (!response.ok) {
        throw new Error(`Failed to load demo.gff: ${response.status} ${response.statusText}`);
      }
      const content = await response.text();
      console.log('Loaded demo.gff content length:', content.length);
      console.log('First 100 characters:', content.substring(0, 100) + '...');
      
      // 初始化所有管理器
      initManagers();
      
      // 初始化CGView
      initCGView(content);
      
      // 加载基因组数据
      console.log('Loading genome data...');
      await cgview.loadGenome(content, 'gff3');
      console.log('Demo data loaded successfully');
      
      // 响应窗口大小变化
      window.addEventListener('resize', () => {
        const newWidth = Math.max(container.clientWidth || 800, 800);
        const newHeight = Math.max(container.clientHeight || 600, 600);
        console.log('Window resized, new dimensions:', {
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight,
          newWidth: newWidth,
          newHeight: newHeight
        });
        cgview.resize(newWidth, newHeight);
      });
      
    } catch (error) {
      console.error('Error loading demo data:', error);
      container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 18px; color: #ff0000;">Error loading data: ${(error as Error).message}</div>`;
    }
  }

  // 监听GFF文件加载事件
  document.addEventListener('gffFileLoaded', async (e: any) => {
    const { content } = e.detail;
    try {
      // 初始化CGView
      initCGView(content);
      
      // 加载基因组数据
      console.log('Loading genome data...');
      await cgview.loadGenome(content, 'gff3');
      console.log('Genome data loaded successfully');
      
      // 响应窗口大小变化
      window.addEventListener('resize', () => {
        const newWidth = Math.max(container.clientWidth || 800, 800);
        const newHeight = Math.max(container.clientHeight || 600, 600);
        console.log('Window resized, new dimensions:', {
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight,
          newWidth: newWidth,
          newHeight: newHeight
        });
        cgview.resize(newWidth, newHeight);
      });
    } catch (error) {
      console.error('Error loading GFF file:', error);
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 18px; color: #f44336;">Error loading GFF file. Please check the console for details.</div>';
    }
  });

  // 加载演示数据
  loadDemoData();
});