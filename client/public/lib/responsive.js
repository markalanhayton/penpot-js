'use strict';
const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
};

let leftSidebarOpen = false;
let rightSidebarOpen = false;
let backdropElement = null;
let touchGestureState = null;

function getBreakpoint() {
  const w = window.innerWidth;
  if (w < BREAKPOINTS.mobile) return 'mobile';
  if (w < BREAKPOINTS.tablet) return 'tablet';
  if (w < BREAKPOINTS.desktop) return 'desktop';
  return 'wide';
}

function isMobile() {
  return window.innerWidth < BREAKPOINTS.tablet;
}

function isTablet() {
  return window.innerWidth >= BREAKPOINTS.tablet && window.innerWidth < BREAKPOINTS.desktop;
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function createBackdrop() {
  if (backdropElement) return backdropElement;
  backdropElement = document.createElement('div');
  backdropElement.className = 'penpot-sidebar-backdrop';
  backdropElement.addEventListener('click', () => {
    closeSidebars();
  });
  document.body.appendChild(backdropElement);
  return backdropElement;
}

function removeBackdrop() {
  if (backdropElement) {
    backdropElement.remove();
    backdropElement = null;
  }
}

function openLeftSidebar() {
  if (!isMobile()) return;
  const sidebar = document.querySelector('penpot-left-sidebar');
  if (!sidebar) return;
  leftSidebarOpen = true;
  sidebar.classList.add('penpot-sidebar--open');
  const backdrop = createBackdrop();
  backdrop.classList.add('penpot-sidebar--visible');
  document.body.style.overflow = 'hidden';
}

function openRightSidebar() {
  if (!isMobile()) return;
  const sidebar = document.querySelector('penpot-right-sidebar');
  if (!sidebar) return;
  rightSidebarOpen = true;
  sidebar.classList.add('penpot-sidebar--open');
  const backdrop = createBackdrop();
  backdrop.classList.add('penpot-sidebar--visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebars() {
  const leftSidebar = document.querySelector('penpot-left-sidebar');
  const rightSidebar = document.querySelector('penpot-right-sidebar');
  if (leftSidebar) {
    leftSidebar.classList.remove('penpot-sidebar--open');
  }
  if (rightSidebar) {
    rightSidebar.classList.remove('penpot-sidebar--open');
  }
  leftSidebarOpen = false;
  rightSidebarOpen = false;
  if (backdropElement) {
    backdropElement.classList.remove('penpot-sidebar--visible');
  }
  document.body.style.overflow = '';
}

function isLeftSidebarOpen() {
  return leftSidebarOpen;
}

function isRightSidebarOpen() {
  return rightSidebarOpen;
}

function initTouchGestures(canvasElement) {
  if (!canvasElement) return;

  let initialPinchDistance = 0;
  let initialZoom = 1;
  let panStartX = 0;
  let panStartY = 0;
  let isPanning = false;

  canvasElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
      initialZoom = parseFloat(canvasElement.dataset.zoom || '1');
      e.preventDefault();
    }
    if (e.touches.length === 1) {
      isPanning = false;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
    }
  }, { passive: false });

  canvasElement.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (initialPinchDistance > 0) {
        const scaleFactor = distance / initialPinchDistance;
        const newZoom = Math.max(0.1, Math.min(64, initialZoom * scaleFactor));
        canvasElement.dispatchEvent(new CustomEvent('penpot-pinch-zoom', {
          detail: { zoom: newZoom, center: getTouchCenter(e.touches) },
          bubbles: true,
        }));
      }
      e.preventDefault();
    } else if (e.touches.length === 1 && e.touches.length === 1) {
      const dx = e.touches[0].clientX - panStartX;
      const dy = e.touches[0].clientY - panStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isPanning = true;
        canvasElement.dispatchEvent(new CustomEvent('penpot-touch-pan', {
          detail: { deltaX: dx, deltaY: dy },
          bubbles: true,
        }));
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
      }
    }
  }, { passive: false });

  canvasElement.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = 0;
    }
    if (e.touches.length === 0) {
      isPanning = false;
    }
  }, { passive: false });
}

function getTouchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function applyResponsiveLayout() {
  const breakpoint = getBreakpoint();
  document.body.dataset.breakpoint = breakpoint;
  document.body.classList.toggle('penpot-is-mobile', isMobile());
  document.body.classList.toggle('penpot-is-tablet', isTablet());
  document.body.classList.toggle('penpot-is-touch', isTouchDevice());
  if (!isMobile()) {
    closeSidebars();
  }
}

function initResponsiveLayout() {
  applyResponsiveLayout();
  window.addEventListener('resize', applyResponsiveLayout);

  const mediaQuery = window.matchMedia(`(max-width: ${BREAKPOINTS.tablet - 1}px)`);
  mediaQuery.addEventListener('change', applyResponsiveLayout);
}

export {
  BREAKPOINTS,
  getBreakpoint,
  isMobile,
  isTablet,
  isTouchDevice,
  openLeftSidebar,
  openRightSidebar,
  closeSidebars,
  isLeftSidebarOpen,
  isRightSidebarOpen,
  initTouchGestures,
  initResponsiveLayout,
  applyResponsiveLayout,
};