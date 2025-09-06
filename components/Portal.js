import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Portal = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const [modalRoot, setModalRoot] = useState(null);

  useEffect(() => {
    // Find or create modal root
    let element = document.getElementById('modal-root');
    if (!element) {
      element = document.createElement('div');
      element.id = 'modal-root';
      document.body.appendChild(element);
    }
    setModalRoot(element);
    setMounted(true);

    return () => {
      // Only remove if we created it
      if (!document.getElementById('modal-root')) {
        element.remove();
      }
    };
  }, []);

  // Handle conditional rendering based on state
  if (!mounted || !modalRoot) return null;

  return createPortal(children, modalRoot);
};

export default Portal; 