import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuAction {
  id: string;
  label: string;
  shortcut?: string;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onAction: (actionId: string) => void;
  onClose: () => void;
}

const MENU_MARGIN = 12;

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, actions, onAction, onClose }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      setPosition({ left: x, top: y });
      return;
    }

    const rect = menu.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    let left = x;
    let top = y;

    if (rect.width + x + MENU_MARGIN > innerWidth) {
      left = Math.max(MENU_MARGIN, innerWidth - rect.width - MENU_MARGIN);
    }

    if (rect.height + y + MENU_MARGIN > innerHeight) {
      top = Math.max(MENU_MARGIN, innerHeight - rect.height - MENU_MARGIN);
    }

    setPosition({ left, top });
  }, [x, y]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleActionClick = (event: React.MouseEvent<HTMLButtonElement>, actionId: string) => {
    event.stopPropagation();
    onAction(actionId);
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-30 min-w-[180px] rounded-md border border-gray-700 bg-gray-900/95 text-sm text-gray-200 shadow-xl backdrop-blur"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
    >
      <ul className="py-1">
        {actions.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              onClick={(event) => handleActionClick(event, action.id)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 hover:bg-cyan-600/80 ${
                action.variant === 'danger'
                  ? 'text-red-400 hover:text-white focus-visible:ring-red-500'
                  : 'text-gray-200'
              }`}
            >
              <span>{action.label}</span>
              {action.shortcut && <span className="text-xs text-gray-400">{action.shortcut}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContextMenu;
