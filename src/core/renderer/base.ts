// 基础渲染器
import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import type { EventType, EventCallback, PanOffset } from '../../types';

/**
 * 渲染器类型
 */
export type RendererType = 'canvas' | 'svg';

/**
 * 基础渲染器类
 * 提供渲染器的基础功能，如画布管理、事件处理
 */
export abstract class BaseRenderer {
  protected container: HTMLElement;
  protected app: PIXI.Application | null = null;
  protected stage: PIXI.Container | null = null;
  protected canvas: HTMLCanvasElement | null = null;
  public svg: SVGElement | null = null;
  protected width: number;
  protected height: number;
  public rendererType: RendererType;
  protected eventListeners: Map<EventType, EventCallback[]> = new Map();
  
  constructor(container: HTMLElement, width: number, height: number, rendererType: RendererType = 'canvas') {
    this.container = container;
    this.width = width;
    this.height = height;
    this.rendererType = rendererType;
    
    console.log('BaseRenderer constructor called with:', { width, height, container, rendererType });
    console.log('Container dimensions:', {
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight,
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight
    });
    
    if (rendererType === 'canvas') {
      this.initializeCanvasRenderer();
    } else {
      this.initializeSvgRenderer();
    }
  }
  
  /**
   * 初始化Canvas渲染器
   */
  private initializeCanvasRenderer(): void {
    try {
      // 创建一个div元素作为容器，这样PIXI.js可以根据渲染器类型创建适当的元素
      const containerElement = document.createElement('div');
      containerElement.style.width = `${this.width}px`;
      containerElement.style.height = `${this.height}px`;
      containerElement.style.position = 'relative';
      
      // 添加容器元素到主容器
      this.container.appendChild(containerElement);
      console.log('Container element added to container');
      
      // 创建 PIXI 应用
      console.log('Creating PIXI.Application...');
      
      // 初始化PIXI应用，明确指定使用Canvas渲染器以避免WebGL错误
      this.app = new PIXI.Application();
      
      // 初始化PIXI应用
      this.app.init({
        width: this.width,
        height: this.height,
        backgroundColor: 0xffffff,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }).then(() => {
        // 将PIXI创建的视图添加到我们的容器元素中
        if (this.app) {
          containerElement.appendChild(this.app.view);
          // 保存视图元素
          if (this.app.view instanceof HTMLCanvasElement) {
            this.canvas = this.app.view;
            console.log('PIXI created canvas element');
          } else {
            console.log('PIXI created non-canvas element:', this.app.view);
          }
          console.log('PIXI view added to container element');
        }
        console.log('PIXI.Application initialized successfully');
        
        // 检查PIXI.Application是否创建成功
        if (!this.app) {
          throw new Error('Failed to create PIXI.Application');
        }
        
        // 检查当前渲染器类型
        console.log('Current renderer:', this.app.renderer);
        console.log('Renderer type:', this.app.renderer.constructor.name);
        
        this.stage = new PIXI.Container();
        this.app.stage.addChild(this.stage);
        console.log('Stage created and added to app');
        
        // 初始化事件监听
        this.initEventListeners();
        console.log('Event listeners initialized');
        
        // 触发初始化完成事件
        this.emit('initialized');
      }).catch((error) => {
        console.error('Error initializing PIXI.Application:', error);
        // 移除可能已经添加的canvas
        if (this.canvas && this.container.contains(this.canvas)) {
          this.container.removeChild(this.canvas);
          this.canvas = null;
        } else {
          const existingCanvas = this.container.querySelector('canvas');
          if (existingCanvas) {
            this.container.removeChild(existingCanvas);
          }
        }
        // 创建一个简单的canvas作为 fallback
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.container.appendChild(canvas);
        this.canvas = canvas;
        console.log('Created fallback canvas');
        // 注意：在fallback情况下，this.app和this.stage都是null
      });
    } catch (error) {
      console.error('Error creating PIXI.Application:', error);
      // 移除可能已经添加的canvas
      if (this.canvas && this.container.contains(this.canvas)) {
        this.container.removeChild(this.canvas);
        this.canvas = null;
      } else {
        const existingCanvas = this.container.querySelector('canvas');
        if (existingCanvas) {
          this.container.removeChild(existingCanvas);
        }
      }
      // 创建一个简单的canvas作为 fallback
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      this.container.appendChild(canvas);
      this.canvas = canvas;
      console.log('Created fallback canvas');
      // 注意：在fallback情况下，this.app和this.stage都是null
    }
  }
  
  /**
   * 初始化SVG渲染器
   */
  private initializeSvgRenderer(): void {
    try {
      // 清空容器
      this.container.innerHTML = '';
      
      // 直接创建SVG元素，不使用d3.js
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', this.width.toString());
      svg.setAttribute('height', this.height.toString());
      svg.style.position = 'relative';
      svg.style.backgroundColor = '#ffffff';
      
      // 添加SVG元素到容器
      this.container.appendChild(svg);
      
      this.svg = svg;
      console.log('SVG renderer initialized successfully');
      console.log('SVG element:', this.svg);
      console.log('SVG element dimensions:', { width: svg.width, height: svg.height });
      
      // 初始化事件监听
      this.initEventListeners();
      console.log('Event listeners initialized for SVG');
      
      // 触发初始化完成事件
      this.emit('initialized');
    } catch (error) {
      console.error('Error initializing SVG renderer:', error);
      // 降级到canvas渲染器
      console.log('Falling back to canvas renderer');
      this.rendererType = 'canvas';
      this.initializeCanvasRenderer();
    }
  }
  
