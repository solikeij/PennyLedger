import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Render outside scrolling cards/dialogs, and keep the list in the viewport.
export default function FloatingOptions({ anchor, onClose, children, ...props }) {
  const [position, setPosition] = useState({ visibility: 'hidden' });
  useEffect(() => {
    const place = () => {
      if (!anchor.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const width = viewport?.width || window.innerWidth;
      const topEdge = viewport?.offsetTop || 0;
      const leftEdge = viewport?.offsetLeft || 0;
      const bottom = topEdge + height;
      const below = Math.max(0, bottom - rect.bottom - 8);
      const above = Math.max(0, Math.min(rect.top, bottom) - topEdge - 8);
      const flip = below < 180 && above > below;
      const maxHeight = Math.max(0, Math.min(240, flip ? above : below));
      const listWidth = Math.min(rect.width, width - 16);
      setPosition({ position: 'fixed', left: Math.max(leftEdge + 8, Math.min(rect.left, leftEdge + width - listWidth - 8)),
        width: listWidth, maxHeight,
        top: Math.max(topEdge + 8, Math.min(flip ? rect.top - maxHeight - 4 : rect.bottom + 4, bottom - maxHeight - 8)) });
    };
    const outside = (event) => {
      if (!anchor.current.contains(event.target) && !event.target.closest('[data-floating-options]')) onClose();
    };
    const escape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [anchor, onClose]);
  return createPortal(<ul {...props} data-floating-options style={position}>{children}</ul>, document.body);
}