  /**
   * 初始化事件监听器
   */
  protected initEventListeners(): void {
    const targetElement = this.rendererType === 'canvas' ? this.canvas : this.svg;
    if (!targetElement) return;
    
    // 鼠标事件
    targetElement.addEventListener('mousedown', () => this.handleMouseDown());
    targetElement.addEventListener('mousemove', (event) => this.handleMouseMove(event as MouseEvent));
    targetElement.addEventListener('mouseup', () => this.handleMouseUp());
    targetElement.addEventListener('mouseleave', (event) => this.handleMouseLeave(event as MouseEvent));
    targetElement.addEventListener('wheel', this.handleWheel.bind(this));
    
    // 触摸事件
    targetElement.addEventListener('touchstart', () => this.handleTouchStart());
    targetElement.addEventListener('touchmove', () => this.handleTouchMove());
    targetElement.addEventListener('touchend', () => this.handleTouchEnd());
  }
  
  /**
   * 处理鼠标按下事件
   */
  protected handleMouseDown(): void {
    // 子类实现
  }
  
  /**
   * 处理鼠标移动事件
   */
  protected handleMouseMove(_event: MouseEvent): void {
    // 子类实现
  }
  
  /**
   * 处理鼠标释放事件
   */
  protected handleMouseUp(): void {
    // 子类实现
  }

  /**
   * 处理鼠标离开画布事件
   */
  protected handleMouseLeave(_event: MouseEvent): void {
    // 子类实现
  }
  
  /**
   * 处理鼠标滚轮事件
   */
  protected handleWheel(event: Event): void {
    const wheelEvent = event as WheelEvent;
    wheelEvent.preventDefault();
    const delta = wheelEvent.deltaY > 0 ? -1 : 1;
    // 计算鼠标在画布内的相对位置
    const targetElement = this.rendererType === 'canvas' ? this.canvas : this.svg;
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const x = wheelEvent.clientX - rect.left;
      const y = wheelEvent.clientY - rect.top;
      this.emit('zoom', { delta, point: { x, y } });
    } else {
      this.emit('zoom', { delta, point: { x: wheelEvent.clientX, y: wheelEvent.clientY } });
    }
  }
  
  /**
   * 处理触摸开始事件
   */
  protected handleTouchStart(): void {
    // 子类实现
  }
  
  /**
   * 处理触摸移动事件
   */
  protected handleTouchMove(): void {
    // 子类实现
  }
  
  /**
   * 处理触摸结束事件
   */
  protected handleTouchEnd(): void {
    // 子类实现
  }
  
  /**
   * 初始化渲染器
   */
  abstract init(): void;
  
  /**
   * 渲染当前视图
   */
  abstract render(): void;
  
  /**
   * 调整画布大小
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.rendererType === 'canvas') {
      if (this.app && this.app.renderer) {
        this.app.renderer.resize(width, height);
        this.render();
      } else if (this.canvas) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
    } else if (this.rendererType === 'svg' && this.svg) {
      d3.select(this.svg)
        .attr('width', width)
        .attr('height', height);
      this.render();
    }
  }
  
  /**
   * 设置缩放级别
   */
  abstract setZoomLevel(level: number, point?: { x: number; y: number }): void;
  
  /**
   * 设置平移偏移
   */
  abstract setPanOffset(offset: PanOffset): void;
  
  /**
   * 转换屏幕坐标到世界坐标
   */
  screenToWorld(x: number, y: number): { x: number; y: number } {
    if (!this.stage) {
      return { x, y };
    }
    return this.stage.toLocal(new PIXI.Point(x, y));
  }
  
  /**
   * 转换世界坐标到屏幕坐标
   */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    if (!this.stage) {
      return { x, y };
    }
    const point = this.stage.toGlobal(new PIXI.Point(x, y));
    return { x: point.x, y: point.y };
  }
  
  /**
   * 切换标签显示/隐藏
   */
  abstract toggleLabels(visible: boolean): void;
  
  /**
   * 注册事件监听器
   */
  on(event: EventType, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }
  
  /**
   * 移除事件监听器
   */
  off(event: EventType, callback: EventCallback): void {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }
  
  /**
   * 触发事件
   */
  protected emit(event: EventType, data?: any): void {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      callbacks?.forEach(callback => callback(data));
    }
  }
  
  /**
   * 销毁渲染器
   */
  destroy(): void {
    // 移除事件监听器
    this.eventListeners.clear();
    
    // 销毁 PIXI 应用
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
    
    // 从容器中移除画布或SVG
    if (this.rendererType === 'canvas' && this.canvas && this.container.contains(this.canvas)) {
      this.container.removeChild(this.canvas);
      this.canvas = null;
    } else if (this.rendererType === 'svg' && this.svg && this.container.contains(this.svg)) {
      this.container.removeChild(this.svg);
      this.svg = null;
    }
    
    this.stage = null;
  }
}